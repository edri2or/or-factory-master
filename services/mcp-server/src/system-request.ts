// System resource-request channel — the request bridge (a sibling of the OIL
// approval bridge, oil-approval.ts). A provisioned system RAISES a request via
// scripts/emit-event.sh (name `system.request.secret` / `system.request.iam`,
// action_required=true) → a Linear ticket. handleLinearWebhook (oil-autofix.ts)
// detects the `system.request.` prefix and calls dispatchSystemRequest here,
// which dispatches fulfill-system-request.yml in its REGISTER phase. That
// workflow validates the request and calls /system-request-register, which
// (registerSystemRequest here) sends Or ONE Telegram card with ✅/❌ buttons.
// When Or taps a button Telegram POSTs /telegram-webhook → handleSystemRequestCallback:
// it authorises the presser, recovers the request from the Linear issue, and (✅)
// dispatches the FULFILL phase, where the broker performs the privileged action.
//
// State-free by design: the button's callback_data carries only the Linear issue
// identifier (`sysreq:<id>` / `sysno:<id>`, well under Telegram's 64-byte cap),
// and the full request lives in the Linear issue body — so a Cloud Run instance
// swap can never lose a pending request. Every step is soft-fail and the webhook
// always answers 200 so Telegram never retry-storms.

import type { Request } from 'express';
import { dispatchWorkflow, apiGet, mergePullRequestAsApprover } from './github-client.js';
import {
  emitEvent,
  sendTelegramKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  readSecretSoft,
  linearGql,
  type InlineButton,
} from './observability-client.js';

const OWNER = 'edri2or';
const FACTORY_REPO = 'or-factory-master';
const FULFILL_WORKFLOW = 'fulfill-system-request.yml';
const PROMOTE_WORKFLOW = 'fulfill-promote-request.yml';

// ── merge request (card-free, author≠approver) ──────────────────────────────
// A `system.request.merge` is unlike the other request types: it carries NO
// Telegram card. The human gate has already fired SYSTEM-side (Or tapped ✅ on
// or-aios's OWN bot), so the factory does not re-ask. Its whole job is to run
// the merge as the SEPARATE approver App, so the identity that merges is not the
// one that authored the PR (author≠approver — the property the OIL pattern
// rests on). It is fail-closed by three pins below: only or-aios may drive it,
// only that system's own self-fix branches, and only its own App may be the PR
// author. Green-CI is enforced downstream by mergePullRequestAsApprover (native
// auto-merge gated on branch protection's required checks).
const MERGE_ALLOWED_SYSTEM = 'or-aios';
// The PR author login a self-fix PR must carry — the system's own GitHub App
// bot. Confirmed live in C2b-1 (PR #461 was authored by `or-aios-app[bot]`).
// Env-overridable so the slug can be re-pinned without a code change if a future
// App rename shifts it.
const EXPECTED_SELFFIX_AUTHOR = process.env.EXPECTED_SELFFIX_AUTHOR ?? 'or-aios-app[bot]';
// A genuine self-fix / auto-fix head branch (the only heads the loop ever opens).
const SELFFIX_HEAD_RE = /^oil-(selffix|autofix)\//;

// Pure predicate (no I/O) — is this PR a genuine, mergeable self-fix PR? Exported
// for unit testing. Every condition must hold; any miss ⇒ refuse (fail-closed).
export function isMergeableSelffixPr(pr: {
  state: string;
  baseRef: string;
  headRef: string;
  authorLogin: string;
  systemName: string;
}): boolean {
  return (
    pr.systemName === MERGE_ALLOWED_SYSTEM &&
    pr.state === 'open' &&
    pr.baseRef === 'main' &&
    SELFFIX_HEAD_RE.test(pr.headRef) &&
    pr.authorLogin === EXPECTED_SELFFIX_AUTHOR
  );
}

// secret/iam/sync are GCP actions handled by the value-free fulfiller; promote
// is a GitHub action (opens a draft PR on the factory template) handled by a
// separate workflow with GitHub-write capability. Both phases (register/fulfill)
// of a request route to the same workflow, chosen here by type.
function fulfillWorkflowFor(requestType: string): string {
  return requestType === 'promote' ? PROMOTE_WORKFLOW : FULFILL_WORKFLOW;
}

