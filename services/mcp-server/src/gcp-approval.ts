// GCP risk-gate — the RED approval bridge (a sibling of oil-approval.ts and
// system-request.ts). The gcp-action.yml workflow classifies a gcloud command
// green/yellow/red (scripts/gcp-classify.sh). Green/yellow run immediately as the
// broker SA; a RED command is NOT run — the workflow calls /gcp-approval-register
// here, which sends Or ONE Telegram card with ✅/❌ buttons. When Or taps a button
// Telegram POSTs /telegram-webhook → handleGcpApprovalCallback: it authorises the
// presser (same allowlist as OIL), and (✅) dispatches gcp-action.yml's `execute`
// phase so the broker runs the command — else (❌ / no action) nothing runs.
//
// Same AI-proposes / human-approves invariant as OIL and the system-request
// channel: a red GCP mutation never runs without Or's explicit Telegram ✅.
//
// State-free by design: the command travels INSIDE the card's own message text
// (between the ⟦CMD⟧…⟦/CMD⟧ sentinels), and Telegram echoes that text back in the
// callback's `message.text` — so a Cloud Run instance swap can never lose a
// pending approval, with no Linear/issue/DB state. The button's callback_data
// carries only a short correlation id (`gcpok:<corr>` / `gcpno:<corr>`, well
// under Telegram's 64-byte cap). Every step is soft-fail; the webhook always
// answers 200 so Telegram never retry-storms.

import type { Request } from 'express';
import { dispatchWorkflow } from './github-client.js';
import {
  emitEvent,
  sendTelegramKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  type InlineButton,
} from './observability-client.js';

const OWNER = 'edri2or';
const FACTORY_REPO = 'or-factory-master';
const GCP_ACTION_WORKFLOW = 'gcp-action.yml';

// callback_data tags. The correlation id is the only payload — a short token.
const APPROVE_PREFIX = 'gcpok:';
const REJECT_PREFIX = 'gcpno:';

// A short correlation id: letters/digits/hyphen, ≤40 chars. Keeps callback_data
// tiny and safe to split.
const CORR_RE = /^[A-Za-z0-9-]{1,40}$/;

// Command charset allow-list — the SAME safety the classifier relies on (it
// tokenises on spaces). No shell metacharacters (no ; | & $ ` ( ) < > newlines),
// so the workflow can split the string into argv and exec gcloud without a shell
// re-parse. Matches gcloud command shapes: words, flags, =, paths, emails, commas.
const COMMAND_RE = /^[A-Za-z0-9 _.,:/=@-]+$/;

// Sentinels that wrap the command inside the card text so the callback handler can
// recover it from message.text (Telegram echoes the text verbatim — no parse_mode).
const CMD_OPEN = '⟦CMD⟧';
const CMD_CLOSE = '⟦/CMD⟧';

export interface GcpApprovalResult {
  status: number;
  body: Record<string, unknown>;
}

// Is this callback_data one of ours? Lets index.ts route without importing prefixes.
export function isGcpApprovalCallback(data: string): boolean {
  return data.startsWith(APPROVE_PREFIX) || data.startsWith(REJECT_PREFIX);
}

