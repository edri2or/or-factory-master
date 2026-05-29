// OIL auto-fix — the approval bridge (stages 4+5, merged). After the read-only
// investigator + guarded fixer opens a DRAFT PR (the broker App's identity), the
// workflow calls /oil-approval-register here; this sends Or ONE Telegram message
// with ✅/❌ inline buttons. When Or taps a button Telegram POSTs /telegram-webhook
// and handleTelegramCallback runs: it authorises the presser (secret_token header
// is checked in index.ts; the from.id allowlist is checked here), then MERGES the
// PR as the SEPARATE oil-autofix-approver App (✅) or closes it (❌).
//
// Two-identity invariant: the broker opens the PR, the approver merges it — the
// same principal can never both author and approve. GitHub Environment required-
// reviewers (the original design) are Enterprise-only for private repos, so this
// application-level gate replaces them.
//
// State-free by design: the target repo + PR number travel inside the button's
// callback_data (`oilapprove:<repo>:<pr>` / `oilreject:<repo>:<pr>`, well under
// Telegram's 64-byte cap — system names are ≤30 chars), so a Cloud Run instance
// swap can never lose a pending approval. The repo segment is what lets the loop
// merge a fix in a SYSTEM repo, not only the factory (Stage 83); the legacy
// two-segment form (`oilapprove:<pr>`) still decodes to the factory repo. Every
// step is soft-fail and the webhook always answers 200 so Telegram never
// retry-storms.

import type { Request } from 'express';
import {
  approverConfigured,
  mergePullRequestAsApprover,
  closePullRequestAsApprover,
  dispatchWorkflow,
} from './github-client.js';
import {
  emitEvent,
  sendTelegramKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  type InlineButton,
} from './observability-client.js';

const OWNER = 'edri2or';
// The factory's own repo — the default target when a callback carries no repo
// segment (legacy two-segment form) and the repo a registration omits one.
const DEFAULT_REPO = 'or-factory-master';

// A safe GitHub repo-name shape. The factory (`or-factory-master`) and every
// system_name (`^[a-z][a-z0-9-]{4,28}[a-z0-9]$`) match this; a colon can never
// appear, so splitting callback_data on ':' is unambiguous, and a crafted value
// can never inject anything else into the merge target.
const REPO_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

// callback_data tags. Kept short (<<64 bytes) and namespaced so the handler only
// ever acts on its own buttons.
const APPROVE_PREFIX = 'oilapprove:';
const REJECT_PREFIX = 'oilreject:';

export interface ApprovalResult {
  status: number;
  body: Record<string, unknown>;
}

// Pure decoder for a button's callback_data. Exported so it can be unit-tested
// without the Telegram/GitHub side effects. Returns null for anything that isn't
// one of our two well-formed tags with a positive integer PR number.
//
// Two accepted shapes, after the prefix:
//   * `<repo>:<pr>`  (Stage 83) → that repo is the merge target,
//   * `<pr>`         (legacy)   → the factory repo (DEFAULT_REPO).
// The repo segment must match REPO_RE (so a malformed/hostile value is rejected,
// never silently merged somewhere unexpected).
export function parseCallbackData(
  data: string,
): { action: 'approve' | 'reject'; repo: string; pr: number } | null {
  let action: 'approve' | 'reject';
  let rest: string;
  if (data.startsWith(APPROVE_PREFIX)) {
    action = 'approve';
    rest = data.slice(APPROVE_PREFIX.length);
  } else if (data.startsWith(REJECT_PREFIX)) {
    action = 'reject';
    rest = data.slice(REJECT_PREFIX.length);
  } else {
    return null;
  }

  // Split off an optional repo segment. system_name / the factory never contain
  // a colon, so a single ':' cleanly separates <repo> from <pr>.
  let repo = DEFAULT_REPO;
  let prRaw = rest;
  const sep = rest.indexOf(':');
  if (sep >= 0) {
    repo = rest.slice(0, sep);
    prRaw = rest.slice(sep + 1);
    if (!REPO_RE.test(repo)) return null;
  }

  // Reject non-integer / non-positive / trailing-garbage forms ("12x", "", "-1").
  if (!/^[0-9]+$/.test(prRaw)) return null;
  const pr = Number(prRaw);
  if (!Number.isInteger(pr) || pr <= 0) return null;
  return { action, repo, pr };
}

