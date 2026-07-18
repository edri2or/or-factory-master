import './instrument.js'; // Sentry.init — must run before anything else
import * as Sentry from '@sentry/node';
import express, { type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { registerOrgReadTools } from './org-read-tools.js';
import { verifyGitHubOidc } from './oidc-verifier.js';
import { signBearer, verifyBearer, revokeBearer, type BearerPayload, type BearerKind } from './bearer.js';
import { registerFactoryScopedTools, isAllowedFactorySystem } from './factory-scope.js';
import { sendTelegramMessage, emitEvent } from './observability-client.js';
import { validateEmitBody, isEmitAllowedSystem, createRateLimiter } from './emit-route.js';
import { handleLinearWebhook, registerLinearWebhook } from './oil-autofix.js';
import {
  registerGcpApproval,
  handleGcpApprovalCallback,
  isGcpApprovalCallback,
} from './gcp-approval.js';
import {
  registerRepoDelete,
  handleRepoApprovalCallback,
  isRepoApprovalCallback,
} from './repo-approval.js';
import { handleChatUpdate } from './telegram-chat.js';
import { proxyToN8nMcp, n8nMcpEnabled, isAllowedN8nSystem } from './n8n-mcp-proxy.js';
import { proxyToWorkspaceMcp, workspaceMcpEnabled, isAllowedWorkspaceSystem } from './workspace-mcp-proxy.js';
import {
  googleConfigured,
  googleAuthorizeUrl,
  exchangeGoogleCode,
  emailAllowed,
  workspaceConsentUrl,
  exchangeWorkspaceConsentCode,
  workspaceConsentConfigured,
} from './google-oauth.js';
import { addSecretVersion } from './gcp-client.js';

const PORT = Number(process.env.PORT ?? 3000);
const ADMIN_SECRET = process.env.MCP_ADMIN_SECRET;
if (!ADMIN_SECRET) throw new Error('MCP_ADMIN_SECRET env var is required');

const ADMIN_SECRET_HASH = createHash('sha256').update(ADMIN_SECRET).digest();

// Optional shared secret for the Better Stack → Telegram webhook forwarder
// (/bs-webhook). Absent → the route returns 503 (feature dormant until deployed
// with the secret mounted).
const BS_WEBHOOK_SECRET = process.env.BS_WEBHOOK_SECRET;
const BS_WEBHOOK_SECRET_HASH = BS_WEBHOOK_SECRET
  ? createHash('sha256').update(BS_WEBHOOK_SECRET).digest()
  : null;
function bsTokenMatches(provided: string | undefined): boolean {
  if (!BS_WEBHOOK_SECRET_HASH) return false;
  const hash = createHash('sha256').update(provided ?? '').digest();
  return timingSafeEqual(hash, BS_WEBHOOK_SECRET_HASH);
}

// Telegram's setWebhook secret_token. Telegram echoes it in the
// X-Telegram-Bot-Api-Secret-Token header on every callback, proving the request
// is genuinely from Telegram (the FIRST of two layers; the from.id allowlist in
// each approval handler is the second). Absent → /telegram-webhook returns 503
// (the approval bridge is dormant until deployed with the secret mounted).
const TELEGRAM_APPROVAL_WEBHOOK_SECRET = process.env.TELEGRAM_APPROVAL_WEBHOOK_SECRET;
const TELEGRAM_APPROVAL_WEBHOOK_SECRET_HASH = TELEGRAM_APPROVAL_WEBHOOK_SECRET
  ? createHash('sha256').update(TELEGRAM_APPROVAL_WEBHOOK_SECRET).digest()
  : null;
function telegramTokenMatches(provided: string | undefined): boolean {
  if (!TELEGRAM_APPROVAL_WEBHOOK_SECRET_HASH) return false;
  const hash = createHash('sha256').update(provided ?? '').digest();
  return timingSafeEqual(hash, TELEGRAM_APPROVAL_WEBHOOK_SECRET_HASH);
}

// PUBLIC_BASE_URL: Cloud Run (injected by deploy workflow from status.url).
// RAILWAY_PUBLIC_DOMAIN: Railway parallel deploy (ADR 139 blue-green; retired
// post-flip). localhost: local dev only — not reachable by claude.ai.
const BASE_URL = process.env.PUBLIC_BASE_URL
  ?? (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`);

// Control project the workspace consent door writes the captured refresh token
// back to (Secret Manager addVersion on gmail-oauth-refresh-token). Set as an env
// by render-mcp-service-yaml.sh; falls back to the literal for local/dev.
const CONTROL_PROJECT = process.env.CONTROL_PROJECT ?? 'or-factory-master-control';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days; Claude re-authorizes after
const TOKEN_TTL_SEC = Math.floor(TOKEN_TTL_MS / 1000);
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const OIDC_BEARER_TTL_MS = 60 * 60 * 1000;  // 1 hour — NIST SP 800-63C for ephemeral CI bearers
// Long-lived: this bearer is stored inside an n8n MCP Client Tool credential and
// must keep working unattended. Refreshed idempotently by each system's
// bootstrap-google-mcp.yml re-run.
const WORKSPACE_RUNTIME_TTL_MS = 365 * 24 * 60 * 60 * 1000;  // 1 year
const WORKSPACE_RUNTIME_TTL_SEC = Math.floor(WORKSPACE_RUNTIME_TTL_MS / 1000);
// Same posture as the workspace bearer: long-lived because it is stored inside
// an n8n MCP Client Tool credential at provision time and must keep working
// unattended; refreshed idempotently by a re-provision.
const FACTORY_RUNTIME_TTL_MS = 365 * 24 * 60 * 60 * 1000;  // 1 year
const FACTORY_RUNTIME_TTL_SEC = Math.floor(FACTORY_RUNTIME_TTL_MS / 1000);

// Reliability-layer emit route: a per-system circuit-breaker so an n8n error-storm
// can't fan unbounded emits at Telegram (emitEvent already dedups Linear + gates
// Telegram to warning+). Tunable via FACTORY_EMIT_RATE_LIMIT (events/min/system).
const emitRateLimiter = createRateLimiter(Number(process.env.FACTORY_EMIT_RATE_LIMIT ?? 60));

// A system-scoped route accepts exactly ONE system-scoped bearer kind — bound
// to the path's system — plus the operator-grade kinds ('oauth' = claude.ai /
// Google login, 'admin' = the CI admin-secret exchange; both already reach the
// full /mcp surface, so allowing them here grants nothing extra). Every OTHER
// kind is refused, including a DIFFERENT route's system-scoped bearer: a
// long-lived runtime token stored in one surface's credential (e.g. a
// workspace-runtime bearer inside an n8n node) can never drive another surface.
function systemRouteAllows(payload: BearerPayload, scopedKind: BearerKind, system: string): boolean {
  if (payload.kind === scopedKind) return payload.system === system;
  return payload.kind === 'oauth' || payload.kind === 'admin';
}

interface PendingCode {
  redirectUri: string;
  codeChallenge: string;
  expiry: number;
}

const pendingCodes = new Map<string, PendingCode>();

function secretMatches(provided: string | undefined): boolean {
  const hash = createHash('sha256').update(provided ?? '').digest();
  return timingSafeEqual(hash, ADMIN_SECRET_HASH);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (now > data.expiry) pendingCodes.delete(code);
  }
}, 60_000).unref();

// Pending Google logins: maps our random `serverState` (sent to Google) back to
// the MCP client's original OAuth request, so its PKCE/state survive the Google
// round-trip. Used only when Google login is configured.
interface PendingAuth {
  clientRedirectUri: string;
  clientState: string;
  codeChallenge: string;
  expiry: number;
}
const pendingAuth = new Map<string, PendingAuth>();
setInterval(() => {
  const now = Date.now();
  for (const [s, data] of pendingAuth) {
    if (now > data.expiry) pendingAuth.delete(s);
  }
}, 60_000).unref();

// Pending WORKSPACE consents (separate from pendingAuth's login PKCE state): maps
// the random serverState sent to Google back so the /workspace/consent/callback
// can verify the round-trip is one we started (CSRF) and is one-time + TTL-bound.
// Carries no client redirect — the consent has no downstream client; the callback
// just captures the refresh_token and writes it to SM.
const pendingConsent = new Map<string, { expiry: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [s, data] of pendingConsent) {
    if (now > data.expiry) pendingConsent.delete(s);
  }
}, 60_000).unref();

// ── Request log ring buffer (last 50 — diagnostic via /debug/recent) ─────────

interface ReqLog {
  ts: string;
  method: string;
  path: string;
  src: string;
  ua: string;
  contentType: string;
  bodyPreview: string;
  status?: number;
  ms?: number;
}
const reqLog: ReqLog[] = [];
const REQ_LOG_MAX = 50;

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
// Capture the raw body so signature-verifying webhooks (e.g. /linear-webhook,
// which checks an HMAC over the exact bytes) can re-hash it; req.body stays the
// parsed JSON for every other route.
app.use(express.json({ verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next) => {
  const started = Date.now();
  const entry: ReqLog = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    src: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '-',
    ua: (req.headers['user-agent'] as string) || '-',
    contentType: (req.headers['content-type'] as string) || '-',
    bodyPreview: typeof req.body === 'object' ? JSON.stringify(req.body).slice(0, 400) : '',
  };
  reqLog.push(entry);
  if (reqLog.length > REQ_LOG_MAX) reqLog.shift();
  process.stdout.write(`[REQ] ${entry.ts} ${entry.method} ${entry.path} src=${entry.src} ua="${entry.ua}" ct=${entry.contentType}\n`);
  res.on('finish', () => {
    entry.status = res.statusCode;
    entry.ms = Date.now() - started;
    process.stdout.write(`[RES] ${new Date().toISOString()} ${entry.method} ${entry.path} -> ${entry.status} (${entry.ms}ms)\n`);
  });
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'factory-actions-mcp' });
});

// Admin-gated Sentry connectivity probe. Captures a marked exception EXPLICITLY
// (not via throw) so _verify-sentry.yml gets a deterministic outcome:
//   - the verify_marker tag is attached directly (no scope-propagation guesswork),
//   - Sentry.flush() is awaited so the event is transmitted before the response
//     (critical on Cloud Run min-instances=0, where a fire-and-forget send can be
//     cut off when the instance idles),
//   - the response returns the server-generated event_id + initialized/flushed,
//     so the verifier can fetch the exact event by id (no tag-search lag) and can
//     tell a disabled SDK apart from a failed ingest.
// app.all so the verifier can POST a body (exercising the beforeSend scrubber).
app.all('/debug/sentry-test', async (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const q = req.query.marker;
  const marker = typeof q === 'string' && q.length > 0 ? q : 'none';
  const eventId = Sentry.captureException(new Error(`sentry-verify ${marker}`), {
    tags: { verify_marker: marker },
  });
  const flushed = await Sentry.flush(3000);
  res.status(500).json({ ok: false, marker, event_id: eventId, initialized: Sentry.isInitialized(), flushed });
});

// Better Stack → Telegram forwarder. Better Stack has no native Telegram channel,
// so its uptime monitors POST here (Integrations → Exporting data → Webhook) and
// we relay to Telegram. Gated by a URL token (?token=) compared constant-time
// against BS_WEBHOOK_SECRET. Always answers 2xx within Better Stack's 30s budget
// (so it never retry-storms); the Telegram outcome is in the response body.
app.all('/bs-webhook', async (req: Request, res: Response) => {
  if (!BS_WEBHOOK_SECRET_HASH) {
    res.status(503).json({ error: 'bs_webhook_disabled' });
    return;
  }
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!bsTokenMatches(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v));
  const event = str(body['event']).toLowerCase();
  const emoji = event.includes('resolv') ? '🟢' : event.includes('ack') ? '🟡' : '🔴';
  const name = str(body['name']);
  const cause = str(body['cause']);
  const url = str(body['url']);
  const incidentId = str(body['incident_id']);
  let text: string;
  if (name || cause || url || incidentId) {
    text =
      `${emoji} Better Stack${event ? ` (${event})` : ''}\n` +
      `${name || 'incident'}${cause ? ` — ${cause}` : ''}` +
      `${url ? `\n${url}` : ''}${incidentId ? `\n#${incidentId}` : ''}`;
  } else {
    // Unknown template shape — forward a compact dump so nothing is lost.
    text = `${emoji} Better Stack incident\n${JSON.stringify(body).slice(0, 800)}`;
  }
  const tg = await sendTelegramMessage(text);
  res.status(200).json({ ok: true, telegram: tg.status, http: tg.http ?? null });
});

// Linear → OIL auto-fix "bell". Linear POSTs here when an OIL issue is created
// (outbound webhook). We verify the Linear-Signature HMAC over the raw body,
// drop noise with deterministic rules, and repository_dispatch the read-only
// investigator for real actionable failures. Always 2xx unless the signature is
// bad, so Linear never retry-storms or auto-disables the webhook.
app.post('/linear-webhook', async (req: Request, res: Response) => {
  try {
    const r = await handleLinearWebhook(req);
    res.status(r.status).json(r.body);
  } catch (e) {
    process.stdout.write(`[linear-webhook] error: ${String(e).slice(0, 300)}\n`);
    res.status(200).json({ error: 'internal', detail: String(e).slice(0, 200) });
  }
});

// One-time, idempotent registration of the Linear outbound webhook →
// /linear-webhook. Admin-gated (X-Admin-Secret) so the operator/agent can
// register without the Linear UI. Safe to call repeatedly.
app.post('/oil-register-webhook', async (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const r = await registerLinearWebhook(BASE_URL);
  res.status(r.status).json(r.body);
});

// GCP risk-gate — REGISTER. gcp-action.yml (red path) calls this (admin-gated,
// X-Admin-Secret) for a command the classifier tiered RED. It sends Or one Telegram
// card with ✅/❌ buttons; the command is embedded in the card text for stateless
// recovery on ✅. Body: { command, correlation_id, reason? }.
app.post('/gcp-approval-register', async (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const r = await registerGcpApproval({
    command: String(body['command'] ?? ''),
    correlation_id: String(body['correlation_id'] ?? ''),
    reason: typeof body['reason'] === 'string' ? body['reason'] : undefined,
  });
  res.status(r.status).json(r.body);
});

// Repo-deletion gate — REGISTER. propose-repo-delete.yml calls this (admin-gated,
// X-Admin-Secret) to send Or one ✅/❌ card listing repos to delete. The deletion
// runs ONLY in the Telegram callback (handleRepoApprovalCallback) — never here.
// Body: { repos: string[], correlation_id }.
app.post('/repo-delete-register', async (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const reposRaw = body['repos'];
  const repos = Array.isArray(reposRaw)
    ? reposRaw.map((r) => String(r))
    : String(reposRaw ?? '').split(/[\s,]+/).filter(Boolean);
  const r = await registerRepoDelete({
    repos,
    correlation_id: String(body['correlation_id'] ?? ''),
  });
  res.status(r.status).json(r.body);
});

// Unified Telegram bridge — INBOUND. The single factory bot's webhook posts here
// for BOTH Or's free-form chat messages AND the HITL approval ✅/❌ button presses
// (one bot, one webhook). Gated by the secret_token Telegram echoes in
// X-Telegram-Bot-Api-Secret-Token (constant-time). Routes by callback prefix: a
// GCP red-op callback (gcpok:/gcpno:) → handleGcpApprovalCallback; a repo-delete
// callback → handleRepoApprovalCallback; everything else (a text message, or a
// chat HITL cdo:/cno: callback) → handleChatUpdate.
// Always answers 200 (Telegram retries non-2xx) — the real outcome is in the
// body; any reply is delivered out-of-band via a separate sendMessage.
app.post('/telegram-webhook', async (req: Request, res: Response) => {
  if (!TELEGRAM_APPROVAL_WEBHOOK_SECRET_HASH) {
    res.status(503).json({ error: 'telegram_webhook_disabled' });
    return;
  }
  const token = (req.headers['x-telegram-bot-api-secret-token'] as string | undefined) ?? '';
  if (!telegramTokenMatches(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const update = (req.body ?? {}) as Record<string, unknown>;
    const cq = update['callback_query'] as Record<string, unknown> | undefined;
    const data = cq && typeof cq['data'] === 'string' ? (cq['data'] as string) : '';
    const isGcpCallback = isGcpApprovalCallback(data);
    const isRepoCallback = isRepoApprovalCallback(data);
    let r;
    if (isGcpCallback) {
      r = await handleGcpApprovalCallback(req);
    } else if (isRepoCallback) {
      r = await handleRepoApprovalCallback(req);
    } else {
      r = await handleChatUpdate(req);
    }
    res.status(r.status).json(r.body);
  } catch (e) {
    process.stdout.write(`[telegram-webhook] error: ${String(e).slice(0, 300)}\n`);
    res.status(200).json({ error: 'internal' });
  }
});

// Diagnostic — returns recent requests. Accepts X-Admin-Secret or Bearer.
app.get('/debug/recent', (req: Request, res: Response) => {
  const adminProvided = (req.headers['x-admin-secret'] as string) || '';
  const authHeader = req.headers['authorization'] ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const bearerValid = bearer ? verifyBearer(bearer) !== null : false;
  if (!secretMatches(adminProvided) && !bearerValid) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.json({ recent: reqLog });
});

// OAuth 2.1 authorization server metadata (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    registration_endpoint: `${BASE_URL}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
});

