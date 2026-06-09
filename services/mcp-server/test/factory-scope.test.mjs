// Unit tests for the factory telemetry scope's PURE parts (no network / GCP
// side effects). Mirrors the tsc-gated, zero-dep convention of the other
// tests: build first, then `npm test`. The facade must register EXACTLY the 8
// scoped tools, strip the tenant-identifying params from their schemas, and
// block cross-tenant probe URLs BEFORE the underlying handler (and any
// network call) runs. The live walls (403 on a foreign path, real reads) are
// proven by factory-mcp-smoke.yml.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// factory-scope imports tools.js → github-client, which asserts these env vars
// are present at load. The paths under test never touch GitHub; dummy values
// satisfy the presence check so the import succeeds.
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';

const {
  isAllowedFactorySystem,
  registerFactoryScopedTools,
  probeTenantViolation,
  FACTORY_SCOPED_TOOL_NAMES,
} = await import('../dist/factory-scope.js');

const EXPECTED = [
  'get_run_jobs',
  'inspect_n8n_execution',
  'inspect_railway_service',
  'list_n8n_workflows',
  'list_railway_deployments',
  'list_workflow_runs',
  'probe_endpoint',
  'tail_railway_deployment_logs',
];

function captureRegistrations(system) {
  const tools = new Map();
  const fake = {
    tool(name, description, schema, handler) {
      tools.set(name, { description, schema, handler });
    },
  };
  registerFactoryScopedTools(fake, system);
  return tools;
}

test('isAllowedFactorySystem: default "*" admits any VALID system name only', () => {
  assert.equal(isAllowedFactorySystem('or-adhd-agent'), true);
  assert.equal(isAllowedFactorySystem('factory-test-25'), true);
  assert.equal(isAllowedFactorySystem('Bad_Name'), false); // shape violation
  assert.equal(isAllowedFactorySystem('ab'), false); // too short
  assert.equal(isAllowedFactorySystem(''), false);
  assert.equal(isAllowedFactorySystem('a'.repeat(40)), false); // too long
});

test('facade registers EXACTLY the 8 scoped tools — nothing else exists on this surface', () => {
  const tools = captureRegistrations('or-adhd-agent');
  assert.deepEqual([...tools.keys()].sort(), EXPECTED);
  assert.deepEqual(FACTORY_SCOPED_TOOL_NAMES, EXPECTED);
  // Spot-check the dangerous ones are NOT registered (allowlist, not blocklist).
  assert.equal(tools.has('dispatch_workflow'), false);
  assert.equal(tools.has('list_system_secrets'), false);
  assert.equal(tools.has('list_gcp_projects'), false);
});

test('tenant-identifying params are stripped from the visible schemas', () => {
  const tools = captureRegistrations('or-adhd-agent');
  assert.equal('systemName' in tools.get('list_n8n_workflows').schema, false);
  const inspectExec = tools.get('inspect_n8n_execution').schema;
  assert.equal('systemName' in inspectExec, false);
  assert.equal('executionId' in inspectExec, true); // non-tenant params survive
  const runs = tools.get('list_workflow_runs').schema;
  assert.equal('owner' in runs, false);
  assert.equal('repo' in runs, false);
  assert.equal('workflow_id' in runs, true);
  const deployments = tools.get('list_railway_deployments').schema;
  assert.equal('projectId' in deployments, false);
  assert.equal('environmentId' in deployments, false);
  assert.equal('serviceId' in deployments, true);
  assert.equal('url' in tools.get('probe_endpoint').schema, true);
});

test('scoped descriptions state the per-system contract', () => {
  const tools = captureRegistrations('or-adhd-agent');
  assert.ok(tools.get('probe_endpoint').description.includes('n8n-or-adhd-agent.or-infra.com'));
  assert.ok(tools.get('list_workflow_runs').description.includes('edri2or/or-adhd-agent'));
});

test('probeTenantViolation: only the system\'s own https host passes', () => {
  assert.equal(probeTenantViolation('or-adhd-agent', 'https://n8n-or-adhd-agent.or-infra.com/healthz'), null);
  assert.ok(probeTenantViolation('or-adhd-agent', 'https://n8n-other-system.or-infra.com/healthz'));
  assert.ok(probeTenantViolation('or-adhd-agent', 'http://n8n-or-adhd-agent.or-infra.com/healthz')); // not https
  assert.ok(probeTenantViolation('or-adhd-agent', 'https://evil.com/?x=n8n-or-adhd-agent.or-infra.com'));
  assert.ok(probeTenantViolation('or-adhd-agent', 'not a url'));
  assert.ok(probeTenantViolation('or-adhd-agent', undefined));
});

test('cross-tenant probe is blocked by the registered handler BEFORE any network call', async () => {
  const tools = captureRegistrations('or-adhd-agent');
  const { handler } = tools.get('probe_endpoint');
  const res = await handler({ url: 'https://n8n-some-sibling.or-infra.com/healthz' });
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.error, 'tenant_blocked');
  assert.equal(payload.system, 'or-adhd-agent');
  assert.ok(payload.message.includes('n8n-or-adhd-agent.or-infra.com'));
});
