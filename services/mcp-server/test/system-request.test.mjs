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

const { parseSystemRequestCallback, isSystemRequestCallback } = await import('../dist/system-request.js');

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
