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
import { dispatchWorkflow } from './github-client.js';
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
): { requestType: string; systemName: string; secretName: string; role: string; members: string; reason: string } | null {
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
  if (requestType !== 'secret' && requestType !== 'iam') return null;
  return {
    requestType,
    systemName: String(otel['factory.system_name'] ?? body['system_name'] ?? ''),
    secretName: String(body['secret_name'] ?? ''),
    role: String(body['role'] ?? ''),
    members: String(body['members'] ?? ''),
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

type Outcome = 'dispatched' | 'skipped' | 'dispatch_failed' | 'registered' | 'approved' | 'rejected' | 'unauthorized' | 'recover_failed';

async function emitSysReq(outcome: Outcome, issue: string, reason: string, system?: string): Promise<void> {
  try {
    await emitEvent({
      name: `factory.system_request.${outcome}`,
      severity: outcome === 'dispatch_failed' || outcome === 'recover_failed' ? 'warning' : 'info',
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
  if (requestType !== 'secret' && requestType !== 'iam') {
    await emitSysReq('skipped', identifier, `bad-request-type:${requestType}`, systemName);
    return { status: 200, body: { triage: 'skip', reason: 'bad-request-type' } };
  }
  if (!systemName) {
    await emitSysReq('skipped', identifier, 'no-system-name');
    return { status: 200, body: { triage: 'skip', reason: 'no-system-name' } };
  }
  try {
    await dispatchWorkflow(
      FULFILL_WORKFLOW,
      'main',
      {
        phase: 'register',
        request_type: requestType,
        system_name: systemName,
        secret_name: String(body['secret_name'] ?? ''),
        role: String(body['role'] ?? ''),
        members: String(body['members'] ?? ''),
        issue_id: identifier,
        reason: String(body['reason'] ?? ''),
      },
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

// Called by fulfill-system-request.yml (register phase, admin-gated in index.ts).
// Sends Or one Telegram card describing the request, with ✅/❌ buttons carrying
// the Linear issue identifier.
export async function registerSystemRequest(input: {
  request_type: string;
  system_name: string;
  gcp_project: string;
  secret_name?: string;
  role?: string;
  issue_id: string;
  reason?: string;
}): Promise<SystemRequestResult> {
  const { request_type: type, system_name: sys, gcp_project: proj, issue_id: issue } = input;
  if (type !== 'secret' && type !== 'iam') return { status: 400, body: { error: 'bad_request_type' } };
  if (!ISSUE_ID_RE.test(issue)) return { status: 400, body: { error: 'bad_issue_id' } };

  const actionLine =
    type === 'secret'
      ? `סוד חדש: \`${input.secret_name ?? ''}\` (גישת קריאה ל-deploy-sa+runtime-sa)`
      : `הרשאה: \`${input.role ?? ''}\` ל-deploy-sa+runtime-sa`;
  const text =
    `🔑 בקשת משאב ממערכת — דרוש אישור\n` +
    `מערכת: ${sys}\n` +
    `פרויקט: ${proj}\n` +
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

  try {
    await dispatchWorkflow(
      FULFILL_WORKFLOW,
      'main',
      {
        phase: 'fulfill',
        request_type: recovered.requestType,
        system_name: recovered.systemName,
        secret_name: recovered.secretName,
        role: recovered.role,
        members: recovered.members,
        issue_id: issueId,
        reason: recovered.reason,
      },
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
