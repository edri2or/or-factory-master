// Google as the identity provider for the gateway's existing OAuth 2.1 server.
//
// Instead of the admin-secret authorize page, the operator logs in with Google.
// The gateway stays the OAuth Authorization Server the MCP client (Claude Code)
// talks to — it just delegates *identity* to Google: /oauth/authorize redirects
// to Google, /oauth/callback exchanges the Google code, verifies the email
// against an allowlist, and then issues the gateway's own auth code as before.
// The MCP client's PKCE is preserved end to end (its code_challenge is still
// checked at /oauth/token); the Google round-trip uses our confidential
// client_secret. Falls back to the admin-secret form when Google isn't
// configured, so deploys are safe before the Google client exists.

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

// Comma/space-separated allowlist of Google emails permitted to authenticate.
const ALLOWED_EMAILS = new Set(
  (process.env.OAUTH_ALLOWED_EMAILS ?? '')
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Treat as configured only when the id/secret are present AND not the deploy
// placeholder, so an un-seeded secret cleanly falls back to the admin form.
export function googleConfigured(): boolean {
  return Boolean(
    CLIENT_ID && CLIENT_SECRET &&
    CLIENT_ID !== '__NOT_CONFIGURED__' && CLIENT_SECRET !== '__NOT_CONFIGURED__',
  );
}

export function emailAllowed(email: string): boolean {
  // Empty allowlist = closed (nobody) — fail safe.
  return ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

export function googleAuthorizeUrl(serverState: string, callbackUrl: string): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', CLIENT_ID!);
  u.searchParams.set('redirect_uri', callbackUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email');
  u.searchParams.set('state', serverState);
  u.searchParams.set('access_type', 'online');
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

// === Workspace consent door (separate from operator LOGIN above) ===
//
// The shared Google identity's interactive-consent flow used to live on
// or-adhd-agent's n8n. These helpers move it into the gateway: request the 6
// workspace scopes OFFLINE so Google returns a refresh_token, capture it at the
// gateway's own callback, and persist it to control SM. Login (googleAuthorizeUrl
// / exchangeGoogleCode, access_type=online) is deliberately untouched — it never
// needs a refresh_token.
//
// TWO OAuth clients exist (proven live 2026-06-11): the gateway LOGIN client
// (google-oauth-client-*, CLIENT_ID above) and the shared WORKSPACE client
// (gmail-oauth-client-*) that minted the shared refresh token and that BOTH the
// workspace-mcp sidecar AND every system's n8n credential refresh with. A
// refresh token is bound to its issuing client — refreshing it with the other
// client fails with `unauthorized_client` (the stage-5 smoke failure: the door
// minted with the login client, the sidecar refreshed with the workspace one).
// So the consent door MUST mint with the WORKSPACE client below.

const WORKSPACE_CLIENT_ID = process.env.WORKSPACE_OAUTH_CLIENT_ID;
const WORKSPACE_CLIENT_SECRET = process.env.WORKSPACE_OAUTH_CLIENT_SECRET;

// The consent door is usable only when the WORKSPACE client creds are mounted
// (and not the deploy placeholder) — same posture as googleConfigured().
export function workspaceConsentConfigured(): boolean {
  return Boolean(
    WORKSPACE_CLIENT_ID && WORKSPACE_CLIENT_SECRET &&
    WORKSPACE_CLIENT_ID !== '__NOT_CONFIGURED__' &&
    WORKSPACE_CLIENT_SECRET !== '__NOT_CONFIGURED__',
  );
}

// The workspace scopes, in the SAME order/spelling as WORKSPACE_MCP_SCOPES
// (scripts/render-mcp-service-yaml.sh) — the Workspace-MCP sidecar's google-auth
// refuses to refresh a token whose grant differs ("Scope has changed"), so this
// list MUST stay byte-equal to that env.
//
// This is the FULL set the workspace-mcp sidecar (--tools calendar gmail drive
// docs) requires. Proven live 2026-06-11: a curated 6-scope grant only worked on
// the OLD client because it had ACCUMULATED the broad grants over prior consents;
// the fresh unified client granted exactly the 6 the door asked for, and the
// sidecar refresh then returned "Authentication Needed" (insufficient scopes). So
// the door must request the sidecar's full set — incl. openid/userinfo for account
// identification. These are write-capable; per-action write safety is the system's
// own HITL gate, not scope narrowing.
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

const WORKSPACE_SCOPE_STRING = WORKSPACE_SCOPES.join(' ');

// Sibling of googleAuthorizeUrl for the WORKSPACE consent (not login): requests
// the full WORKSPACE_SCOPES with access_type=offline + prompt=consent so Google
// ALWAYS returns a refresh_token, even on a re-consent. Includes openid/userinfo
// so the sidecar can identify the authenticated account. Uses the WORKSPACE client
// (not the login client) — see the two-client note above.
export function workspaceConsentUrl(serverState: string, callbackUrl: string): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', WORKSPACE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', callbackUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', WORKSPACE_SCOPE_STRING);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', serverState);
  return u.toString();
}

export interface WorkspaceConsentResult {
  refreshToken: string;
  scopes: string[];
}

// Pure validator (no network — exported for unit testing): checks a Google token
// response for the workspace consent flow. Throws if refresh_token is absent
// (Google deduped the grant — caller must retry; prompt=consent normally prevents
// this) OR if the granted scope set is not EXACTLY the workspace scopes
// (order-insensitive). The strict check is the safety gate: a mismatched grant is
// never persisted, because it would later fail the sidecar's refresh with
// "Scope has changed".
export function parseWorkspaceConsentResponse(json: {
  refresh_token?: string;
  scope?: string;
}): WorkspaceConsentResult {
  const refreshToken = json.refresh_token;
  if (!refreshToken) {
    throw new Error('google token response missing refresh_token (consent deduped — retry)');
  }
  const granted = (json.scope ?? '').split(/\s+/).filter(Boolean).sort();
  const expected = [...WORKSPACE_SCOPES].sort();
  const sameSet =
    granted.length === expected.length && expected.every((s, i) => granted[i] === s);
  if (!sameSet) {
    throw new Error(
      `granted scopes are not the expected workspace scopes (got: ${granted.join(' ') || '(none)'})`,
    );
  }
  return { refreshToken, scopes: granted };
}

// Exchanges a workspace-consent authorization code for a refresh_token, validating
// the response with parseWorkspaceConsentResponse. Mirrors exchangeGoogleCode but
// returns the refresh_token (login uses access_type=online and never gets one)
// and exchanges with the WORKSPACE client that started the consent.
export async function exchangeWorkspaceConsentCode(
  code: string,
  callbackUrl: string,
): Promise<WorkspaceConsentResult> {
  const body = new URLSearchParams({
    code,
    client_id: WORKSPACE_CLIENT_ID!,
    client_secret: WORKSPACE_CLIENT_SECRET!,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`google token exchange ${resp.status}: ${text.slice(0, 200)}`);
  }
  return parseWorkspaceConsentResponse(
    JSON.parse(text) as { refresh_token?: string; scope?: string },
  );
}

interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
}

// Exchange a Google authorization code for an id_token and extract the identity.
// The id_token comes straight from Google's token endpoint over TLS authenticated
// with our client_secret, so decoding its payload is sufficient here.
export async function exchangeGoogleCode(
  code: string,
  callbackUrl: string,
): Promise<GoogleIdentity> {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`google token exchange ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as { id_token?: string };
  if (!json.id_token) throw new Error('google token response missing id_token');
  const parts = json.id_token.split('.');
  if (parts.length < 2) throw new Error('malformed id_token');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
    email?: string;
    email_verified?: boolean | string;
  };
  if (!payload.email) throw new Error('id_token missing email');
  return {
    email: payload.email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}
