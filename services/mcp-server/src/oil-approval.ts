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
// State-free by design: the PR number travels inside the button's callback_data
// (`oilapprove:<pr>` / `oilreject:<pr>`, well under Telegram's 64-byte cap), so a
// Cloud Run instance swap can never lose a pending approval. Every step is
// soft-fail and the webhook always answers 200 so Telegram never retry-storms.

import type { Request } from 'express';
import {
  approverConfigured,
  mergePullRequestAsApprover,
  closePullRequestAsApprover,
} from './github-client.js';
import {
  emitEvent,
  sendTelegramKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  type InlineButton,
} from './observability-client.js';

const OWNER = 'edri2or';
const REPO = 'or-factory-master';

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
export function parseCallbackData(data: string): { action: 'approve' | 'reject'; pr: number } | null {
  let action: 'approve' | 'reject';
  let prRaw: string;
  if (data.startsWith(APPROVE_PREFIX)) {
    action = 'approve';
    prRaw = data.slice(APPROVE_PREFIX.length);
  } else if (data.startsWith(REJECT_PREFIX)) {
    action = 'reject';
    prRaw = data.slice(REJECT_PREFIX.length);
  } else {
    return null;
  }
  // Reject non-integer / non-positive / trailing-garbage forms ("12x", "", "-1").
  if (!/^[0-9]+$/.test(prRaw)) return null;
  const pr = Number(prRaw);
  if (!Number.isInteger(pr) || pr <= 0) return null;
  return { action, pr };
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
// PR. Sends Or one Telegram message with ✅/❌ buttons carrying the PR number.
export async function registerApproval(input: {
  pr_number: number;
  issue_id?: string;
  pr_url?: string;
}): Promise<ApprovalResult> {
  const pr = input.pr_number;
  if (!Number.isInteger(pr) || pr <= 0) {
    return { status: 400, body: { error: 'bad_pr_number' } };
  }
  if (!approverConfigured()) {
    // The bridge is dormant until the approver App credentials are mounted.
    await emitApproval('register_failed', pr, 'approver-not-configured');
    return { status: 503, body: { error: 'approver_not_configured' } };
  }

  const issue = input.issue_id ? `${input.issue_id}` : 'OIL';
  const text =
    `🔧 OIL auto-fix — תיקון מוכן לאישור\n` +
    `תיק: ${issue}\n` +
    `PR #${pr}${input.pr_url ? `\n${input.pr_url}` : ''}\n\n` +
    `אשר/דחה כאן:`;
  const buttons: InlineButton[] = [
    { text: '✅ אישור ומיזוג', callback_data: `${APPROVE_PREFIX}${pr}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${pr}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitApproval('register_failed', pr, `telegram-${sent.status}`);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitApproval('registered', pr, issue);
  return { status: 200, body: { ok: true, pr, message_id: sent.messageId ?? null } };
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

  // Decode action + PR number from the button itself (no server-side lookup).
  const decoded = parseCallbackData(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, pr } = decoded;

  if (action === 'reject') {
    const r = await closePullRequestAsApprover(pr, OWNER, REPO);
    await answerCallbackQuery(callbackId, r.status && r.message ? `שגיאה: ${r.message}` : '❌ נדחה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ PR #${pr} נדחה (לא מוזג).`);
    }
    await emitApproval('rejected', pr, r.message ?? 'closed');
    return { status: 200, body: { action: 'reject', pr, closed: r.status === 200 } };
  }

  // approve → merge as the approver App.
  const r = await mergePullRequestAsApprover(pr, 'squash', OWNER, REPO);
  if (r.merged) {
    await answerCallbackQuery(callbackId, '✅ מוזג');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ PR #${pr} אושר ומוזג.`);
    }
    await emitApproval('approved', pr, r.sha ? `merged ${r.sha.slice(0, 7)}` : 'merged');
    return { status: 200, body: { action: 'approve', pr, merged: true, sha: r.sha ?? null } };
  }

  // Merge failed (e.g. CI not green, conflict). Tell Or; leave the PR open.
  await answerCallbackQuery(callbackId, `מיזוג נכשל: ${r.message ?? r.status}`);
  await emitApproval('merge_failed', pr, r.message ?? `http ${r.status}`);
  return { status: 200, body: { action: 'approve', pr, merged: false, detail: r.message ?? null } };
}