// Dynamic Client Registration (RFC 7591) — required by Anthropic's MCP gateway.
// We don't actually authenticate the client (auth_method=none); the synthetic
// client_id is purely so the gateway has a value to send back in /authorize.
app.post('/oauth/register', (req: Request, res: Response) => {
  const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
  const clientId = `mcp-${randomBytes(16).toString('hex')}`;
  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: body['redirect_uris'] ?? [],
    client_name: body['client_name'] ?? 'mcp-client',
  });
});

// OAuth 2.0 Protected Resource Metadata (RFC 9728) — required by MCP auth spec.
// claude.ai uses this to discover which authorization server protects /mcp.
app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  res.json({
    resource: BASE_URL,
    authorization_servers: [BASE_URL],
    bearer_methods_supported: ['header'],
  });
});

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Authorization (GET). When Google login is configured, redirect the operator
// to Google (delegated identity) — the MCP client's PKCE/state are stashed in
// pendingAuth, keyed by a random serverState, and restored in /oauth/callback.
// Otherwise fall back to the admin-secret form (backward compatible).
app.get('/oauth/authorize', (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;

  if (googleConfigured()) {
    const redirect_uri = q['redirect_uri'] ?? '';
    const code_challenge = q['code_challenge'] ?? '';
    if (!redirect_uri) { res.status(400).send('Missing redirect_uri'); return; }
    if (!code_challenge || q['code_challenge_method'] !== 'S256') {
      res.status(400).send('PKCE with code_challenge_method=S256 is required');
      return;
    }
    const serverState = randomBytes(32).toString('hex');
    pendingAuth.set(serverState, {
      clientRedirectUri: redirect_uri,
      clientState: q['state'] ?? '',
      codeChallenge: code_challenge,
      expiry: Date.now() + AUTH_CODE_TTL_MS,
    });
    res.redirect(302, googleAuthorizeUrl(serverState, `${BASE_URL}/oauth/callback`));
    return;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize factory-actions-mcp</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 80px auto; padding: 0 1rem; color: #111; }
    h2 { margin-bottom: .25rem; }
    p { color: #555; margin-top: 0; }
    input[type=password] { width: 100%; padding: .5rem; margin: .5rem 0 1rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    button { padding: .5rem 1.5rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h2>factory-actions-mcp</h2>
  <p>Authorize Claude to access GitHub Actions for <strong>edri2or/or-factory-master</strong>.</p>
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="redirect_uri"           value="${esc(q['redirect_uri'] ?? '')}">
    <input type="hidden" name="state"                  value="${esc(q['state'] ?? '')}">
    <input type="hidden" name="code_challenge"         value="${esc(q['code_challenge'] ?? '')}">
    <input type="hidden" name="code_challenge_method"  value="${esc(q['code_challenge_method'] ?? '')}">
    <input type="hidden" name="client_id"              value="${esc(q['client_id'] ?? '')}">
    <label for="secret">Admin secret</label>
    <input type="password" id="secret" name="secret" autocomplete="current-password" autofocus required>
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`);
});

app.post('/oauth/authorize', (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const { redirect_uri, state, code_challenge, code_challenge_method, secret } = body;

  if (!redirect_uri) { res.status(400).send('Missing redirect_uri'); return; }
  if (!code_challenge || code_challenge_method !== 'S256') {
    res.status(400).send('PKCE with code_challenge_method=S256 is required');
    return;
  }
  if (!secretMatches(secret)) { res.status(403).send('Invalid admin secret'); return; }

  const code = randomBytes(32).toString('hex');
  pendingCodes.set(code, {
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    expiry: Date.now() + AUTH_CODE_TTL_MS,
  });

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(302, url.toString());
});

// Google login callback. Google redirects here after the operator authenticates;
// we exchange the code for the identity, check the email allowlist, then mint our
// own auth code (bound to the MCP client's PKCE) and redirect back to the client.
app.get('/oauth/callback', async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const serverState = q['state'] ?? '';
  const googleCode = q['code'] ?? '';
  const pending = pendingAuth.get(serverState);
  if (!pending || Date.now() > pending.expiry) {
    res.status(400).send('Login session expired or invalid — please reconnect.');
    return;
  }
  pendingAuth.delete(serverState);
  if (q['error']) { res.status(403).send(`Google login failed: ${esc(q['error'])}`); return; }
  if (!googleCode) { res.status(400).send('Missing authorization code from Google.'); return; }

  let identity;
  try {
    identity = await exchangeGoogleCode(googleCode, `${BASE_URL}/oauth/callback`);
  } catch (e) {
    process.stdout.write(`[oauth/callback] google exchange error: ${String(e).slice(0, 200)}\n`);
    res.status(502).send('Could not complete Google login. Please try again.');
    return;
  }
  if (!identity.emailVerified || !emailAllowed(identity.email)) {
    res.status(403).send('This Google account is not authorized for this server.');
    return;
  }

  const code = randomBytes(32).toString('hex');
  pendingCodes.set(code, {
    redirectUri: pending.clientRedirectUri,
    codeChallenge: pending.codeChallenge,
    expiry: Date.now() + AUTH_CODE_TTL_MS,
  });
  const url = new URL(pending.clientRedirectUri);
  url.searchParams.set('code', code);
  if (pending.clientState) url.searchParams.set('state', pending.clientState);
  res.redirect(302, url.toString());
});

app.post('/oauth/token', (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const { grant_type, code, code_verifier } = body;

  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' }); return;
  }

  const pending = pendingCodes.get(code);
  if (!pending || Date.now() > pending.expiry) {
    res.status(400).json({ error: 'invalid_grant' }); return;
  }

  if (!code_verifier) { res.status(400).json({ error: 'invalid_grant' }); return; }
  const challenge = createHash('sha256').update(code_verifier).digest('base64url');
  if (challenge !== pending.codeChallenge) {
    res.status(400).json({ error: 'invalid_grant' }); return;
  }

  pendingCodes.delete(code);
  const token = signBearer(TOKEN_TTL_MS, 'oauth');

  res.json({ access_token: token, token_type: 'Bearer', expires_in: TOKEN_TTL_SEC });
});

// === Workspace consent door (Google) — the permanent home for the shared
// identity's interactive re-consent, moved off or-adhd-agent's n8n into the
// gateway. ===
//
// /workspace/consent/start: admin-gated (X-Admin-Secret), called server-side by
// request-workspace-scopes-consent.yml. Redirects to Google's full-scope OFFLINE
// consent; the caller reads the Location header and Telegrams that accounts.google.com
// link to Or. The matching /workspace/consent/callback (added in the next stage)
// captures the refresh_token Google returns and writes it to control SM.
app.get('/workspace/consent/start', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  if (!workspaceConsentConfigured()) {
    res.status(503).json({ error: 'workspace_client_not_configured' });
    return;
  }
  const serverState = randomBytes(32).toString('hex');
  pendingConsent.set(serverState, { expiry: Date.now() + AUTH_CODE_TTL_MS });
  res.redirect(302, workspaceConsentUrl(serverState, `${BASE_URL}/workspace/consent/callback`));
});

// /workspace/consent/callback: Google redirects Or's browser here after he grants
// the full Workspace scope set. Validates the state (CSRF, one-time, TTL), exchanges
// the code for a refresh_token (exchangeWorkspaceConsentCode enforces the exact-scope-set guard), and
// writes it as a NEW version of control SM gmail-oauth-refresh-token (old version
// stays as rollback). NOT admin-gated — Google can't send X-Admin-Secret; the random
// one-time state IS the protection (same posture as /oauth/callback).
app.get('/workspace/consent/callback', async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const serverState = q['state'] ?? '';
  const pending = pendingConsent.get(serverState);
  if (!pending || Date.now() > pending.expiry) {
    res.status(400).send('Consent session expired or invalid — please restart the consent.');
    return;
  }
  pendingConsent.delete(serverState);
  if (q['error']) { res.status(403).send(`Google consent failed: ${esc(q['error'])}`); return; }
  const code = q['code'] ?? '';
  if (!code) { res.status(400).send('Missing authorization code from Google.'); return; }

  let result;
  try {
    result = await exchangeWorkspaceConsentCode(code, `${BASE_URL}/workspace/consent/callback`);
  } catch (e) {
    process.stdout.write(`[workspace/consent] exchange/scope error: ${String(e).slice(0, 200)}\n`);
    res.status(502).send('Could not capture the workspace consent (token or scope check failed). Please retry.');
    return;
  }

  try {
    await addSecretVersion(CONTROL_PROJECT, 'gmail-oauth-refresh-token', result.refreshToken);
  } catch (e) {
    process.stdout.write(`[workspace/consent] SM write error: ${String(e).slice(0, 200)}\n`);
    res.status(500).send('Captured the consent but could not store the token. Please retry.');
    return;
  }

  process.stdout.write(`[workspace/consent] captured + stored a fresh refresh token (${result.scopes.length} scopes)\n`);
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workspace consent</title></head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;color:#111"><h2>✅ Workspace re-consented</h2><p>The gateway captured a fresh Google token (${result.scopes.length} scopes) and stored it securely. Redeploy/restart the gateway to load it. You can close this tab.</p></body></html>`);
});

// Server-to-server bearer exchange for trusted callers (CI workflows via WIF→SM).
// Skips OAuth/PKCE — gated on the same admin secret that protects /oauth/authorize.
// Enables the agent-autonomy invariant (ADR 143): the factory-verify-system workflow
// fetches mcp-server-admin-secret from GCP SM, exchanges it here for a bearer, and
// calls verifier tools via JSON-RPC at /mcp — no interactive OAuth, no host allowlist.
app.post('/token', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const token = signBearer(TOKEN_TTL_MS, 'admin');
  res.json({ access_token: token, token_type: 'Bearer', expires_in: TOKEN_TTL_SEC });
});

// Keyless bearer exchange via GitHub Actions OIDC. Identity binding (allow-listed
// repository + workflow_ref) is enforced inside verifyGitHubOidc.
app.post('/oidc/token', async (req: Request, res: Response) => {
  const idToken = (req.body as Record<string, string> | undefined)?.['id_token'] ?? '';
  if (!idToken) { res.status(400).json({ error: 'missing_id_token' }); return; }
  try {
    const claims = await verifyGitHubOidc(idToken);
    const token = signBearer(OIDC_BEARER_TTL_MS, 'oidc');
    process.stdout.write(`[OIDC] minted bearer for ${claims.repository}@${claims.workflow_ref} run=${claims.run_id}\n`);
    res.json({ access_token: token, token_type: 'Bearer', expires_in: Math.floor(OIDC_BEARER_TTL_MS / 1000) });
  } catch (e) {
    res.status(401).json({ error: 'invalid_oidc_token', detail: (e as Error).message });
  }
});

// Revoke a bearer token. Used by the factory-verify-system workflow after
// each run so one-shot tokens are dropped immediately rather than waiting for TTL.
app.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) revokeBearer(token);
  res.json({ ok: true });
});

