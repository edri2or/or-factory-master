// Pure, side-effect-free guardrails + parsing for the factory's bidirectional
// Telegram CHAT bot. Kept in its own module (no client imports) so it can be
// unit-tested hermetically — importing telegram-chat.ts pulls in github-client,
// which THROWS at load when the App env vars are absent (fine in production,
// fatal in a bare unit-test process). The handler (telegram-chat.ts) imports
// these; the tests import only this file.
//
// Security posture (handoff decision 5): the sender allowlist (layer 2 — the
// secret_token header is layer 1, checked in index.ts) and the ~120s freshness
// window are the two cheap, deterministic gates that run BEFORE any LLM call.

// A secret/env value still holding the deploy placeholder counts as "absent".
export const PLACEHOLDER = '__NOT_CONFIGURED__';

// Reject a message whose Telegram `date` is more than this many seconds from now
// (stale replays, or a clock far in the future). 120s mirrors the systems' bot.
export const MAX_MSG_AGE_SEC = 120;

export interface InboundMessage {
  fromId: string;
  chatId: string | number;
  text: string;
  dateSec: number;
  messageId: number;
}

// Parse the CSV allowlist of Telegram user ids permitted to chat (Or's id).
// Empty/absent or the deploy placeholder → nobody allowed (closed by default).
export function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw || raw === PLACEHOLDER) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Is this Telegram user id permitted to talk to the bot?
export function isChatAllowed(fromId: string, allowlist: Set<string>): boolean {
  return fromId.length > 0 && allowlist.has(fromId);
}

// Freshness gate: accept only messages whose `date` (epoch seconds) is within
// ±maxAgeSec of now. Rejects stale replays AND far-future timestamps. A missing
// or non-positive date is rejected.
export function isFresh(dateSec: number, nowMs: number = Date.now(), maxAgeSec: number = MAX_MSG_AGE_SEC): boolean {
  if (!Number.isFinite(dateSec) || dateSec <= 0) return false;
  const ageSec = nowMs / 1000 - dateSec;
  return ageSec <= maxAgeSec && ageSec >= -maxAgeSec;
}

// HITL action callbacks (Stage D). State-free, mirroring oil-approval: the only
// thing carried in the button is the action verb + an index into the fixed
// HITL_WORKFLOWS allowlist (a tiny integer — well under Telegram's 64-byte cap),
// so a Cloud Run instance swap can never lose a pending approval. The index is
// range-checked by the handler (this pure parser only validates shape).
export const ACTION_DO_PREFIX = 'cdo:';
export const ACTION_NO_PREFIX = 'cno:';

export function parseActionCallback(data: string): { action: 'do' | 'no'; idx: number } | null {
  let action: 'do' | 'no';
  let rest: string;
  if (data.startsWith(ACTION_DO_PREFIX)) {
    action = 'do';
    rest = data.slice(ACTION_DO_PREFIX.length);
  } else if (data.startsWith(ACTION_NO_PREFIX)) {
    action = 'no';
    rest = data.slice(ACTION_NO_PREFIX.length);
  } else {
    return null;
  }
  if (!/^[0-9]+$/.test(rest)) return null; // reject "", "1x", "-1"
  const idx = Number(rest);
  if (!Number.isInteger(idx) || idx < 0) return null;
  return { action, idx };
}

// Extract a usable text message from a Telegram update. Returns null for
// anything that isn't a plain text message (callback_query, edited messages,
// stickers, empty text, …) so the handler can cheaply ignore it.
export function parseInboundMessage(update: Record<string, unknown>): InboundMessage | null {
  const msg = update['message'] as Record<string, unknown> | undefined;
  if (!msg) return null;
  const text = typeof msg['text'] === 'string' ? msg['text'] : '';
  if (!text.trim()) return null;
  const from = (msg['from'] ?? {}) as Record<string, unknown>;
  const chat = (msg['chat'] ?? {}) as Record<string, unknown>;
  const fromId = String(from['id'] ?? '');
  const chatId = (chat['id'] ?? '') as string | number;
  const dateSec = Number(msg['date'] ?? 0);
  const messageId = Number(msg['message_id'] ?? 0);
  if (!fromId || chatId === '') return null;
  return { fromId, chatId, text, dateSec, messageId };
}
