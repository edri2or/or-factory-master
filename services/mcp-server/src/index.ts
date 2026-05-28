import './instrument.js'; // Sentry.init — must run before anything else
import * as Sentry from '@sentry/node';
import express, { type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { verifyGitHubOidc } from './oidc-verifier.js';
import { signBearer, verifyBearer, revokeBearer } from './bearer.js';
import { sendTelegramMessage } from './observability-client.js';
import { handleLinearWebhook, registerLinearWebhook } from './oil-autofix.js';

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

// PUBLIC_BASE_URL: Cloud Run (injected by deploy workflow from status.url).
// RAILWAY_PUBLIC_DOMAIN: Railway parallel deploy (ADR 139 blue-green; retired
// post-flip). localhost: local dev only — not reachable by claude.ai.
const BASE_URL = process.env.PUBLIC_BASE_URL
  ?? (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`);

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days; Claude re-authorizes after
const TOKEN_TTL_SEC = Math.floor(TOKEN_TTL_MS / 1000);
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const OIDC_BEARER_TTL_MS = 60 * 60 * 1000;  // 1 hour — NIST SP 800-63C for ephemeral CI bearers

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

// Authorization page (GET)
app.get('/oauth/authorize', (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
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
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => undefined);
  }
});

// Must be registered after all routes so it sees errors thrown by handlers.
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, () => {
  console.log(`factory-actions-mcp listening on port ${PORT} | base URL: ${BASE_URL}`);
});
