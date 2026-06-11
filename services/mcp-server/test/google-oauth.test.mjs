// Unit tests for the pure Google-OAuth helpers (no network). The module reads
// its config from env at import, so set env before the dynamic import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
// The WORKSPACE client is a DIFFERENT OAuth client from the login one (the
// two-client reality proven live 2026-06-11) — give it distinct values so the
// tests catch any cross-wiring of the two.
process.env.WORKSPACE_OAUTH_CLIENT_ID = 'workspace-client-id.apps.googleusercontent.com';
process.env.WORKSPACE_OAUTH_CLIENT_SECRET = 'workspace-secret';
process.env.OAUTH_ALLOWED_EMAILS = 'edri2or@gmail.com, Someone@Example.com';

const {
  googleConfigured,
  emailAllowed,
  googleAuthorizeUrl,
  workspaceConsentUrl,
  workspaceConsentConfigured,
  WORKSPACE_SCOPES,
  parseWorkspaceConsentResponse,
} = await import('../dist/google-oauth.js');

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

test('workspaceConsentConfigured: true when the workspace client creds are present', () => {
  assert.equal(workspaceConsentConfigured(), true);
});

test('workspaceConsentUrl: requests the 6 workspace scopes, offline + forced consent', () => {
  const u = new URL(workspaceConsentUrl('st8', 'https://gw.example/workspace/consent/callback'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  // MUST be the WORKSPACE client — minting with the login client produces a
  // token the sidecar/n8n (which refresh with the workspace client) cannot use.
  assert.equal(u.searchParams.get('client_id'), 'workspace-client-id.apps.googleusercontent.com');
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

test('login URL stays untouched while adding the consent door (openid email, online, login client)', () => {
  const login = new URL(googleAuthorizeUrl('s', 'https://gw/oauth/callback'));
  assert.equal(login.searchParams.get('scope'), 'openid email');
  assert.equal(login.searchParams.get('access_type'), 'online');
  assert.equal(login.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
});

test('parseWorkspaceConsentResponse: 6 scopes + refresh_token → returns the token', () => {
  const r = parseWorkspaceConsentResponse({ refresh_token: 'rt-123', scope: WORKSPACE_SCOPES.join(' ') });
  assert.equal(r.refreshToken, 'rt-123');
  assert.equal(r.scopes.length, 6);
});

test('parseWorkspaceConsentResponse: scope check is order-insensitive', () => {
  const reversed = [...WORKSPACE_SCOPES].reverse().join(' ');
  const r = parseWorkspaceConsentResponse({ refresh_token: 'rt', scope: reversed });
  assert.equal(r.refreshToken, 'rt');
});

test('parseWorkspaceConsentResponse: missing refresh_token → throws (nothing to persist)', () => {
  assert.throws(
    () => parseWorkspaceConsentResponse({ scope: WORKSPACE_SCOPES.join(' ') }),
    /refresh_token/,
  );
});

test('parseWorkspaceConsentResponse: scope mismatch → throws (never persisted)', () => {
  // too few
  assert.throws(
    () => parseWorkspaceConsentResponse({ refresh_token: 'rt', scope: WORKSPACE_SCOPES.slice(0, 5).join(' ') }),
    /6 workspace scopes/,
  );
  // an extra/unexpected scope
  assert.throws(
    () =>
      parseWorkspaceConsentResponse({
        refresh_token: 'rt',
        scope: WORKSPACE_SCOPES.join(' ') + ' https://www.googleapis.com/auth/extra',
      }),
    /6 workspace scopes/,
  );
});
