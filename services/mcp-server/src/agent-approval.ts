// Agent-repo risk-gate — the RED approval bridge (a sibling of gcp-approval.ts).
// The agent-action.yml workflow (the broker for the agent-repo product-type)
// classifies a unit of agent work green/yellow/red (scripts/agent-classify.sh).
// Green/yellow are brokered immediately (dispatch the worker → poll → write the
// result back to the requester); a RED task is NOT brokered — the workflow calls
// /agent-action-register here, which sends Or ONE Telegram card with ✅/❌
// buttons. When Or taps a button Telegram POSTs /telegram-webhook →
// handleAgentApprovalCallback: it authorises the presser (same allowlist as OIL),
// and (✅) dispatches agent-action.yml's `execute` phase so the broker runs the
// work — else (❌ / no action) nothing runs.
//
// Same AI-proposes / human-approves invariant as OIL, the system-request channel
// and the GCP risk-gate: a red agent task never runs without Or's explicit ✅.
//
// State-free by design, like gcp-approval.ts — but an agent task is a FOUR-field
// unit ({worker_repo, requester_repo, task, correlation_id}) and the task is
// FREEFORM text (unlike gcloud's charset-restricted command), so the whole unit
// travels as a base64(JSON) blob INSIDE the card's own message text (between the
// ⟦AGENT⟧…⟦/AGENT⟧ sentinels). Telegram echoes that text back verbatim in the
// callback, so a Cloud Run instance swap can never lose a pending approval, with
// no Linear/issue/DB state. base64's alphabet ([A-Za-z0-9+/=]) can never contain
// the sentinel glyphs, so the boundaries are always unambiguous. The button's
// callback_data carries only a short correlation id (`agentok:<corr>` /
// `agentno:<corr>`, well under Telegram's 64-byte cap), and on ✅ the recovered
// payload's correlation_id MUST equal that button corr — binding button to blob.
// Every step is soft-fail; the webhook always answers 200 so Telegram never
// retry-storms.

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
const AGENT_ACTION_WORKFLOW = 'agent-action.yml';

// callback_data tags. The correlation id is the only payload — a short token.
const APPROVE_PREFIX = 'agentok:';
const REJECT_PREFIX = 'agentno:';

// A short correlation id: letters/digits/hyphen, ≤40 chars. Keeps callback_data
// tiny and safe to split.
const CORR_RE = /^[A-Za-z0-9-]{1,40}$/;

// Repo-name shape — the SAME guard agent-action.yml's "Validate inputs" applies
// (a bare repo under edri2or, never owner/repo here). Re-checked on recovery so a
// malformed blob can never become a dispatch.
const REPO_RE = /^[a-z][a-z0-9._-]{2,38}[a-z0-9]$/;

// Sentinels that wrap the base64(JSON) unit inside the card text so the callback
// handler can recover it from message.text (Telegram echoes the text verbatim).
const PAYLOAD_OPEN = '⟦AGENT⟧';
const PAYLOAD_CLOSE = '⟦/AGENT⟧';

// base64 alphabet — the only chars the blob between the sentinels may contain.
const B64_RE = /^[A-Za-z0-9+/=]+$/;

// How much of the task to show Or in the readable preview (the FULL task rides in
// the base64 blob, untouched). Keeps the card tidy.
const TASK_DISPLAY_MAX = 400;
// Hard ceiling on the assembled card text, comfortably under Telegram's 4096-char
// message cap — a task too large for one card is refused at register time (agent
// tasks are meant to be short pointers, not large inline payloads).
const MAX_CARD_TEXT = 3900;

export interface AgentApprovalResult {
  status: number;
  body: Record<string, unknown>;
}

export interface AgentWorkUnit {
  worker_repo: string;
  requester_repo: string;
  task: string;
  correlation_id: string;
}

// Is this callback_data one of ours? Lets index.ts route without importing prefixes.
export function isAgentApprovalCallback(data: string): boolean {
  return data.startsWith(APPROVE_PREFIX) || data.startsWith(REJECT_PREFIX);
}

