// Unit tests for the pure Google-OAuth helpers (no network). The module reads
// its config from env at import, so set env before the dynamic import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_ALLOWED_EMAILS = 'edri2or@gmail.com, Someone@Example.com';

const { googleConfigured, emailAllowed, googleAuthorizeUrl } = await import('../dist/google-oauth.js');

test('googleConfigured: true when id+secret present and not placeholder', () => {
  assert.equal(googleConfigured(), true);
});

test('emailAllowed: case-insensitive allowlist match', () => {
  assert.equal(emailAllowed('edri2or@gmail.com'), true);
  assert.equal(emailAllowed('EDRI2OR@GMAIL.COM'), true);
  assert.equal(emailAllowed('someone@example.com'), true);
});

test('emailAllowed: rejects anyone not on the list', () => {
  assert.equal(emailAllowed('attacker@evil.com'), false);
  assert.equal(emailAllowed(''), false);
});

test('googleAuthorizeUrl: builds a Google consent URL with our params', () => {
  const u = new URL(googleAuthorizeUrl('state123', 'https://gw.example/oauth/callback'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://gw.example/oauth/callback');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), 'openid email');
  assert.equal(u.searchParams.get('state'), 'state123');
});