// One McpServer per request: SDK ties server↔transport 1:1, so stateless concurrency requires per-request instances.
app.all('/mcp', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || verifyBearer(token) === null) {
    res
      .status(401)
      .set(
        'WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      )
      .json({ error: 'unauthorized' });
    return;
  }

  const server = new McpServer({ name: 'factory-actions-mcp', version: '1.0.0' });
  registerTools(server);
  registerOrgReadTools(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => undefined);
  }
});

// ── Live n8n development (MCP write) — per-system, isolated ─────────────────────
//
// /n8n/<system>/mcp reverse-proxies the MCP protocol to the internal n8n-mcp
// sidecar, which the proxy points at the RIGHT system's live n8n by injecting
// x-n8n-url / x-n8n-key server-side (n8n-mcp-proxy.ts). The system identity is
// the URL path AND, for system-scoped 'n8n-dev' bearers, the signed `system`
// claim — a token minted for one system is a hard 403 on any other path.

// Mint a system-scoped live-write bearer (admin-gated, X-Admin-Secret). The
// Claude-Code path can fetch mcp-server-admin-secret from SM and exchange it
// here for a token bound to exactly one system. (The claude.ai OAuth flow issues
// a generic 'oauth' bearer, which the allowlist below still permits in v1.)
app.post('/n8n/:system/token', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const system = req.params.system;
  if (!isAllowedN8nSystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const token = signBearer(TOKEN_TTL_MS, 'n8n-dev', { system });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: TOKEN_TTL_SEC });
});

