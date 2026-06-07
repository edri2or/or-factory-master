// Unit tests for the live-write proxy's PURE guards (no network / GCP side
// effects). Mirrors the tsc-gated, zero-dep convention of the other tests:
// build first, then `npm test`. devNameViolation enforces the scratch-only rule
// (only `dev-*` workflows may be created/updated live) — git stays the source of
// truth, the commit-side gate is the second half.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The module imports n8n-client → github-client, which asserts these env vars
// are present at load. The guards under test never touch GitHub; dummy values
// satisfy the presence check so the import succeeds.
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';

const { devNameViolation, isAllowedN8nSystem, isInitialize, looksLikeSessionExpired } = await import('../dist/n8n-mcp-proxy.js');

function call(toolName, args) {
  return { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } };
}

test('devNameViolation: create with a dev- name is allowed', () => {
  assert.equal(devNameViolation(call('n8n_create_workflow', { name: 'dev-smoke' })), null);
});

test('devNameViolation: create with a non-dev- name is refused', () => {
  const v = devNameViolation(call('n8n_create_workflow', { name: 'agent-router' }));
  assert.ok(typeof v === 'string' && v.includes('dev-'));
});

test('devNameViolation: update_full with a prod name is refused', () => {
  assert.ok(devNameViolation(call('n8n_update_full_workflow', { id: 'abc', name: 'ops-agent' })));
});

test('devNameViolation: update without an explicit name is allowed (commit gate is the backstop)', () => {
  assert.equal(devNameViolation(call('n8n_update_partial_workflow', { id: 'abc', operations: [] })), null);
});

test('devNameViolation: non-write tools are never blocked', () => {
  assert.equal(devNameViolation(call('n8n_list_workflows', {})), null);
  assert.equal(devNameViolation(call('search_nodes', { query: 'http' })), null);
});

test('devNameViolation: tolerates non tools/call messages and batches', () => {
  assert.equal(devNameViolation({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), null);
  assert.equal(devNameViolation([call('n8n_create_workflow', { name: 'dev-a' })]), null);
  const v = devNameViolation([call('search_nodes', {}), call('n8n_create_workflow', { name: 'prod' })]);
  assert.ok(typeof v === 'string');
});

test('isAllowedN8nSystem: default allowlist contains or-adhd-agent only', () => {
  assert.equal(isAllowedN8nSystem('or-adhd-agent'), true);
  assert.equal(isAllowedN8nSystem('some-other-system'), false);
});

test('isInitialize: detects an initialize request (single + batch), ignores others', () => {
  assert.equal(isInitialize({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }), true);
  assert.equal(isInitialize([{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 1, method: 'initialize' }]), true);
  assert.equal(isInitialize(call('n8n_list_workflows', {})), false);
  assert.equal(isInitialize({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), false);
  assert.equal(isInitialize(null), false);
});

test('looksLikeSessionExpired: matches n8n-mcp expired-session errors only', () => {
  // The real n8n-mcp message + the JSON-RPC session error code.
  assert.equal(looksLikeSessionExpired(400, 'application/json', '{"error":{"code":-32001,"message":"Session not found or expired"}}'), true);
  assert.equal(looksLikeSessionExpired(404, 'application/json', 'No valid session id for this request'), true);
  // A genuine non-session bad request must NOT be treated as expiry.
  assert.equal(looksLikeSessionExpired(400, 'application/json', '{"error":"invalid params: missing field"}'), false);
  // Success codes and SSE streams are never recovery candidates.
  assert.equal(looksLikeSessionExpired(200, 'application/json', 'session not found'), false);
  assert.equal(looksLikeSessionExpired(400, 'text/event-stream', 'session expired'), false);
});
