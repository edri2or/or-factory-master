// Unit tests for the pure Google-OAuth helpers (no network). The module reads
// its config from env at import, so set env before the dynamic import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_ALLOWED_EMAILS = 'edri2or@gmail.com, Someone@Example.com';

const { googleConfigured, emailAllowed, googleAuthorizeUrl, workspaceConsentUrl, WORKSPACE_SCOPES } =
  await import('../dist/google-oauth.js');

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

test('workspaceConsentUrl: requests the 6 workspace scopes, offline + forced consent', () => {
  const u = new URL(workspaceConsentUrl('st8', 'https://gw.example/workspace/consent/callback'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://gw.example/workspace/consent/callback');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('state'), 'st8');
  assert.equal(
    u.searchParams.get('scope'),
    'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/gmail.settings.sharing https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents',
  );
});

test('workspaceConsentUrl: scope set is exactly the 6, byte-equal to WORKSPACE_SCOPES', () => {
  const u = new URL(workspaceConsentUrl('s', 'https://gw/cb'));
  assert.equal(u.searchParams.get('scope'), WORKSPACE_SCOPES.join(' '));
  assert.equal(WORKSPACE_SCOPES.length, 6);
});

test('login URL stays untouched while adding the consent door (openid email, online)', () => {
  const login = new URL(googleAuthorizeUrl('s', 'https://gw/oauth/callback'));
  assert.equal(login.searchParams.get('scope'), 'openid email');
  assert.equal(login.searchParams.get('access_type'), 'online');
});
