// Unit tests for the repo-deletion approval bridge's PURE decoders (no Telegram/
// GitHub side effects). Runs against the compiled output via `node --test`.
// repo-approval.js transitively imports github-client.js, which needs the broker
// App env vars at module load — set throwaway values first, then dynamic import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { parseRepoApprovalCallback, isRepoApprovalCallback, recoverReposFromText } = await import(
  '../dist/repo-approval.js'
);

test('parseRepoApprovalCallback: approve / reject', () => {
  assert.deepEqual(parseRepoApprovalCallback('rmok:run-12'), { action: 'approve', corr: 'run-12' });
  assert.deepEqual(parseRepoApprovalCallback('rmno:abc'), { action: 'reject', corr: 'abc' });
});

test('parseRepoApprovalCallback: foreign / malformed → null', () => {
  assert.equal(parseRepoApprovalCallback('gcpok:x'), null);
  assert.equal(parseRepoApprovalCallback('rmok:'), null);
  assert.equal(parseRepoApprovalCallback('rmok:bad corr'), null);
});

test('isRepoApprovalCallback: only our two prefixes', () => {
  assert.equal(isRepoApprovalCallback('rmok:x'), true);
  assert.equal(isRepoApprovalCallback('rmno:x'), true);
  assert.equal(isRepoApprovalCallback('gcpok:x'), false);
  assert.equal(isRepoApprovalCallback('hi'), false);
});

test('recoverReposFromText: recovers the list between sentinels', () => {
  const text = 'ריפוז למחיקה:\n⟦RM⟧svc-demo or-test-9 factory-test-7⟦/RM⟧\n\nאשר/דחה';
  assert.deepEqual(recoverReposFromText(text), ['svc-demo', 'or-test-9', 'factory-test-7']);
});

test('recoverReposFromText: drops protected (or-factory-master) and junk', () => {
  const text = '⟦RM⟧or-factory-master svc-demo bad/name rm-rf⟦/RM⟧';
  // or-factory-master is protected → dropped; bad/name fails the repo regex → dropped.
  assert.deepEqual(recoverReposFromText(text), ['svc-demo', 'rm-rf']);
});

test('recoverReposFromText: missing sentinels / empty → []', () => {
  assert.deepEqual(recoverReposFromText('no sentinels'), []);
  assert.deepEqual(recoverReposFromText(undefined), []);
  assert.deepEqual(recoverReposFromText('⟦RM⟧⟦/RM⟧'), []);
});
