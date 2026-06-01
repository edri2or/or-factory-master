// Unit tests for the factory CHAT bot's PURE guardrails + parsing (no Telegram /
// LLM / client side effects). Runs against the compiled output via `node --test`
// — zero test-framework deps, matching the MCP server's tsc-gated convention
// (see test/oil-approval.test.mjs). telegram-chat-guards.js imports nothing
// heavy, so no throwaway env vars are needed. Build first, then: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  PLACEHOLDER,
  MAX_MSG_AGE_SEC,
  parseAllowlist,
  isChatAllowed,
  isFresh,
  parseInboundMessage,
  parseActionCallback,
} = await import('../dist/telegram-chat-guards.js');

test('parseAllowlist: empty / placeholder → closed (nobody allowed)', () => {
  assert.equal(parseAllowlist(undefined).size, 0);
  assert.equal(parseAllowlist('').size, 0);
  assert.equal(parseAllowlist(PLACEHOLDER).size, 0);
});

test('parseAllowlist: CSV parsed, trimmed, deduped', () => {
  const s = parseAllowlist(' 111 , 222,111 , ');
  assert.deepEqual([...s].sort(), ['111', '222']);
});

test('isChatAllowed: only listed ids, never empty', () => {
  const allow = parseAllowlist('111,222');
  assert.equal(isChatAllowed('111', allow), true);
  assert.equal(isChatAllowed('333', allow), false);
  assert.equal(isChatAllowed('', allow), false);
  assert.equal(isChatAllowed('111', new Set()), false);
});

test('isFresh: accepts within window, rejects stale and far-future', () => {
  const now = 1_000_000 * 1000; // nowMs
  const nowSec = now / 1000;
  assert.equal(isFresh(nowSec, now), true);
  assert.equal(isFresh(nowSec - (MAX_MSG_AGE_SEC - 5), now), true); // just inside
  assert.equal(isFresh(nowSec - (MAX_MSG_AGE_SEC + 5), now), false); // stale
  assert.equal(isFresh(nowSec + (MAX_MSG_AGE_SEC + 5), now), false); // far future
});

test('isFresh: missing / non-positive / NaN date → rejected', () => {
  const now = Date.now();
  assert.equal(isFresh(0, now), false);
  assert.equal(isFresh(-1, now), false);
  assert.equal(isFresh(Number.NaN, now), false);
});

test('parseInboundMessage: valid text message extracted', () => {
  const m = parseInboundMessage({
    message: { message_id: 7, date: 1700, text: 'מה קרה?', from: { id: 999 }, chat: { id: 42 } },
  });
  assert.ok(m);
  assert.equal(m.fromId, '999');
  assert.equal(m.chatId, 42);
  assert.equal(m.text, 'מה קרה?');
  assert.equal(m.dateSec, 1700);
  assert.equal(m.messageId, 7);
});

test('parseInboundMessage: non-message / empty / callback → null', () => {
  assert.equal(parseInboundMessage({}), null);
  assert.equal(parseInboundMessage({ callback_query: { id: 'x' } }), null);
  assert.equal(parseInboundMessage({ message: { text: '   ', from: { id: 1 }, chat: { id: 1 } } }), null);
  assert.equal(parseInboundMessage({ message: { text: 'hi', chat: { id: 1 } } }), null); // no from.id
});

test('parseActionCallback: valid do/no with index', () => {
  assert.deepEqual(parseActionCallback('cdo:0'), { action: 'do', idx: 0 });
  assert.deepEqual(parseActionCallback('cdo:12'), { action: 'do', idx: 12 });
  assert.deepEqual(parseActionCallback('cno:1'), { action: 'no', idx: 1 });
});

test('parseActionCallback: malformed / hostile → null', () => {
  assert.equal(parseActionCallback('oilapprove:5'), null); // not ours
  assert.equal(parseActionCallback('cdo:'), null);
  assert.equal(parseActionCallback('cdo:1x'), null);
  assert.equal(parseActionCallback('cdo:-1'), null);
  assert.equal(parseActionCallback('cno:abc'), null);
  assert.equal(parseActionCallback(''), null);
});
