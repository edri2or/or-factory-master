// Multi-tenant ("*") mode for the live-write allowlist. node --test runs each
// test file in its own process, so setting the env here doesn't affect the
// default-mode test in n8n-mcp-proxy.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';
process.env.N8N_DEV_ALLOWED_SYSTEMS = '*';

const { isAllowedN8nSystem } = await import('../dist/n8n-mcp-proxy.js');

test('wildcard: any syntactically-valid system name is allowed', () => {
  assert.equal(isAllowedN8nSystem('or-adhd-agent'), true);
  assert.equal(isAllowedN8nSystem('some-other-system'), true);
  assert.equal(isAllowedN8nSystem('svc-foo'), true);
});

test('wildcard: malformed / out-of-shape names are still refused', () => {
  assert.equal(isAllowedN8nSystem('AB'), false);            // too short + uppercase
  assert.equal(isAllowedN8nSystem('bad_name'), false);      // underscore
  assert.equal(isAllowedN8nSystem('-leading'), false);      // leading dash
  assert.equal(isAllowedN8nSystem('x'.repeat(40)), false);  // too long
  assert.equal(isAllowedN8nSystem('Has-Caps'), false);      // uppercase
});