// Pure decoder for a button's callback_data. Exported for unit testing.
export function parseAgentApprovalCallback(
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

// Normalise "owner/repo" → "repo"; validate the bare-repo shape; refuse the
// control/factory repos. Returns null on any failure (so the caller refuses).
function cleanRepo(raw: unknown): string | null {
  const name = String(raw ?? '').split('/').pop() ?? '';
  if (!REPO_RE.test(name)) return null;
  if (name === 'or-factory-master' || name === 'or-factory-master-control' || name.endsWith('-control')) {
    return null;
  }
  return name;
}

// Encode a work unit as the base64(JSON) blob embedded in the card. Short keys
// keep the blob compact (base64 inflates ~33%, the card has a hard cap).
// Exported for unit testing.
export function encodeAgentPayload(unit: AgentWorkUnit): string {
  const json = JSON.stringify({
    w: unit.worker_repo,
    r: unit.requester_repo,
    t: unit.task,
    c: unit.correlation_id,
  });
  return Buffer.from(json, 'utf8').toString('base64');
}

// Recover the work unit from the card's message text (the base64 blob between the
// sentinels), then RE-VALIDATE every field — a malformed/edited text can never
// become a dispatched task. `corr` is the trusted correlation id from the button's
// callback_data; the recovered unit's id MUST equal it (binds button ↔ blob).
// Exported for unit testing.
export function recoverAgentPayloadFromText(
  text: string | undefined,
  corr: string,
): AgentWorkUnit | null {
  if (!text || !CORR_RE.test(corr)) return null;
  const open = text.indexOf(PAYLOAD_OPEN);
  if (open < 0) return null;
  const close = text.indexOf(PAYLOAD_CLOSE, open + PAYLOAD_OPEN.length);
  if (close < 0) return null;
  const b64 = text.slice(open + PAYLOAD_OPEN.length, close).trim();
  if (!b64 || !B64_RE.test(b64)) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  const worker_repo = cleanRepo(parsed['w']);
  const requester_repo = cleanRepo(parsed['r']);
  const task = typeof parsed['t'] === 'string' ? parsed['t'] : '';
  const payloadCorr = typeof parsed['c'] === 'string' ? parsed['c'] : '';
  if (!worker_repo || !requester_repo) return null;
  if (!task.trim()) return null;
  if (!CORR_RE.test(payloadCorr) || payloadCorr !== corr) return null;

  return { worker_repo, requester_repo, task, correlation_id: payloadCorr };
}

// Telegram approver allowlist — the SAME operator who approves OIL fixes, system
// requests and GCP red ops, so the channel reuses the OIL approver allowlist env.
// Closed by default (empty / placeholder → nobody).
function allowedUserIds(): Set<string> {
  const raw = process.env.OIL_APPROVER_TELEGRAM_ALLOWLIST ?? '';
  if (raw === '__NOT_CONFIGURED__') return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

type Outcome =
  | 'registered'
  | 'register_failed'
  | 'approved'
  | 'rejected'
  | 'dispatch_failed'
  | 'unauthorized'
  | 'recover_failed';

async function emitAgent(outcome: Outcome, corr: string, reason: string): Promise<void> {
  try {
    await emitEvent({
      name: `factory.agent_action.${outcome}`,
      severity: outcome === 'dispatch_failed' || outcome === 'recover_failed' ? 'warning' : 'info',
      layer: 'factory',
      workflow: 'mcp:agent-approval',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { corr, reason },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Called by agent-action.yml (red path, admin-gated in index.ts) for a task the
// classifier tiered RED. Sends Or one Telegram card with ✅/❌ buttons; the whole
// work unit is embedded in the card text (base64-in-sentinel) for stateless
// recovery on ✅.
export async function registerAgentApproval(input: {
  worker_repo: string;
  requester_repo: string;
  task: string;
  correlation_id: string;
  reason?: string;
}): Promise<AgentApprovalResult> {
  const corr = input.correlation_id ?? '';
  if (!CORR_RE.test(corr)) return { status: 400, body: { error: 'bad_correlation_id' } };
  const worker_repo = cleanRepo(input.worker_repo);
  const requester_repo = cleanRepo(input.requester_repo);
  if (!worker_repo) return { status: 400, body: { error: 'bad_worker_repo' } };
  if (!requester_repo) return { status: 400, body: { error: 'bad_requester_repo' } };
  const task = (input.task ?? '').trim();
  if (!task) return { status: 400, body: { error: 'empty_task' } };

  const blob = encodeAgentPayload({ worker_repo, requester_repo, task, correlation_id: corr });
  // Display preview: strip the sentinel glyphs so an injected sentinel in the task
  // can never confuse the boundary scan, and truncate for tidiness.
  const safePreview = task.replace(/[⟦⟧]/g, '');
  const preview =
    safePreview.length > TASK_DISPLAY_MAX ? `${safePreview.slice(0, TASK_DISPLAY_MAX)}…` : safePreview;

  const text =
    `🤖 משימת-סוכן אדומה — דרוש אישורך\n` +
    `תיוג: 🔴 red (לא רץ ללא אישור)\n` +
    (input.reason ? `סיבה: ${input.reason}\n` : '') +
    `מבצע (worker): ${worker_repo}\n` +
    `חוזר ל (requester): ${requester_repo}\n` +
    `מזהה: ${corr}\n` +
    `משימה:\n${preview}\n\n` +
    `${PAYLOAD_OPEN}${blob}${PAYLOAD_CLOSE}\n\n` +
    `אשר/דחה כאן:`;

  if (text.length > MAX_CARD_TEXT) {
    await emitAgent('register_failed', corr, 'card-too-large');
    return { status: 413, body: { error: 'task_too_large_for_card' } };
  }

  const buttons: InlineButton[] = [
    { text: '✅ אישור והרצה', callback_data: `${APPROVE_PREFIX}${corr}` },
    { text: '❌ דחייה', callback_data: `${REJECT_PREFIX}${corr}` },
  ];

  const sent = await sendTelegramKeyboard(text, buttons);
  if (sent.status !== 'ok') {
    await emitAgent('register_failed', corr, `telegram-${sent.status}`);
    return { status: 502, body: { error: 'telegram_send_failed', telegram: sent.status } };
  }
  await emitAgent('registered', corr, `${worker_repo}<-${requester_repo}`);
  return { status: 200, body: { ok: true, corr, message_id: sent.messageId ?? null } };
}

// Inbound Telegram callback (a button press) for an agent-action approval. The
// secret_token header is verified in index.ts before this runs. Authorises the
// presser, recovers the work unit from the card text, and (✅) dispatches the
// execute phase. Always 200 so Telegram does not retry.
export async function handleAgentApprovalCallback(req: Request): Promise<AgentApprovalResult> {
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
    await emitAgent('unauthorized', 'n/a', `from_id=${fromId}`);
    return { status: 200, body: { unauthorized: true } };
  }

  const decoded = parseAgentApprovalCallback(data);
  if (!decoded) {
    await answerCallbackQuery(callbackId);
    return { status: 200, body: { ignored: 'unknown_callback_data' } };
  }
  const { action, corr } = decoded;

  if (action === 'reject') {
    await answerCallbackQuery(callbackId, '❌ נדחתה');
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `❌ המשימה (${corr}) נדחתה — לא בוצע דבר.`);
    }
    await emitAgent('rejected', corr, 'rejected by operator');
    return { status: 200, body: { action: 'reject', corr } };
  }

  // approve → answer first (Telegram's callback window is short), then recover the
  // work unit from the card text and dispatch the execute phase.
  await answerCallbackQuery(callbackId, '⏳ מאשר ומריץ…');

  const unit = recoverAgentPayloadFromText(messageText, corr);
  if (!unit) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${corr}: לא ניתן לשחזר את המשימה — לא בוצע.`);
    }
    await emitAgent('recover_failed', corr, 'could not recover work unit from message text');
    return { status: 200, body: { action: 'approve', corr, dispatched: false, detail: 'recover_failed' } };
  }

  try {
    await dispatchWorkflow(
      AGENT_ACTION_WORKFLOW,
      'main',
      {
        phase: 'execute',
        worker_repo: unit.worker_repo,
        requester_repo: unit.requester_repo,
        task: unit.task,
        correlation_id: corr,
      },
      OWNER,
      FACTORY_REPO,
    );
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `✅ ${corr} אושר — מריץ (התוצאה תיכתב ל-${unit.requester_repo}).`);
    }
    await emitAgent('approved', corr, `${unit.worker_repo}<-${unit.requester_repo}`);
    return { status: 200, body: { action: 'approve', corr, dispatched: true } };
  } catch (e) {
    if (messageId && chatId != null) {
      await editTelegramMessage(chatId as string | number, messageId, `⚠️ ${corr}: שגיאה בהפעלת ההרצה — נסה שוב.`);
    }
    await emitAgent('dispatch_failed', corr, String(e).slice(0, 160));
    return { status: 200, body: { action: 'approve', corr, dispatched: false, detail: String(e).slice(0, 200) } };
  }
}