app.all('/n8n/:system/mcp', async (req: Request, res: Response) => {
  const system = req.params.system;
  if (!n8nMcpEnabled()) {
    res.status(503).json({ error: 'n8n_live_write_disabled' });
    return;
  }
  if (!isAllowedN8nSystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyBearer(token) : null;
  if (!token || payload === null) {
    res
      .status(401)
      .set(
        'WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      )
      .json({ error: 'unauthorized' });
    return;
  }
  // Hard tenant isolation: only an n8n-dev bearer for THIS system (or an
  // operator-grade bearer) may drive the live-write proxy.
  if (!systemRouteAllows(payload, 'n8n-dev', system)) {
    res.status(403).json({ error: 'system_mismatch' });
    return;
  }
  await proxyToN8nMcp(req, res, system);
});

// ── Google Workspace MCP — shared identity, per-system bearer ───────────────────
//
// /workspace/<system>/mcp reverse-proxies the MCP protocol to the internal
// Google Workspace MCP sidecar. Every system shares ONE Google identity (the
// shared gmail-oauth-* token pre-seeded into the sidecar), so — unlike the n8n
// path — there is no per-tenant credential injection; the proxy is a thin,
// bearer-gated pass-through. The system identity is the URL path AND the signed
// `system` claim on the long-lived 'workspace-runtime' bearer, so a token minted
// for one system is a hard 403 on any other path.

// Mint a system-scoped, long-lived Workspace MCP bearer (admin-gated). Each
// system's bootstrap-google-mcp.yml exchanges mcp-server-admin-secret (read from
// SM via WIF) for a token bound to exactly one system, then stores it in that
// system's n8n MCP Client Tool credential.
app.post('/workspace/:system/token', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const system = req.params.system;
  if (!isAllowedWorkspaceSystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const token = signBearer(WORKSPACE_RUNTIME_TTL_MS, 'workspace-runtime', { system });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: WORKSPACE_RUNTIME_TTL_SEC });
});

