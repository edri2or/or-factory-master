// Repo-deletion gate — the Telegram approval bridge (a sibling of gcp-approval.ts).
// The agent can only PROPOSE a deletion: propose-repo-delete.yml calls
// /repo-delete-register here, which sends Or ONE Telegram ✅/❌ card listing the
// repos. The deletion runs ONLY inside handleRepoApprovalCallback when Or taps ✅
// — i.e. only on a webhook whose secret_token is verified (index.ts) AND whose
// presser is allow-listed. There is NO dispatchable execute path, so the agent
// can never trigger a deletion without Or's tap. Same AI-proposes / human-approves
// invariant as OIL, the GCP gate, and the system-request channel.
//
// State-free: the repo list travels INSIDE the card's own message text (between
// the ⟦RM⟧…⟦/RM⟧ sentinels), echoed back by Telegram in the callback — so a Cloud
// Run instance swap can never lose a pending approval, with no DB/issue state. The
// button's callback_data carries only a short correlation id (`rmok:`/`rmno:`).
// Deletion itself is hard-guarded in github-client.deleteRepoAsBroker (refuses
// or-factory-master + the ALWAYS_KEEP set). Every step is soft-fail; the webhook
// always answers 200 so Telegram never retry-storms.

import type { Request } from 'express';
import { deleteRepoAsBroker } from './github-client.js';
import {
  emitEvent,
  sendTelegramKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  type InlineButton,
} from './observability-client.js';

// Repos that can NEVER be proposed for deletion (the survivor + future protected).
// Mirrors github-client's ALWAYS_KEEP_REPOS — refused here too, at propose time.
const PROTECTED = new Set<string>(['or-factory-master']);

// A valid GitHub repo name (case-insensitive). Keeps callback/card content safe.
const REPO_RE = /^[a-z0-9][a-z0-9._-]{0,99}$/i;
const CORR_RE = /^[A-Za-z0-9-]{1,40}$/;

const APPROVE_PREFIX = 'rmok:';
const REJECT_PREFIX = 'rmno:';
const RM_OPEN = '⟦RM⟧';
const RM_CLOSE = '⟦/RM⟧';

// Cap how many repos one card may carry (Telegram message length + human review).
const MAX_REPOS_PER_CARD = 60;

export interface RepoApprovalResult {
  status: number;
  body: Record<string, unknown>;
}

export function isRepoApprovalCallback(data: string): boolean {
  return data.startsWith(APPROVE_PREFIX) || data.startsWith(REJECT_PREFIX);
}

// Pure decoder for a button's callback_data. Exported for unit testing.
export function parseRepoApprovalCallback(
  data: string,
): { action: 'approve' | 'reject'; corr: string } | null {
  let action: 'approve' | 'reject';
  let corr: string;
  if (data.startsWith(APPROVE_PREFIX)) {
    action = 'approve';
    corr = data.slice(APPROVE_PREFIX.length);
  } else if (data.startsWith(REJECT_PREFIX)) {
    action = 'reject';
    corr = data.slice(REJECT_PREFIX.length);
  } else {
    return null;
  }
  if (!CORR_RE.test(corr)) return null;
  return { action, corr };
}

// Recover + re-validate the repo list from the card's message text (between the
// sentinels). Exported for unit testing. Drops anything that isn't a valid repo
// name or is protected — so a malformed/edited card can never delete the wrong thing.
export function recoverReposFromText(text: string | undefined): string[] {
  if (!text) return [];
  const open = text.indexOf(RM_OPEN);
  const close = text.indexOf(RM_CLOSE);
  if (open < 0 || close < 0 || close <= open) return [];
  const inner = text.slice(open + RM_OPEN.length, close);
  return inner
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && REPO_RE.test(s) && !PROTECTED.has(s));
}

