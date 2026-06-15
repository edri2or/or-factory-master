// Unit tests for the reliability-layer emit route's PURE pieces (no express / no
// Telegram / no secrets). Build first, then: npm test. Mirrors the tsc-gated
// convention (imports ../dist/*.js — see test/telegram-chat-guards.test.mjs).
// The 401 (no bearer) / 403 (cross-tenant) cases are the SHARED auth chain already
// proven by /factory/<system>/mcp (systemRouteAllows); here we cover the emit-specific
// surface: body validation (400), the kill-switch, and the rate-limiter (429).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validateEmitBody, isEmitAllowedSystem, createRateLimiter, EMIT_NAME_RE } = await import(
  '../dist/emit-route.js'
);

test('validateEmitBody: accepts a well-formed event', () => {
  const r = validateEmitBody({
    name: 'factory.n8n.workflow_failed',
    severity: 'error',
    action_required: true,
    body: { node: 'X' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.name, 'factory.n8n.workflow_failed');
  assert.equal(r.value.severity, 'error');
  assert.equal(r.value.actionRequired, true);
  assert.deepEqual(r.value.body, { node: 'X' });
  assert.equal(r.value.workflow, 'n8n'); // default
  assert.equal(typeof r.value.runId, 'string'); // default ISO timestamp
});

test('validateEmitBody: defaults action_required=false and body={}', () => {
  const r = validateEmitBody({ name: 'factory.automation.heartbeat', severity: 'info' });
  assert.equal(r.ok, true);
  assert.equal(r.value.actionRequired, false);
  assert.deepEqual(r.value.body, {});
});

test('validateEmitBody: rejects a non-object body', () => {
  for (const bad of [null, 42, 'x', [], undefined]) {
    assert.equal(validateEmitBody(bad).ok, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('validateEmitBody: rejects a name outside the factory.* namespace', () => {
  for (const n of ['evil.event', 'factory', 'Factory.X', 'factory.', '../etc', 'factory..x', 'factory.A.b']) {
    assert.equal(validateEmitBody({ name: n, severity: 'info' }).ok, false, `should reject name '${n}'`);
  }
  assert.match('factory.n8n.workflow_failed', EMIT_NAME_RE);
  assert.match('factory.automation.empty_result', EMIT_NAME_RE);
});

test('validateEmitBody: rejects an unknown or missing severity', () => {
  assert.equal(validateEmitBody({ name: 'factory.x.y', severity: 'fatal' }).ok, false);
  assert.equal(validateEmitBody({ name: 'factory.x.y' }).ok, false);
});

test('validateEmitBody: rejects a non-boolean action_required', () => {
  assert.equal(validateEmitBody({ name: 'factory.x.y', severity: 'info', action_required: 'yes' }).ok, false);
});

test('validateEmitBody: rejects an oversized body', () => {
  const big = { blob: 'a'.repeat(9000) };
  assert.equal(validateEmitBody({ name: 'factory.x.y', severity: 'info', body: big }).ok, false);
});

test('validateEmitBody: clamps long workflow/run_id labels', () => {
  const r = validateEmitBody({
    name: 'factory.x.y',
    severity: 'info',
    workflow: 'w'.repeat(500),
    run_id: 'r'.repeat(500),
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.workflow.length, 200);
  assert.equal(r.value.runId.length, 200);
});

test('isEmitAllowedSystem: default "*" admits any valid system', () => {
  // FACTORY_EMIT_ALLOWED_SYSTEMS unset in the test env → default '*'.
  assert.equal(isEmitAllowedSystem('or-edri-4'), true);
  assert.equal(isEmitAllowedSystem('factory-test-99'), true);
});

test('createRateLimiter: caps per system per window, resets after the window', () => {
  let t = 1_000_000;
  const rl = createRateLimiter(3, 1000, () => t);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), false); // 4th within the window → blocked
  assert.equal(rl.allow('b'), true); // a different system is independent
  t += 1001; // window elapses
  assert.equal(rl.allow('a'), true); // resets
});
