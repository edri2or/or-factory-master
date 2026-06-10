import { test } from 'node:test';
import assert from 'node:assert/strict';

// Satisfy transitive module-load env checks (mirrors test/project-quota.test.mjs).
// buildAddSecretVersionRequest is a pure helper — no network, no credentials.
process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { buildAddSecretVersionRequest } = await import('../dist/gcp-client.js');

test('buildAddSecretVersionRequest targets the secrets.addVersion endpoint', () => {
  const { url } = buildAddSecretVersionRequest(
    'or-factory-master-control',
    'gmail-oauth-refresh-token',
    'TESTVAL',
  );
  assert.equal(
    url,
    'https://secretmanager.googleapis.com/v1/projects/or-factory-master-control/secrets/gmail-oauth-refresh-token:addVersion',
  );
});

test('buildAddSecretVersionRequest base64-wraps the value and round-trips back', () => {
  const value = 'a-fake-refresh-token://value with spaces';
  const { body } = buildAddSecretVersionRequest('p', 'n', value);
  assert.equal(body.payload.data, Buffer.from(value, 'utf8').toString('base64'));
  assert.equal(Buffer.from(body.payload.data, 'base64').toString('utf8'), value);
});

test('buildAddSecretVersionRequest is add-only (no destroy/disable/enable verb)', () => {
  const { url } = buildAddSecretVersionRequest('p', 'n', 'v');
  assert.ok(url.endsWith(':addVersion'));
  assert.ok(!/:destroy|:disable|:enable/.test(url));
});

test('buildAddSecretVersionRequest url-encodes the path segments', () => {
  const { url } = buildAddSecretVersionRequest('proj/x', 'name x', 'v');
  assert.ok(url.includes('proj%2Fx'));
  assert.ok(url.includes('name%20x'));
});
