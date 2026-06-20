// Unit tests for the agent-action approval bridge's PURE functions (no
// Telegram/GitHub side effects). Runs against the compiled output via
// `node --test`, matching the MCP server's zero-dep, tsc-gated convention.
// agent-approval.js transitively imports github-client.js, which requires the
// broker App env vars at module load — set throwaway values first, then import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const {
  parseAgentApprovalCallback,
  isAgentApprovalCallback,
  encodeAgentPayload,
  recoverAgentPayloadFromText,
} = await import('../dist/agent-approval.js');

test('parseAgentApprovalCallback: approve', () => {
  assert.deepEqual(parseAgentApprovalCallback('agentok:work-12345'), {
    action: 'approve',
    corr: 'work-12345',
  });
});

test('parseAgentApprovalCallback: reject', () => {
  assert.deepEqual(parseAgentApprovalCallback('agentno:work-12345'), {
    action: 'reject',
    corr: 'work-12345',
  });
});

test('parseAgentApprovalCallback: foreign / malformed → null', () => {
  assert.equal(parseAgentApprovalCallback('gcpok:5'), null);
  assert.equal(parseAgentApprovalCallback('agentok:bad corr'), null); // space not allowed
  assert.equal(parseAgentApprovalCallback('agentok:'), null);
});

test('isAgentApprovalCallback: only our two prefixes', () => {
  assert.equal(isAgentApprovalCallback('agentok:x'), true);
  assert.equal(isAgentApprovalCallback('agentno:x'), true);
  assert.equal(isAgentApprovalCallback('gcpok:x'), false);
  assert.equal(isAgentApprovalCallback('oilapprove:5'), false);
  assert.equal(isAgentApprovalCallback('hello'), false);
});

// The whole work unit travels as base64(JSON) between the sentinels; a card built
// by registerAgentApproval embeds exactly what encodeAgentPayload produces, so a
// round-trip through the realistic card text must recover the unit verbatim.
function card(blob, corr) {
  return (
    `🤖 משימת-סוכן אדומה — דרוש אישורך\n` +
    `מזהה: ${corr}\n` +
    `משימה:\nsummarise the README\n\n` +
    `⟦AGENT⟧${blob}⟦/AGENT⟧\n\n` +
    `אשר/דחה כאן:`
  );
}

test('encode → recover round-trips (corr matches the button)', () => {
  const unit = {
    worker_repo: 'worker-a',
    requester_repo: 'coord-test',
    task: 'summarise the README and propose a 3-step plan',
    correlation_id: 'work-abc-1',
  };
  const blob = encodeAgentPayload(unit);
  assert.deepEqual(recoverAgentPayloadFromText(card(blob, 'work-abc-1'), 'work-abc-1'), unit);
});

test('recover: freeform task with sentinels/newlines survives (base64 transport)', () => {
  const unit = {
    worker_repo: 'worker-a',
    requester_repo: 'coord-test',
    task: 'edit ⟦/AGENT⟧ and\nthen delete things — tricky\ttabs',
    correlation_id: 'work-9',
  };
  const blob = encodeAgentPayload(unit);
  // base64 alphabet cannot contain ⟦ or ⟧, so the boundary scan is unambiguous.
  assert.deepEqual(recoverAgentPayloadFromText(card(blob, 'work-9'), 'work-9'), unit);
});

test('recover: button corr must equal the embedded corr (binding)', () => {
  const blob = encodeAgentPayload({
    worker_repo: 'worker-a',
    requester_repo: 'coord-test',
    task: 'do a thing',
    correlation_id: 'work-A',
  });
  // A button for a DIFFERENT corr must not unlock this card's payload.
  assert.equal(recoverAgentPayloadFromText(card(blob, 'work-A'), 'work-B'), null);
});

test('recover: control/factory repos are refused', () => {
  for (const bad of [
    { worker_repo: 'or-factory-master', requester_repo: 'coord-test' },
    { worker_repo: 'worker-a', requester_repo: 'or-factory-master-control' },
    { worker_repo: 'worker-a', requester_repo: 'foo-control' },
  ]) {
    const blob = encodeAgentPayload({ ...bad, task: 'x', correlation_id: 'c1' });
    assert.equal(recoverAgentPayloadFromText(card(blob, 'c1'), 'c1'), null);
  }
});

test('recover: empty task is refused', () => {
  const blob = encodeAgentPayload({
    worker_repo: 'worker-a',
    requester_repo: 'coord-test',
    task: '   ',
    correlation_id: 'c2',
  });
  assert.equal(recoverAgentPayloadFromText(card(blob, 'c2'), 'c2'), null);
});

test('recover: missing sentinels / tampered base64 / undefined → null', () => {
  assert.equal(recoverAgentPayloadFromText('no sentinels here', 'c3'), null);
  assert.equal(recoverAgentPayloadFromText(undefined, 'c3'), null);
  assert.equal(recoverAgentPayloadFromText('⟦AGENT⟧not valid base64!!!⟦/AGENT⟧', 'c3'), null);
  // Valid base64 but not JSON for our shape → null.
  const junk = Buffer.from('hello world', 'utf8').toString('base64');
  assert.equal(recoverAgentPayloadFromText(`⟦AGENT⟧${junk}⟦/AGENT⟧`, 'c3'), null);
});