function allowedUserIds(): Set<string> {
  const raw = process.env.OIL_APPROVER_TELEGRAM_ALLOWLIST ?? '';
  if (raw === '__NOT_CONFIGURED__') return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

type Outcome = 'registered' | 'register_failed' | 'approved' | 'rejected' | 'delete_failed' | 'unauthorized' | 'recover_failed';

async function emitRepo(outcome: Outcome, corr: string, reason: string): Promise<void> {
  try {
    await emitEvent({
      name: `factory.repo_delete.${outcome}`,
      severity: outcome === 'delete_failed' || outcome === 'recover_failed' ? 'warning' : 'info',
      layer: 'factory',
      workflow: 'mcp:repo-approval',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { corr, reason },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Called by propose-repo-delete.yml (admin-gated in index.ts). Validates the repo
// list, refuses protected names, and sends Or one ✅/❌ card with the repos embedded
// in the text for stateless recovery on ✅.
export async function registerRepoDelete(input: {
  repos: string[];
  correlation_id: string;
}): Promise<RepoApprovalResult> {
  const corr = input.correlation_id ?? '';
  if (!CORR_RE.test(corr)) return { status: 400, body: { error: 'bad_correlation_id' } };
  const clean = (input.repos ?? [])
    .map((r) => String(r).trim())
    .filter((r) => r.length > 0);
  if (clean.length === 0) return { status: 400, body: { error: 'no_repos' } };
  const bad = clean.filter((r) => !REPO_RE.test(r));
  if (bad.length > 0) return { status: 400, body: { error: 'bad_repo_name', detail: bad.slice(0, 5) } };
  const protectedHit = clean.filter((r) => PROTECTED.has(r));
  if (protectedHit.length > 0) return { status: 400, body: { error: 'protected_repo', detail: protectedHit } };
  if (clean.length > MAX_REPOS_PER_CARD) {
    return { status: 400, body: { error: 'too_many', max: MAX_REPOS_PER_CARD, got: clean.length } };
  }
  const uniq = Array.from(new Set(clean));

  const listForView = uniq.map((r) => `• ${r}`).join('\n');
  const text =
    `🗑️ מחיקת ריפו — דרוש אישורך\n` +
    `(בלתי-הפיך — מחיקה ב-GitHub היא קבועה)\n` +
    `מזהה: ${corr}\n` +
    `ריפוז למחיקה (${uniq.length}):\n` +
    `${listForView}\n` +
    `${RM_OPEN}${uniq.join(' ')}${RM_CLOSE}\n\n` +
    `אשר/דחה כאן:`;
  const buttons: InlineButton[] = [
    { text: '✅ אישור ומחיקה', callback_data: `${APPROVE_PREFIX}${corr}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${corr}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitRepo('register_failed', corr, `telegram-${sent.status}`);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitRepo('registered', corr, `${uniq.length} repo(s)`);
  return { status: 200, body: { ok: true, corr, count: uniq.length, message_id: sent.messageId ?? null } };
}

// Inbound Telegram callback (a button press). secret_token verified upstream in
// index.ts. Authorises the presser, recovers the repo list from the card text,
// and (✅) deletes each via the hard-guarded broker delete. Always 200.
export async function handleRepoApprovalCallback(req: Request): Promise<RepoApprovalResult> {
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
  const messageText = typeof message['text'] === 'string' ? (message['text'] as string) : undefined;

  if (!(fromId.length > 0 && allowedUserIds().has(fromId))) {
    await answerCallbackQuery(callbackId, 'אינך מורשה לאשר.');
    await emitRepo('unauthorized', 'n/a', `from_id=${fromId}`);
    return { status: 200, body: { unauthorized: true } };
  }

  const decoded = parseRepoApprovalCallback(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, corr } = decoded;

  if (action === 'reject') {
    await answerCallbackQuery(callbackId, '❌ נדחתה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ מחיקת הריפוז (${corr}) נדחתה — לא נמחק דבר.`);
    }
    await emitRepo('rejected', corr, 'rejected by operator');
    return { status: 200, body: { action: 'reject', corr } };
  }

  // approve → answer first (short callback window), then recover + delete.
  await answerCallbackQuery(callbackId, '⏳ מאשר ומוחק…');

  const repos = recoverReposFromText(messageText);
  if (repos.length === 0) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${corr}: לא ניתן לשחזר את רשימת הריפוז — לא נמחק דבר.`);
    }
    await emitRepo('recover_failed', corr, 'could not recover repo list');
    return { status: 200, body: { action: 'approve', corr, deleted: 0, detail: 'recover_failed' } };
  }

  let deleted = 0;
  const failures: string[] = [];
  for (const repo of repos) {
    const r = await deleteRepoAsBroker(repo);
    if (r.deleted) deleted += 1;
    else failures.push(`${repo} (${r.status})`);
  }

  const summary =
    failures.length === 0
      ? `✅ נמחקו ${deleted} ריפוז (${corr}).`
      : `⚠️ נמחקו ${deleted}; נכשלו ${failures.length}: ${failures.slice(0, 8).join(', ')}`;
  if (messageId && chatId != null) {
    await editTelegramMessage(chatId as string | number, messageId, summary);
  }
  await emitRepo(failures.length === 0 ? 'approved' : 'delete_failed', corr, `deleted=${deleted} failed=${failures.length}`);
  return { status: 200, body: { action: 'approve', corr, deleted, failed: failures.length } };
}
