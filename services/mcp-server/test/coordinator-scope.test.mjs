// Unit tests for the coordinator scope's PURE parts (no network side effects).
// Mirrors factory-scope.test.mjs (tsc-gated, zero-dep: build first, then
// `npm test`). The facade must register EXACTLY the narrow read subset +
// route_to_agent — and NOTHING else (no broad dispatch_workflow, no provisioning
// tools). route_to_agent must expose no `phase` and no `requester_repo` field
// (both are server-controlled), and must refuse a non-allowlisted worker BEFORE
// any dispatch. The live walls (a real propose dispatch, no-bearer 401) are
// proven by coordinator-mcp-smoke.yml.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// coordinator-scope imports tools.js → github-client, which asserts these env
// vars at load. The paths under test never touch GitHub; dummy values satisfy the
// presence check so the import succeeds.
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';
// The allowlists are read at module load — pin them BEFORE the dynamic import.
process.env.COORDINATOR_REQUESTER_REPOS = 'nuriel';
process.env.COORDINATOR_WORKER_REPOS = 'nachshon,natan-research,sapi-docs';

const {
  isAllowedCoordinatorRepo,
  registerCoordinatorScopedTools,
  COORDINATOR_SCOPED_TOOL_NAMES,
} = await import('../dist/coordinator-scope.js');

const EXPECTED = [
  'get_file_contents',
  'get_pull_request',
  'get_repo',
  'get_run_jobs',
  'get_workflow_run',
  'list_commits',
  'list_pull_request_files',
  'list_workflow_runs',
  'route_to_agent',
];

function captureRegistrations(repo) {
  const tools = new Map();
  const fake = {
    tool(name, description, schema, handler) {
      tools.set(name, { description, schema, handler });
    },
  };
  registerCoordinatorScopedTools(fake, repo);
  return tools;
}

test('isAllowedCoordinatorRepo: only a shape-valid, allowlisted requester repo passes', () => {
  assert.equal(isAllowedCoordinatorRepo('nuriel'), true);
  assert.equal(isAllowedCoordinatorRepo('nachshon'), false); // valid shape, not a requester
  assert.equal(isAllowedCoordinatorRepo('Bad_Name'), false); // shape violation
  assert.equal(isAllowedCoordinatorRepo('ab'), false); // too short
  assert.equal(isAllowedCoordinatorRepo(''), false);
  assert.equal(isAllowedCoordinatorRepo('or-factory-master'), false);
});

test('facade registers EXACTLY the read subset + route_to_agent — nothing else', () => {
  const tools = captureRegistrations('nuriel');
  assert.deepEqual([...tools.keys()].sort(), EXPECTED);
  assert.deepEqual(COORDINATOR_SCOPED_TOOL_NAMES, EXPECTED);
  // The dangerous / broad surfaces are NOT registered here (allowlist, not blocklist).
  assert.equal(tools.has('dispatch_workflow'), false);
  assert.equal(tools.has('list_repos'), false);
  assert.equal(tools.has('list_system_secrets'), false);
  assert.equal(tools.has('list_gcp_projects'), false);
  assert.equal(tools.has('emit_event'), false);
});

test('route_to_agent schema: caller controls only worker_repo/task/correlation_id — never phase or requester_repo', () => {
  const tools = captureRegistrations('nuriel');
  const schema = tools.get('route_to_agent').schema;
  assert.equal('worker_repo' in schema, true);
  assert.equal('task' in schema, true);
  assert.equal('correlation_id' in schema, true);
  assert.equal('phase' in schema, false); // hard-coded propose, never an input
  assert.equal('requester_repo' in schema, false); // route-bound, never an input
  assert.equal('workflow_id' in schema, false);
});

test('route_to_agent refuses a non-allowlisted worker BEFORE any dispatch', async () => {
  const tools = captureRegistrations('nuriel');
  const { handler } = tools.get('route_to_agent');
  const res = await handler({ worker_repo: 'or-factory-master', task: 'x' });
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.error, 'worker_not_allowlisted');
  assert.deepEqual(payload.allowed.sort(), ['nachshon', 'natan-research', 'sapi-docs']);
});

test('route_to_agent refuses an unlisted-but-valid worker', async () => {
  const tools = captureRegistrations('nuriel');
  const { handler } = tools.get('route_to_agent');
  const res = await handler({ worker_repo: 'some-other-repo', task: 'x' });
  assert.equal(JSON.parse(res.content[0].text).error, 'worker_not_allowlisted');
});

test('route_to_agent refuses an empty task and a malformed correlation_id (before dispatch)', async () => {
  const tools = captureRegistrations('nuriel');
  const { handler } = tools.get('route_to_agent');
  const empty = JSON.parse((await handler({ worker_repo: 'natan-research', task: '   ' })).content[0].text);
  assert.equal(empty.error, 'empty_task');
  const badCorr = JSON.parse(
    (await handler({ worker_repo: 'natan-research', task: 'real', correlation_id: 'bad corr!' })).content[0].text,
  );
  assert.equal(badCorr.error, 'bad_correlation_id');
});