// Pure decoder for a button's callback_data. Exported for unit testing.
export function parseGcpApprovalCallback(
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

// Recover the command from the card's message text (between the sentinels).
// Exported for unit testing. Re-validates the charset so a malformed/edited text
// can never become an executed command.
export function recoverCommandFromText(text: string | undefined): string | null {
  if (!text) return null;
  const open = text.indexOf(CMD_OPEN);
  const close = text.indexOf(CMD_CLOSE);
  if (open < 0 || close < 0 || close <= open) return null;
  const cmd = text.slice(open + CMD_OPEN.length, close).trim();
  if (!cmd || !COMMAND_RE.test(cmd)) return null;
  return cmd;
}

// Telegram approver allowlist — the SAME operator who approves OIL fixes and
// system requests, so the channel reuses the OIL approver allowlist env. Closed
// by default (empty / placeholder → nobody).
function allowedUserIds(): Set<string> {
  const raw = process.env.OIL_APPROVER_TELEGRAM_ALLOWLIST ?? '';
  if (raw === '__NOT_CONFIGURED__') return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

type Outcome = 'registered' | 'register_failed' | 'approved' | 'rejected' | 'dispatch_failed' | 'unauthorized' | 'recover_failed';

async function emitGcp(outcome: Outcome, corr: string, reason: string): Promise<void> {
  try {
    await emitEvent({
      name: `factory.gcp_action.${outcome}`,
      severity: outcome === 'dispatch_failed' || outcome === 'recover_failed' ? 'warning' : 'info',
      layer: 'factory',
      workflow: 'mcp:gcp-approval',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { corr, reason },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Called by gcp-action.yml (red path, admin-gated in index.ts) for a command the
// classifier tiered RED. Sends Or one Telegram card with ✅/❌ buttons; the command
// is embedded in the card text (sentinel-wrapped) for stateless recovery on ✅.
export async function registerGcpApproval(input: {
  command: string;
  correlation_id: string;
  reason?: string;
}): Promise<GcpApprovalResult> {
  const command = (input.command ?? '').trim();
  const corr = input.correlation_id ?? '';
  if (!CORR_RE.test(corr)) return { status: 400, body: { error: 'bad_correlation_id' } };
  if (!command || !COMMAND_RE.test(command)) return { status: 400, body: { error: 'bad_command' } };

  const text =
    `🛡️ פעולת GCP אדומה — דרוש אישורך\n` +
    `תיוג: 🔴 red (לא רץ ללא אישור)\n` +
    (input.reason ? `סיבה: ${input.reason}\n` : '') +
    `מזהה: ${corr}\n` +
    `פקודה:\n` +
    `${CMD_OPEN}gcloud ${command}${CMD_CLOSE}\n\n` +
    `אשר/דחה כאן:`;
  const buttons: InlineButton[] = [
    { text: '✅ אישור והרצה', callback_data: `${APPROVE_PREFIX}${corr}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${corr}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitGcp('register_failed', corr, `telegram-${sent.status}`);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitGcp('registered', corr, command);
  return { status: 200, body: { ok: true, corr, message_id: sent.messageId ?? null } };
}

// Inbound Telegram callback (a button press) for a GCP approval. The secret_token
// header is verified in index.ts before this runs. Authorises the presser,
// recovers the command from the card text, and (✅) dispatches the execute phase.
// Always 200 so Telegram does not retry.
export async function handleGcpApprovalCallback(req: Request): Promise<GcpApprovalResult> {
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
    await emitGcp('unauthorized', 'n/a', `from_id=${fromId}`);
    return { status: 200, body: { unauthorized: true } };
  }

  const decoded = parseGcpApprovalCallback(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, corr } = decoded;

  if (action === 'reject') {
    await answerCallbackQuery(callbackId, '❌ נדחתה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ הפעולה (${corr}) נדחתה — לא בוצע דבר.`);
    }
    await emitGcp('rejected', corr, 'rejected by operator');
    return { status: 200, body: { action: 'reject', corr } };
  }

  // approve → answer first (Telegram's callback window is short), then recover the
  // command from the card text and dispatch the execute phase.
  await answerCallbackQuery(callbackId, '⏳ מאשר ומריץ…');

  const command = recoverCommandFromText(messageText);
  if (!command) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${corr}: לא ניתן לשחזר את הפקודה — לא בוצע.`);
    }
    await emitGcp('recover_failed', corr, 'could not recover command from message text');
    return { status: 200, body: { action: 'approve', corr, dispatched: false, detail: 'recover_failed' } };
  }

  try {
    await dispatchWorkflow(
      GCP_ACTION_WORKFLOW,
      'main',
      { phase: 'execute', command, correlation_id: corr },
      OWNER,
      FACTORY_REPO,
    );
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ ${corr} אושר — מריץ (תקבל אישור בסיום).`);
    }
    await emitGcp('approved', corr, command);
    return { status: 200, body: { action: 'approve', corr, dispatched: true } };
  } catch (e) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${corr}: שגיאה בהפעלת ההרצה — נסה שוב.`);
    }
    await emitGcp('dispatch_failed', corr, String(e).slice(0, 160));
    return { status: 200, body: { action: 'approve', corr, dispatched: false, detail: String(e).slice(0, 200) } };
  }
}