// Is this Telegram user id permitted to approve? Exported for unit testing.
export function isAllowed(fromId: string, allowlist: Set<string>): boolean {
  return fromId.length > 0 && allowlist.has(fromId);
}

type ApprovalOutcome = 'registered' | 'register_failed' | 'approved' | 'rejected' | 'merge_failed' | 'unauthorized';

// Soft-fail observability trail, mirroring oil-autofix.ts:emitOil. Non-actionable
// for routine outcomes; warning only when a merge the human asked for fails (that
// genuinely needs a look). Never opens a Linear issue about a normal approve/reject.
async function emitApproval(
  outcome: ApprovalOutcome,
  prNumber: number | string,
  reason: string,
): Promise<void> {
  try {
    await emitEvent({
      name: `factory.oil_approval.${outcome}`,
      severity: outcome === 'merge_failed' ? 'warning' : 'info',
      layer: 'factory',
      workflow: 'mcp:telegram-approval',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { pr: prNumber, reason },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Parse the allowlist of Telegram user ids permitted to approve. CSV in
// OIL_APPROVER_TELEGRAM_ALLOWLIST (e.g. "12345678,87654321"). Empty/absent or the
// deploy placeholder → nobody is allowed (closed by default).
function allowedUserIds(): Set<string> {
  const raw = process.env.OIL_APPROVER_TELEGRAM_ALLOWLIST ?? '';
  if (raw === '__NOT_CONFIGURED__') return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Called by the workflow (admin-gated in index.ts) right after it opens a DRAFT
// PR. Sends Or one Telegram message with ✅/❌ buttons carrying the target repo +
// PR number. `repo` defaults to the factory when the caller omits it (so a
// pre-Stage-83 caller keeps working unchanged); a system repo (Stage 83) is
// embedded in the button data so the eventual merge targets that repo.
export async function registerApproval(input: {
  pr_number: number;
  issue_id?: string;
  pr_url?: string;
  repo?: string;
}): Promise<ApprovalResult> {
  const pr = input.pr_number;
  if (!Number.isInteger(pr) || pr <= 0) {
    return { status: 400, body: { error: 'bad_pr_number' } };
  }
  // Validate the repo segment up-front: it ends up inside callback_data and later
  // becomes a merge target, so a malformed value must be refused here, not merged.
  const repo = input.repo && input.repo.length > 0 ? input.repo : DEFAULT_REPO;
  if (!REPO_RE.test(repo)) {
    return { status: 400, body: { error: 'bad_repo' } };
  }
  if (!approverConfigured()) {
    // The bridge is dormant until the approver App credentials are mounted.
    await emitApproval('register_failed', pr, 'approver-not-configured');
    return { status: 503, body: { error: 'approver_not_configured' } };
  }

  const issue = input.issue_id ? `${input.issue_id}` : 'OIL';
  // Show Or which repo the fix lands in (the factory or a named system).
  const repoLine = repo === DEFAULT_REPO ? `מאגר: הפקטורי` : `מערכת: ${repo}`;
  const text =
    `🔧 OIL auto-fix — תיקון מוכן לאישור\n` +
    `תיק: ${issue}\n` +
    `${repoLine}\n` +
    `PR #${pr}${input.pr_url ? `\n${input.pr_url}` : ''}\n\n` +
    `אשר/דחה כאן:`;
  const buttons: InlineButton[] = [
    { text: '✅ אישור ומיזוג', callback_data: `${APPROVE_PREFIX}${repo}:${pr}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${repo}:${pr}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitApproval('register_failed', pr, `telegram-${sent.status}`);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitApproval('registered', pr, `${issue} (${repo})`);
  return { status: 200, body: { ok: true, pr, repo, message_id: sent.messageId ?? null } };
}

// Inbound Telegram callback (a button press). The secret_token header is verified
// in index.ts BEFORE this runs; here we authorise the presser (from.id allowlist)
// and act on the PR number carried in callback_data. Always returns 200 so
// Telegram does not retry; the real outcome is in the body + observability.
export async function handleTelegramCallback(req: Request): Promise<ApprovalResult> {
  const update = (req.body ?? {}) as Record<string, unknown>;
  const cq = update['callback_query'] as Record<string, unknown> | undefined;
  if (!cq) {
    // Not a callback (e.g. a plain message) — nothing to do, acknowledge 200.
    return { status: 200, body: { ignored: 'no_callback_query' } };
  }

  const callbackId = String(cq['id'] ?? '');
  const data = String(cq['data'] ?? '');
  const from = (cq['from'] ?? {}) as Record<string, unknown>;
  const fromId = String(from['id'] ?? '');
  const message = (cq['message'] ?? {}) as Record<string, unknown>;
  const chat = (message['chat'] ?? {}) as Record<string, unknown>;
  const chatId = chat['id'];
  const messageId = Number(message['message_id'] ?? 0);

  // Authorise the presser. secret_token (proves the request is from Telegram) is
  // already verified upstream; this is the SECOND layer — only allow-listed users.
  if (!isAllowed(fromId, allowedUserIds())) {
    await answerCallbackQuery(callbackId, 'אינך מורשה לאשר.');
    await emitApproval('unauthorized', 'n/a', `from_id=${fromId}`);
    return { status: 200, body: { unauthorized: true } };
  }

  // Decode action + target repo + PR number from the button itself (no
  // server-side lookup). `repo` is the factory for legacy two-segment buttons.
  const decoded = parseCallbackData(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, repo, pr } = decoded;

  if (action === 'reject') {
    const r = await closePullRequestAsApprover(pr, OWNER, repo);
    await answerCallbackQuery(callbackId, r.status && r.message ? `שגיאה: ${r.message}` : '❌ נדחה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ PR #${pr} נדחה (לא מוזג).`);
    }
    await emitApproval('rejected', pr, `${repo}: ${r.message ?? 'closed'}`);
    return { status: 200, body: { action: 'reject', repo, pr, closed: r.status === 200 } };
  }

  // approve → merge as the approver App.
  // Answer the callback FIRST (Telegram's callback-answer window is short).
  // Answering immediately stops Telegram from retrying the webhook (which
  // previously caused duplicate merge attempts / duplicate merge_failed events).
  await answerCallbackQuery(callbackId, '⏳ מאשר…');

  const r = await mergePullRequestAsApprover(pr, 'SQUASH', OWNER, repo);

  // Merged synchronously (the PR was already green when ✅ was tapped).
  if (r.merged) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ PR #${pr} אושר ומוזג.`);
    }
    await emitApproval('approved', pr, r.sha ? `${repo}: merged ${r.sha.slice(0, 7)}` : `${repo}: merged`);
    // Stage 83 — cross-repo post-merge verify. The factory's own merges fire
    // oil-autofix-verify.yml via push:main, but a SYSTEM merge lands on the
    // system's main, which the factory never observes. So on a confirmed
    // synchronous merge of a system PR, dispatch the factory's verify workflow
    // (broker identity, org-wide actions:write) pointed at that system; verify
    // recovers the issue id + reproducer from the system's merge commit itself.
    // Soft-fail — a dispatch hiccup must never break the approval reply.
    if (repo !== DEFAULT_REPO) {
      await dispatchWorkflow(
        'oil-autofix-verify.yml',
        'main',
        { repo, pr_number: String(pr) },
        OWNER,
        DEFAULT_REPO,
      ).catch(() => undefined);
    }
    return { status: 200, body: { action: 'approve', repo, pr, merged: true, sha: r.sha ?? null } };
  }

  // Auto-merge armed: GitHub will merge once the required CI checks pass. This is
  // the normal path when ✅ is tapped while checks are still running.
  if (r.pending) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ PR #${pr} אושר — יתמזג אוטומטית כשכל הבדיקות ירוקות.`);
    }
    await emitApproval('approved', pr, 'auto-merge armed (merges when checks pass)');
    return { status: 200, body: { action: 'approve', pr, merged: false, pending: true } };
  }

  // Could neither merge nor arm auto-merge (e.g. conflict, or branch protection
  // rejected a red PR). Tell Or; leave the PR open.
  if (messageId && chatId != null) {
    await editTelegramMessage(chatId as string | number, messageId, `⚠️ PR #${pr}: לא מוזג — ${r.message ?? r.status}. ה-PR נשאר פתוח.`);
  }
  await emitApproval('merge_failed', pr, r.message ?? `http ${r.status}`);
  return { status: 200, body: { action: 'approve', pr, merged: false, detail: r.message ?? null } };
}