app.all('/workspace/:system/mcp', async (req: Request, res: Response) => {
  const system = req.params.system;
  if (!workspaceMcpEnabled()) {
    res.status(503).json({ error: 'workspace_mcp_disabled' });
    return;
  }
  if (!isAllowedWorkspaceSystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyBearer(token) : null;
  if (!token || payload === null) {
    res
      .status(401)
      .set(
        'WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      )
      .json({ error: 'unauthorized' });
    return;
  }
  // Hard tenant isolation: only a workspace-runtime bearer for THIS system
  // (or an operator-grade bearer) may reach the shared Workspace sidecar.
  if (!systemRouteAllows(payload, 'workspace-runtime', system)) {
    res.status(403).json({ error: 'system_mismatch' });
    return;
  }
  await proxyToWorkspaceMcp(req, res);
});

// ── Factory telemetry MCP — tenant-locked subset of the factory's own tools ────
//
// /factory/<system>/mcp serves an IN-PROCESS per-request McpServer (same
// stateless pattern as /mcp) that registers ONLY the hardened 8-tool subset
// from factory-scope.ts, with the system identity injected server-side from the
// signed bearer claim. A system's agent gets read-only telemetry over ITSELF —
// its n8n, its Railway services, its repo's CI runs, its one public host — and
// nothing else: no org-read tools, no dispatch_workflow, no GCP/Cloudflare.

// Mint a system-scoped, long-lived factory-runtime bearer (admin-gated).
// Stage 2 of mcp-birth-bundle: provision-system.yml exchanges
// mcp-server-admin-secret (read from control SM via WIF) for a token bound to
// exactly one system, then stores it in that system's SM (factory-mcp-bearer)
// for the n8n "Factory MCP" credential.
app.post('/factory/:system/token', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string | undefined) ?? '';
  if (!secretMatches(provided)) {
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  const system = req.params.system;
  if (!isAllowedFactorySystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const token = signBearer(FACTORY_RUNTIME_TTL_MS, 'factory-runtime', { system });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: FACTORY_RUNTIME_TTL_SEC });
});

