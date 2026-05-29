// Unit tests for the OIL approval bridge's PURE decoders (no Telegram/GitHub
// side effects). Runs against the compiled output via `node --test` — no test
// framework dependency, matching the MCP server's zero-dep, tsc-gated convention.
// Build first (npm run build), then: npm test.
//
// oil-approval.js transitively imports github-client.js, which requires the
// broker App env vars to exist at module load (a deliberate production guard).
// ESM evaluates static imports before any top-level code, so we set throwaway
// values FIRST and then dynamically import the module under test. The tested
// functions never read these vars.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { parseCallbackData, isAllowed } = await import('../dist/oil-approval.js');

test('parseCallbackData: legacy two-segment approve → factory repo', () => {
  assert.deepEqual(parseCallbackData('oilapprove:174'), {
    action: 'approve',
    repo: 'or-factory-master',
    pr: 174,
  });
});

test('parseCallbackData: legacy two-segment reject → factory repo', () => {
  assert.deepEqual(parseCallbackData('oilreject:171'), {
    action: 'reject',
    repo: 'or-factory-master',
    pr: 171,
  });
});

test('parseCallbackData: three-segment carries a system repo', () => {
  assert.deepEqual(parseCallbackData('oilapprove:factory-test-42:174'), {
    action: 'approve',
    repo: 'factory-test-42',
    pr: 174,
  });
  assert.deepEqual(parseCallbackData('oilreject:factory-test-42:9'), {
    action: 'reject',
    repo: 'factory-test-42',
    pr: 9,
  });
});

test('parseCallbackData: rejects a malformed/hostile repo segment', () => {
  assert.equal(parseCallbackData('oilapprove:Bad_Repo:1'), null); // uppercase + underscore
  assert.equal(parseCallbackData('oilapprove:../etc:1'), null); // path-ish
  assert.equal(parseCallbackData('oilapprove::1'), null); // empty repo
});

test('parseCallbackData: rejects unknown prefix', () => {
  assert.equal(parseCallbackData('foo:1'), null);
  assert.equal(parseCallbackData('approve:1'), null); // must be the namespaced tag
});

test('parseCallbackData: rejects non-numeric / malformed PR', () => {
  assert.equal(parseCallbackData('oilapprove:'), null);
  assert.equal(parseCallbackData('oilapprove:12x'), null);
  assert.equal(parseCallbackData('oilapprove:-1'), null);
  assert.equal(parseCallbackData('oilapprove:0'), null);
  assert.equal(parseCallbackData('oilapprove:1.5'), null);
});

test('parseCallbackData: empty / junk', () => {
  assert.equal(parseCallbackData(''), null);
  assert.equal(parseCallbackData('oilapprove'), null);
});

test('isAllowed: only allow-listed ids, never empty', () => {
  const allow = new Set(['12345', '67890']);
  assert.equal(isAllowed('12345', allow), true);
  assert.equal(isAllowed('67890', allow), true);
  assert.equal(isAllowed('99999', allow), false);
  assert.equal(isAllowed('', allow), false);
  assert.equal(isAllowed('12345', new Set()), false);
});

test('callback_data stays within Telegram 64-byte cap', () => {
  // Worst case: the longest prefix + a max-length (30-char) system_name + a
  // 10-digit PR number is still comfortably under 64 bytes.
  const data = `oilapprove:${'a'.repeat(30)}:${'9'.repeat(10)}`;
  assert.ok(Buffer.byteLength(data, 'utf8') <= 64, `callback_data ${data} exceeds 64 bytes`);
});