// callback_data tags. The issue identifier (e.g. "OPS-42") is the only payload —
// it never contains a colon, so splitting is unambiguous and the value is tiny.
const APPROVE_PREFIX = 'sysreq:';
const REJECT_PREFIX = 'sysno:';

// A Linear issue identifier: TEAM-123. Restricting the shape keeps callback_data
// safe and means a crafted value can never become anything but an issue lookup.
const ISSUE_ID_RE = /^[A-Z][A-Z0-9]*-[0-9]+$/;

export interface SystemRequestResult {
  status: number;
  body: Record<string, unknown>;
}

// Parse the `event.body` request fields out of a Linear issue description (the
// observability pipeline embeds the OTel JSON in a ```json fenced block). Local
// so this module has no dependency on oil-autofix.ts (no import cycle).
function parseRequestFromDescription(
  description: string | null | undefined,
): {
  requestType: string;
  systemName: string;
  secretName: string;
  role: string;
  members: string;
  sourcePath: string;
  targetPath: string;
  reason: string;
} | null {
  if (!description) return null;
  const fenced = description.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenced && fenced[1] ? fenced[1] : description;
  let otel: Record<string, unknown>;
  try {
    const parsed = JSON.parse(candidate.trim()) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    otel = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const body = (otel['event.body'] ?? {}) as Record<string, unknown>;
  const requestType = String(body['request_type'] ?? '');
  if (requestType !== 'secret' && requestType !== 'iam' && requestType !== 'sync' && requestType !== 'promote')
    return null;
  return {
    requestType,
    systemName: String(otel['factory.system_name'] ?? body['system_name'] ?? ''),
    secretName: String(body['secret_name'] ?? ''),
    role: String(body['role'] ?? ''),
    members: String(body['members'] ?? ''),
    sourcePath: String(body['source_path'] ?? ''),
    targetPath: String(body['target_path'] ?? ''),
    reason: String(body['reason'] ?? ''),
  };
}

// Pure decoder for a button's callback_data. Exported for unit testing. Returns
// null for anything that isn't one of our two well-formed tags.
export function parseSystemRequestCallback(
  data: string,
): { action: 'approve' | 'reject'; issueId: string } | null {
  let action: 'approve' | 'reject';
  let issueId: string;
  if (data.startsWith(APPROVE_PREFIX)) {
    action = 'approve';
    issueId = data.slice(APPROVE_PREFIX.length);
  } else if (data.startsWith(REJECT_PREFIX)) {
    action = 'reject';
    issueId = data.slice(REJECT_PREFIX.length);
  } else {
    return null;
  }
  if (!ISSUE_ID_RE.test(issueId)) return null;
  return { action, issueId };
}

// Is this callback_data one of ours? Lets index.ts route without importing the
// prefixes.
export function isSystemRequestCallback(data: string): boolean {
  return data.startsWith(APPROVE_PREFIX) || data.startsWith(REJECT_PREFIX);
}

// Telegram approver allowlist — the SAME operator who approves OIL fixes, so the
// channel reuses the OIL approver allowlist env. Closed by default.
function allowedUserIds(): Set<string> {
  const raw = process.env.OIL_APPROVER_TELEGRAM_ALLOWLIST ?? '';
  if (raw === '__NOT_CONFIGURED__') return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

type Outcome =
  | 'dispatched'
  | 'skipped'
  | 'dispatch_failed'
  | 'registered'
  | 'approved'
  | 'rejected'
  | 'unauthorized'
  | 'recover_failed'
  | 'merged'
  | 'merge_refused'
  | 'merge_failed';

async function emitSysReq(outcome: Outcome, issue: string, reason: string, system?: string): Promise<void> {
  try {
    await emitEvent({
      name: `factory.system_request.${outcome}`,
      severity:
        outcome === 'dispatch_failed' || outcome === 'recover_failed' || outcome === 'merge_failed'
          ? 'warning'
          : 'info',
      layer: 'factory',
      system: system || undefined,
      workflow: 'mcp:system-request',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { issue, reason },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Called from handleLinearWebhook when a `system.request.*` ticket lands. Pulls
// the request fields out of the already-parsed OTel object and dispatches the
// fulfillment workflow's REGISTER phase (which sends the approval card). The
// `otel` arg is passed in by the caller so this module needs no extractOtel.
export async function dispatchSystemRequest(
  otel: Record<string, unknown> | null,
  identifier: string,
): Promise<SystemRequestResult> {
  if (!identifier) {
    await emitSysReq('skipped', '(none)', 'no-identifier');
    return { status: 200, body: { triage: 'skip', reason: 'no-identifier' } };
  }
  const body = (otel?.['event.body'] ?? {}) as Record<string, unknown>;
  const requestType = String(body['request_type'] ?? '');
  const systemName = String(otel?.['factory.system_name'] ?? body['system_name'] ?? '');

  // merge is card-free — handle it here and return BEFORE the card-path guard
  // below, so a `merge` can never reach registerSystemRequest (no Telegram card)
  // or the ✅-callback fulfiller. The human ✅ already happened system-side; this
  // path only performs the approver merge (author≠approver). See consts above.
  if (requestType === 'merge') {
    return handleMergeRequest(systemName, body, identifier);
  }

  if (requestType !== 'secret' && requestType !== 'iam' && requestType !== 'sync' && requestType !== 'promote') {
    await emitSysReq('skipped', identifier, `bad-request-type:${requestType}`, systemName);
    return { status: 200, body: { triage: 'skip', reason: 'bad-request-type' } };
  }
  if (!systemName) {
    await emitSysReq('skipped', identifier, 'no-system-name');
    return { status: 200, body: { triage: 'skip', reason: 'no-system-name' } };
  }
  // Build inputs per type — each workflow declares only its own inputs, so a
  // stray field would make the dispatch fail. promote → the PR-opening workflow.
  const registerInputs: Record<string, string> =
    requestType === 'promote'
      ? {
          phase: 'register',
          request_type: requestType,
          system_name: systemName,
          source_path: String(body['source_path'] ?? ''),
          target_path: String(body['target_path'] ?? ''),
          issue_id: identifier,
          reason: String(body['reason'] ?? ''),
        }
      : {
          phase: 'register',
          request_type: requestType,
          system_name: systemName,
          secret_name: String(body['secret_name'] ?? ''),
          role: String(body['role'] ?? ''),
          members: String(body['members'] ?? ''),
          issue_id: identifier,
          reason: String(body['reason'] ?? ''),
        };
  try {
    await dispatchWorkflow(
      fulfillWorkflowFor(requestType),
      'main',
      registerInputs,
      OWNER,
      FACTORY_REPO,
    );
    await emitSysReq('dispatched', identifier, requestType, systemName);
    return { status: 200, body: { triage: 'dispatch', issue: identifier, request_type: requestType } };
  } catch (e) {
    await emitSysReq('dispatch_failed', identifier, String(e).slice(0, 160), systemName);
    return { status: 200, body: { triage: 'dispatch_failed', issue: identifier, detail: String(e).slice(0, 200) } };
  }
}

// The card-free merge handler. Verifies the or-aios self-fix PR is genuine +
// still open, then merges it as the SEPARATE approver App (author≠approver).
// Reading the PR uses the BROKER (apiGet); the merge uses the approver identity
// (mergePullRequestAsApprover) — two distinct Apps, so the approver never reads
// nor authored, it only merges. Always returns 200 and never throws (the whole
// bridge is soft-fail; a bad request is logged and dropped, never merged).
async function handleMergeRequest(
  systemName: string,
  body: Record<string, unknown>,
  identifier: string,
): Promise<SystemRequestResult> {
  // Pin 1: only or-aios may drive the approver merge (MVP scope; fail-closed).
  if (systemName !== MERGE_ALLOWED_SYSTEM) {
    await emitSysReq('merge_refused', identifier || '(none)', `system-not-allowed:${systemName}`, systemName);
    return { status: 200, body: { triage: 'merge_refused', reason: 'system-not-allowed' } };
  }
  // pr_number must be a positive integer (it arrives as a JSON number in the body).
  const prRaw = body['pr_number'];
  const prNumber = typeof prRaw === 'number' ? prRaw : Number(prRaw);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    await emitSysReq('merge_refused', identifier || '(none)', `bad-pr-number:${String(prRaw)}`, systemName);
    return { status: 200, body: { triage: 'merge_refused', reason: 'bad-pr-number' } };
  }

  // Read the PR via the BROKER (org-installed read). If the PR can't be read we
  // never merge blind — refuse.
  let pr: {
    state?: string;
    base?: { ref?: string };
    head?: { ref?: string };
    user?: { login?: string };
  };
  try {
    pr = (await apiGet(`/pulls/${prNumber}`, OWNER, MERGE_ALLOWED_SYSTEM)) as typeof pr;
  } catch (e) {
    await emitSysReq('merge_failed', identifier, `pr-read:${String(e).slice(0, 120)}`, systemName);
    return { status: 200, body: { triage: 'merge_failed', reason: 'pr-read', detail: String(e).slice(0, 160) } };
  }

  const check = {
    state: String(pr.state ?? ''),
    baseRef: String(pr.base?.ref ?? ''),
    headRef: String(pr.head?.ref ?? ''),
    authorLogin: String(pr.user?.login ?? ''),
    systemName,
  };
  // Pins 2+3 (branch shape + author) + open-state, all in the pure predicate.
  if (!isMergeableSelffixPr(check)) {
    await emitSysReq(
      'merge_refused',
      identifier,
      `pr-guard state=${check.state} base=${check.baseRef} head=${check.headRef} author=${check.authorLogin}`,
      systemName,
    );
    return { status: 200, body: { triage: 'merge_refused', reason: 'pr-guard', pr: prNumber } };
  }

  // Merge as the approver App. Green-CI is enforced by branch protection via
  // native auto-merge inside the helper; it never throws (returns a MergeResult).
  const result = await mergePullRequestAsApprover(prNumber, 'SQUASH', OWNER, MERGE_ALLOWED_SYSTEM);
  if (result.merged || result.pending) {
    await emitSysReq(
      'merged',
      identifier,
      result.pending ? `pr#${prNumber} auto-merge armed (merges when green)` : `pr#${prNumber} merged`,
      systemName,
    );
    return { status: 200, body: { triage: 'merged', pr: prNumber, pending: result.pending ?? false, sha: result.sha } };
  }
  await emitSysReq('merge_failed', identifier, `merge status=${result.status} ${result.message ?? ''}`.slice(0, 140), systemName);
  return { status: 200, body: { triage: 'merge_failed', pr: prNumber, status: result.status, detail: result.message } };
}

// Called by fulfill-system-request.yml (register phase, admin-gated in index.ts).
// Sends Or one Telegram card describing the request, with ✅/❌ buttons carrying
// the Linear issue identifier.
export async function registerSystemRequest(input: {
  request_type: string;
  system_name: string;
  gcp_project: string;
  secret_name?: string;
  role?: string;
  source_path?: string;
  target_path?: string;
  issue_id: string;
  reason?: string;
}): Promise<SystemRequestResult> {
  const { request_type: type, system_name: sys, gcp_project: proj, issue_id: issue } = input;
  if (type !== 'secret' && type !== 'iam' && type !== 'sync' && type !== 'promote')
    return { status: 400, body: { error: 'bad_request_type' } };
  if (!ISSUE_ID_RE.test(issue)) return { status: 400, body: { error: 'bad_issue_id' } };

  let actionLine: string;
  if (type === 'secret') {
    actionLine = `סוד חדש: \`${input.secret_name ?? ''}\` (גישת קריאה ל-deploy-sa+runtime-sa)`;
  } else if (type === 'iam') {
    actionLine = `הרשאה: \`${input.role ?? ''}\` ל-deploy-sa+runtime-sa`;
  } else if (type === 'sync') {
    actionLine = `סנכרון ערך סוד משותף: \`${input.secret_name ?? ''}\` (משיכת הערך העדכני מ-control)`;
  } else {
    actionLine =
      `קידום מסמך לתבנית הפקטורי (PR-טיוטה):\n` +
      `\`${input.source_path ?? ''}\` → \`${input.target_path ?? ''}\``;
  }
  // promote is GitHub-only (no GCP project); omit the project line for it.
  const projectLine = type === 'promote' || !proj ? '' : `פרויקט: ${proj}\n`;
  const text =
    `🔑 בקשת משאב ממערכת — דרוש אישור\n` +
    `מערכת: ${sys}\n` +
    projectLine +
    `${actionLine}\n` +
    (input.reason ? `סיבה: ${input.reason}\n` : '') +
    `תיק: ${issue}\n\n` +
    `אשר/דחה כאן:`;
  const buttons: InlineButton[] = [
    { text: '✅ אישור', callback_data: `${APPROVE_PREFIX}${issue}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${issue}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitSysReq('skipped', issue, `telegram-${sent.status}`, sys);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitSysReq('registered', issue, `${type} (${sys})`, sys);
  return { status: 200, body: { ok: true, issue, message_id: sent.messageId ?? null } };
}

// Inbound Telegram callback (a button press) for a system request. The
// secret_token header is verified in index.ts before this runs. Authorises the
// presser, recovers the request from the Linear issue, and (✅) dispatches the
// fulfill phase. Always 200 so Telegram does not retry.
export async function handleSystemRequestCallback(req: Request): Promise<SystemRequestResult> {
  const update = (req.body ?? {}) as Record<string, unknown>;
  const cq = update['callback_query'] as Record<string, unknown> | undefined;
  if (!cq) return { status: 200, body: { ignored: 'no_callback_query' } };

  const callbackId = String(cq['id'] ?? '');
  const data = String(cq['data'] ?? '');
  const from = (cq['from'] ?? {}) as Record<string, unknown>;
  const fromId = String(from['id'] ?? '');
  const message = (cq['message'] ?? {}) as Record<string, unknown>;
  const chat = (message['chat'] ?? {}) as Record<string, unknown>;
  const chatId = chat['id'];
  const messageId = Number(message['message_id'] ?? 0);

  if (!(fromId.length > 0 && allowedUserIds().has(fromId))) {
    await answerCallbackQuery(callbackId, 'אינך מורשה לאשר.');
    await emitSysReq('unauthorized', 'n/a', `from_id=${fromId}`);
    return { status: 200, body: { unauthorized: true } };
  }

  const decoded = parseSystemRequestCallback(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, issueId } = decoded;

  if (action === 'reject') {
    await answerCallbackQuery(callbackId, '❌ נדחתה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ בקשת המשאב (${issueId}) נדחתה — לא בוצע דבר.`);
    }
    await emitSysReq('rejected', issueId, 'rejected by operator');
    return { status: 200, body: { action: 'reject', issue: issueId } };
  }

  // approve → answer first (Telegram's callback window is short), then recover
  // the request from Linear and dispatch the fulfill phase.
  await answerCallbackQuery(callbackId, '⏳ מאשר ומבצע…');

  const apiKey = await readSecretSoft('linear-api-key');
  let recovered: ReturnType<typeof parseRequestFromDescription> = null;
  if (apiKey) {
    try {
      const r = await linearGql<{ issue: { description: string | null } | null }>(
        apiKey,
        'query($id:String!){ issue(id:$id){ description } }',
        { id: issueId },
      );
      recovered = parseRequestFromDescription(r.issue?.description ?? null);
    } catch {
      recovered = null;
    }
  }
  if (!recovered) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${issueId}: לא ניתן לשחזר את פרטי הבקשה — לא בוצע.`);
    }
    await emitSysReq('recover_failed', issueId, 'could not recover request from Linear');
    return { status: 200, body: { action: 'approve', issue: issueId, dispatched: false, detail: 'recover_failed' } };
  }

  const fulfillInputs: Record<string, string> =
    recovered.requestType === 'promote'
      ? {
          phase: 'fulfill',
          request_type: recovered.requestType,
          system_name: recovered.systemName,
          source_path: recovered.sourcePath,
          target_path: recovered.targetPath,
          issue_id: issueId,
          reason: recovered.reason,
        }
      : {
          phase: 'fulfill',
          request_type: recovered.requestType,
          system_name: recovered.systemName,
          secret_name: recovered.secretName,
          role: recovered.role,
          members: recovered.members,
          issue_id: issueId,
          reason: recovered.reason,
        };
  try {
    await dispatchWorkflow(
      fulfillWorkflowFor(recovered.requestType),
      'main',
      fulfillInputs,
      OWNER,
      FACTORY_REPO,
    );
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ ${issueId} אושר — מבצע (תקבל אישור בסיום).`);
    }
    await emitSysReq('approved', issueId, `${recovered.requestType} (${recovered.systemName})`, recovered.systemName);
    return { status: 200, body: { action: 'approve', issue: issueId, dispatched: true } };
  } catch (e) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${issueId}: שגיאה בהפעלת המימוש — נסה שוב.`);
    }
    await emitSysReq('dispatch_failed', issueId, String(e).slice(0, 160), recovered.systemName);
    return { status: 200, body: { action: 'approve', issue: issueId, dispatched: false, detail: String(e).slice(0, 200) } };
  }
}
