// Unit tests for the GCP approval bridge's PURE decoders (no Telegram/GitHub
// side effects). Runs against the compiled output via `node --test`, matching the
// MCP server's zero-dep, tsc-gated convention. gcp-approval.js transitively
// imports github-client.js, which requires the broker App env vars at module
// load — set throwaway values first, then dynamically import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { parseGcpApprovalCallback, isGcpApprovalCallback, recoverCommandFromText } = await import(
  '../dist/gcp-approval.js'
);

test('parseGcpApprovalCallback: approve', () => {
  assert.deepEqual(parseGcpApprovalCallback('gcpok:del-gcp-hands'), {
    action: 'approve',
    corr: 'del-gcp-hands',
  });
});

test('parseGcpApprovalCallback: reject', () => {
  assert.deepEqual(parseGcpApprovalCallback('gcpno:run-12345'), {
    action: 'reject',
    corr: 'run-12345',
  });
});

test('parseGcpApprovalCallback: foreign / malformed → null', () => {
  assert.equal(parseGcpApprovalCallback('oilapprove:5'), null);
  assert.equal(parseGcpApprovalCallback('gcpok:bad corr'), null); // space not allowed
  assert.equal(parseGcpApprovalCallback('gcpok:'), null);
});

test('isGcpApprovalCallback: only our two prefixes', () => {
  assert.equal(isGcpApprovalCallback('gcpok:x'), true);
  assert.equal(isGcpApprovalCallback('gcpno:x'), true);
  assert.equal(isGcpApprovalCallback('sysreq:OPS-1'), false);
  assert.equal(isGcpApprovalCallback('hello'), false);
});

// The card embeds the command for display as "gcloud <cmd>"; the workflow's
// execute step prepends gcloud itself. recoverCommandFromText must strip the
// leading "gcloud " so the executed command is not doubled (the bug that made
// `gcloud gcloud projects delete …` → "Invalid choice: 'gcloud'").
test('recoverCommandFromText: strips the leading gcloud prefix', () => {
  const text =
    'פקודה:\n⟦CMD⟧gcloud projects delete gcp-hands-control --quiet⟦/CMD⟧\n\nאשר/דחה כאן:';
  assert.equal(recoverCommandFromText(text), 'projects delete gcp-hands-control --quiet');
});

test('recoverCommandFromText: works without a gcloud prefix too', () => {
  const text = '⟦CMD⟧secrets list --project=or-factory-master-control⟦/CMD⟧';
  assert.equal(recoverCommandFromText(text), 'secrets list --project=or-factory-master-control');
});

test('recoverCommandFromText: missing sentinels / shell metachars → null', () => {
  assert.equal(recoverCommandFromText('no sentinels here'), null);
  assert.equal(recoverCommandFromText(undefined), null);
  assert.equal(recoverCommandFromText('⟦CMD⟧rm -rf / ; echo $(whoami)⟦/CMD⟧'), null);
});
