// Unit tests for the OIL auto-fix triage decoders (the PURE functions, no
// Linear/GitHub/Telegram side effects). Runs against the compiled output via
// `node --test` — no test framework dependency, matching the MCP server's
// zero-dep, tsc-gated convention. Build first (npm run build), then: npm test.
//
// This file is also the canonical reproducer model for future OIL TypeScript
// fixes: a fail-before/pass-after `npm --prefix services/mcp-server test`.
//
// oil-autofix.js transitively imports github-client.js, which requires the
// broker App env vars to exist at module load (a deliberate production guard).
// ESM evaluates static imports before any top-level code, so we set throwaway
// values FIRST and then dynamically import the module under test. The tested
// functions never read these vars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { verifyLinearSignature, extractOtel, triage } = await import('../dist/oil-autofix.js');

// --- verifyLinearSignature(rawBody, signatureHeader, secret) -----------------

test('verifyLinearSignature: false when rawBody is undefined or empty', () => {
  assert.equal(verifyLinearSignature(undefined, 'deadbeef', 'secret'), false);
  assert.equal(verifyLinearSignature(Buffer.alloc(0), 'deadbeef', 'secret'), false);
});

test('verifyLinearSignature: false when signatureHeader is undefined or empty', () => {
  const body = Buffer.from('{"x":1}');
  assert.equal(verifyLinearSignature(body, undefined, 'secret'), false);
  assert.equal(verifyLinearSignature(body, '', 'secret'), false);
});

test('verifyLinearSignature: false when secret is empty', () => {
  const body = Buffer.from('{"x":1}');
  assert.equal(verifyLinearSignature(body, 'deadbeef', ''), false);
});

test('verifyLinearSignature: true when signature matches', () => {
  const body = Buffer.from('{"action":"create"}');
  const secret = 'lin_wh_secret';
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyLinearSignature(body, sig, secret), true);
});

test('verifyLinearSignature: false when signature was computed with the wrong secret', () => {
  const body = Buffer.from('{"action":"create"}');
  const sig = createHmac('sha256', 'wrong-secret').update(body).digest('hex');
  assert.equal(verifyLinearSignature(body, sig, 'lin_wh_secret'), false);
});

test('verifyLinearSignature: false when lengths differ (timing-safe path)', () => {
  const body = Buffer.from('{"action":"create"}');
  const secret = 'lin_wh_secret';
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  // A header shorter than the 64-hex-char digest exercises the length guard.
  assert.equal(verifyLinearSignature(body, sig.slice(0, 10), secret), false);
});

// --- extractOtel(description) ------------------------------------------------

test('extractOtel: null for null/undefined input', () => {
  assert.equal(extractOtel(null), null);
  assert.equal(extractOtel(undefined), null);
});

test('extractOtel: null for a non-JSON string', () => {
  assert.equal(extractOtel('just some prose, no json here'), null);
});

test('extractOtel: extracts JSON from a fenced ```json block', () => {
  const desc = 'Some preamble\n```json\n{"otel.event.name":"factory.deploy.failed"}\n```\nmore text';
  assert.deepEqual(extractOtel(desc), { 'otel.event.name': 'factory.deploy.failed' });
});

test('extractOtel: falls back to parsing the whole string when no fence present', () => {
  assert.deepEqual(extractOtel('{"otel.event.name":"factory.health.degraded"}'), {
    'otel.event.name': 'factory.health.degraded',
  });
});

test('extractOtel: null when parsed value is not an object (e.g. a number)', () => {
  assert.equal(extractOtel('42'), null);
});

// --- triage(otel) ------------------------------------------------------------

test('triage: skip/not-a-factory-event for null input', () => {
  assert.deepEqual(triage(null), { action: 'skip', reason: 'not-a-factory-event' });
});

test('triage: skip/not-a-factory-event when there is no otel.event.name', () => {
  assert.deepEqual(triage({ severity_text: 'error', 'factory.action_required': true }), {
    action: 'skip',
    reason: 'not-a-factory-event',
  });
});

test('triage: skip/test-event for factory.pilot.test', () => {
  assert.deepEqual(
    triage({ 'otel.event.name': 'factory.pilot.test', 'factory.action_required': true }),
    { action: 'skip', reason: 'test-event' },
  );
});

test('triage: skip/info-maintenance when severity_text is info (info wins over action_required)', () => {
  assert.deepEqual(
    triage({
      'otel.event.name': 'factory.health.ok',
      severity_text: 'info',
      'factory.action_required': true,
    }),
    { action: 'skip', reason: 'info-maintenance' },
  );
});

test('triage: skip/not-action-required when action_required is false', () => {
  assert.deepEqual(
    triage({
      'otel.event.name': 'factory.deploy.completed',
      severity_text: 'error',
      'factory.action_required': false,
    }),
    { action: 'skip', reason: 'not-action-required' },
  );
});

test('triage: dispatch/actionable for a valid actionable event', () => {
  assert.deepEqual(
    triage({
      'otel.event.name': 'factory.deploy.failed',
      severity_text: 'error',
      'factory.action_required': true,
    }),
    { action: 'dispatch', reason: 'actionable' },
  );
});
