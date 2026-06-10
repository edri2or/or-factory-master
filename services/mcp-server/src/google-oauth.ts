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

// The exact 6 workspace scopes, in the SAME order/spelling as WORKSPACE_MCP_SCOPES
// (scripts/render-mcp-service-yaml.sh) — the Workspace-MCP sidecar's google-auth
// refuses to refresh a token whose grant differs ("Scope has changed"), so this
// list MUST stay byte-equal to that env.
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
] as const;

const WORKSPACE_SCOPE_STRING = WORKSPACE_SCOPES.join(' ');

// Sibling of googleAuthorizeUrl for the WORKSPACE consent (not login): requests
// the 6 workspace scopes with access_type=offline + prompt=consent so Google
// ALWAYS returns a refresh_token, even on a re-consent. No openid/email — this
// flow captures a workspace grant, it does not identify a user.
export function workspaceConsentUrl(serverState: string, callbackUrl: string): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', CLIENT_ID!);
  u.searchParams.set('redirect_uri', callbackUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', WORKSPACE_SCOPE_STRING);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', serverState);
  return u.toString();
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
