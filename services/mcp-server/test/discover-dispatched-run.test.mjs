// Unit tests for discoverDispatchedRun (github-client) — the fix for the stale run_id that
// shifted the coordinator's run↔correlation_id bookkeeping by one (Nuriel's "the task swapped"
// report). Pure function: getLatest + sleep are injected, so there is NO network and the test
// runs instantly. Mirrors coordinator-scope.test.mjs (tsc-gated: build first, then `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// github-client asserts these env vars at module load; the path under test never touches GitHub.
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';

const { discoverDispatchedRun } = await import('../dist/github-client.js');

const noSleep = async () => {};
const mkRun = (id) => ({ id, html_url: `https://x/${id}`, status: 'queued', created_at: '2026-06-19T00:00:00Z' });

test('returns the NEW run (id !== beforeId), not the stale latest', async () => {
  // getLatest first returns the stale prior run (100), then the freshly-created run (200).
  let calls = 0;
  const getLatest = async () => (++calls < 3 ? mkRun(100) : mkRun(200));
  const run = await discoverDispatchedRun(getLatest, 100, { attempts: 6, delayMs: 1, sleep: noSleep });
  assert.equal(run?.id, 200);
});

test('with no prior run (beforeId null), the first run found is returned', async () => {
  const getLatest = async () => mkRun(55);
  const run = await discoverDispatchedRun(getLatest, null, { attempts: 6, delayMs: 1, sleep: noSleep });
  assert.equal(run?.id, 55);
});

test('returns null when only the stale run is ever visible (no new run materialised)', async () => {
  const getLatest = async () => mkRun(100); // never changes from the baseline
  const run = await discoverDispatchedRun(getLatest, 100, { attempts: 3, delayMs: 1, sleep: noSleep });
  assert.equal(run, null);
});

test('tolerates a transient getLatest error and still finds the new run', async () => {
  let calls = 0;
  const getLatest = async () => {
    calls++;
    if (calls === 1) throw new Error('transient eventual-consistency blip');
    return calls < 3 ? mkRun(100) : mkRun(201);
  };
  const run = await discoverDispatchedRun(getLatest, 100, { attempts: 6, delayMs: 1, sleep: noSleep });
  assert.equal(run?.id, 201);
});