app.all('/factory/:system/mcp', async (req: Request, res: Response) => {
  const system = req.params.system;
  if (!isAllowedFactorySystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyBearer(token) : null;
  if (!token || payload === null) {
    res
      .status(401)
      .set(
        'WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      )
      .json({ error: 'unauthorized' });
    return;
  }
  // Hard tenant isolation: only a factory-runtime bearer for THIS system (or
  // an operator-grade bearer) may reach the scoped telemetry subset.
  if (!systemRouteAllows(payload, 'factory-runtime', system)) {
    res.status(403).json({ error: 'system_mismatch' });
    return;
  }

  const server = new McpServer({ name: 'factory-telemetry-mcp', version: '1.0.0' });
  registerFactoryScopedTools(server, system);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => undefined);
  }
});

// POST /factory/<system>/emit — the reliability layer's n8n -> observability bridge.
// A system's n8n (the standard Error Workflow + the per-cron heartbeat nodes) POSTs a
// small event here with its factory-runtime bearer; the gateway injects system + layer
// from the SIGNED bearer claim (never the body) and fans out via emitEvent() (Axiom
// always; Telegram on warning+; Linear on error+/action_required) — every sink secret
// stays server-side. Same auth chain as /factory/<system>/mcp above; an isolated single
// handler that constructs no McpServer and exposes no tool surface.
app.post('/factory/:system/emit', async (req: Request, res: Response) => {
  const system = req.params.system;
  if (!isAllowedFactorySystem(system)) {
    res.status(404).json({ error: 'unknown_system' });
    return;
  }
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyBearer(token) : null;
  if (!token || payload === null) {
    res
      .status(401)
      .set('WWW-Authenticate', `Bearer realm="${BASE_URL}"`)
      .json({ error: 'unauthorized' });
    return;
  }
  // Hard tenant isolation: only THIS system's factory-runtime bearer (or an
  // operator-grade bearer) may emit for this system — identical lock to the
  // telemetry route, so a runtime token can never emit for a sibling.
  if (!systemRouteAllows(payload, 'factory-runtime', system)) {
    res.status(403).json({ error: 'system_mismatch' });
    return;
  }
  // Emit-specific kill-switch (independent of the read-tool allowlist).
  if (!isEmitAllowedSystem(system)) {
    res.status(503).json({ error: 'emit_disabled' });
    return;
  }
  const parsed = validateEmitBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: 'bad_request', message: parsed.error });
    return;
  }
  if (!emitRateLimiter.allow(system)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }
  const { name, severity, actionRequired, workflow, runId, body } = parsed.value;
  const result = await emitEvent({
    name,
    severity,
    layer: 'system', // forced server-side — a tenant can never emit a factory-layer event
    system, // from the path/claim, never the body
    workflow,
    runId,
    actionRequired,
    body,
  });
  res.status(200).json({
    ok: true,
    axiom: result.axiom.status,
    telegram: result.telegram.status,
    linear: result.linear.status,
  });
});

// Must be registered after all routes so it sees errors thrown by handlers.
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, () => {
  console.log(`factory-actions-mcp listening on port ${PORT} | base URL: ${BASE_URL}`);
});
