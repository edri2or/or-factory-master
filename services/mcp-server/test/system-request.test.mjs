// Unit tests for the system resource-request bridge's PURE decoders (no Telegram/
// GitHub/Linear side effects). Runs against the compiled output via `node --test`,
// matching the MCP server's zero-dep, tsc-gated convention. Build first
// (npm run build), then: npm test.
//
// system-request.js transitively imports github-client.js, which requires the
// broker App env vars to exist at module load. Set throwaway values FIRST, then
// dynamically import. The tested functions never read these vars.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { parseSystemRequestCallback, isSystemRequestCallback, isMergeableSelffixPr } = await import(
  '../dist/system-request.js'
);

test('parseSystemRequestCallback: approve carries the issue identifier', () => {
  assert.deepEqual(parseSystemRequestCallback('sysreq:OPS-42'), {
    action: 'approve',
    issueId: 'OPS-42',
  });
});

test('parseSystemRequestCallback: reject carries the issue identifier', () => {
  assert.deepEqual(parseSystemRequestCallback('sysno:ENG-7'), {
    action: 'reject',
    issueId: 'ENG-7',
  });
});

test('parseSystemRequestCallback: multi-digit team + number', () => {
  assert.deepEqual(parseSystemRequestCallback('sysreq:ABC123-9001'), {
    action: 'approve',
    issueId: 'ABC123-9001',
  });
});

test('parseSystemRequestCallback: unknown prefix → null', () => {
  assert.equal(parseSystemRequestCallback('oilapprove:OPS-42'), null);
  assert.equal(parseSystemRequestCallback('cdo:1'), null);
  assert.equal(parseSystemRequestCallback('OPS-42'), null);
});

test('parseSystemRequestCallback: malformed issue id → null', () => {
  assert.equal(parseSystemRequestCallback('sysreq:ops-42'), null); // lowercase team
  assert.equal(parseSystemRequestCallback('sysreq:OPS-'), null); // no number
  assert.equal(parseSystemRequestCallback('sysreq:-42'), null); // no team
  assert.equal(parseSystemRequestCallback('sysreq:'), null); // empty
  assert.equal(parseSystemRequestCallback('sysreq:OPS-42:extra'), null); // injected colon
  assert.equal(parseSystemRequestCallback('sysreq:OPS 42'), null); // space
});

test('isSystemRequestCallback: recognises only its own prefixes', () => {
  assert.equal(isSystemRequestCallback('sysreq:OPS-42'), true);
  assert.equal(isSystemRequestCallback('sysno:OPS-42'), true);
  assert.equal(isSystemRequestCallback('oilapprove:1'), false);
  assert.equal(isSystemRequestCallback('cdo:0'), false);
  assert.equal(isSystemRequestCallback(''), false);
});

// ── isMergeableSelffixPr — the card-free merge guard (author≠approver path) ──
// A valid, mergeable self-fix PR: or-aios system, open, base main, an
// oil-selffix/* (or oil-autofix/*) head, authored by the system's own App bot.
const OK = {
  state: 'open',
  baseRef: 'main',
  headRef: 'oil-selffix/round-3',
  authorLogin: 'or-aios-app[bot]',
  systemName: 'or-aios',
};

test('isMergeableSelffixPr: accepts a genuine open self-fix PR', () => {
  assert.equal(isMergeableSelffixPr(OK), true);
  assert.equal(isMergeableSelffixPr({ ...OK, headRef: 'oil-autofix/x' }), true); // both prefixes ok
});

test('isMergeableSelffixPr: rejects wrong system', () => {
  assert.equal(isMergeableSelffixPr({ ...OK, systemName: 'or-edri-4' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, systemName: '' }), false);
});

test('isMergeableSelffixPr: rejects wrong base branch', () => {
  assert.equal(isMergeableSelffixPr({ ...OK, baseRef: 'develop' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, baseRef: '' }), false);
});

test('isMergeableSelffixPr: rejects a non-self-fix head branch', () => {
  assert.equal(isMergeableSelffixPr({ ...OK, headRef: 'feature/x' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, headRef: 'main' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, headRef: 'oil-selffixx/x' }), false); // prefix must end in /
});

test('isMergeableSelffixPr: rejects a PR not authored by the system App', () => {
  assert.equal(isMergeableSelffixPr({ ...OK, authorLogin: 'someone-else' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, authorLogin: 'or-aios-app' }), false); // no [bot] suffix
  assert.equal(isMergeableSelffixPr({ ...OK, authorLogin: '' }), false);
});

test('isMergeableSelffixPr: rejects a non-open PR', () => {
  assert.equal(isMergeableSelffixPr({ ...OK, state: 'closed' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, state: 'merged' }), false);
  assert.equal(isMergeableSelffixPr({ ...OK, state: '' }), false);
});
