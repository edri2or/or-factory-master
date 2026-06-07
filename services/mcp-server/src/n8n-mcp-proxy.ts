// Live-write n8n development proxy.
//
// The factory's existing MCP gateway already knows how to read a system's
// n8n-api-key cross-project (n8n-client.ts, never into the session). This module
// turns that into a *write* path by reverse-proxying the MCP protocol to an
// internal n8n-mcp instance (czlonkowski/n8n-mcp, MCP_MODE=http,
// ENABLE_MULTI_TENANT=true) running as a Cloud Run SIDECAR — reachable only at
// localhost inside the instance, never exposed publicly.
//
// Security invariants (the whole reason this proxy exists):
//   1. The per-tenant n8n URL + key are INJECTED here, server-side, derived from
//      the system identity — NEVER read from the client. Any inbound x-n8n-*
//      header is ignored (the caller cannot point the proxy at another n8n).
//   2. n8n-mcp must be >= 2.51.2 (GHSA-jxx9-px88-pj69): older builds fell back to
//      env creds when the tenant headers were missing. We always send both.
//   3. Live writes are SCRATCH-ONLY: create/update calls that name a non-`dev-`
//      workflow are refused, so production workflows can never be clobbered from
//      a live session. git stays the source of truth (the commit-side gate
//      scripts/check-no-dev-workflows-committed.sh is the second half).
//
// Session resilience (why the proxy is more than a dumb pass-through):
//   The n8n-mcp sidecar is a STATEFUL streamable-HTTP MCP server — it keeps each
//   session in instance RAM and REAPS idle sessions after a few minutes. When a
//   client returns after a pause, its (now-reaped) session id yields
//   "Session not found or expired" (HTTP 400, JSON-RPC -32001). Per the MCP spec
//   the client should re-initialize on that, but real clients (incl. Claude:
//   anthropic/claude-code#60949, #27142) do NOT reliably do so — the connector
//   just shows as disconnected. So this proxy makes the session STABLE from the
//   client's point of view: it remembers each client's `initialize` payload, and
//   on an upstream session-expiry it transparently re-initializes a fresh
//   upstream session and replays the original request — the client keeps its
//   same session id and never sees the error. The happy path (200/SSE) is
//   untouched; only 400/404 JSON error responses are buffered + inspected.

import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { resolveN8nTarget, type N8nTarget } from './n8n-client.js';

// Internal sidecar MCP endpoint, e.g. http://localhost:3001/mcp, and its bearer.
// Absent → the live-write feature is dormant (routes 503) until deployed with
// the sidecar wired in. AUTH_TOKEN must be >= 32 chars (n8n-mcp requirement).
const N8N_MCP_URL = process.env.N8N_MCP_URL;
const N8N_MCP_AUTH_TOKEN = process.env.N8N_MCP_AUTH_TOKEN;

// Which systems may be driven. Either an explicit CSV (pinning), or "*" =
// any syntactically-valid system name (multi-tenant). Even with "*", actual
// reachability is gated by resolveN8nTarget (the system must resolve to a GCP
// project that holds an n8n-api-key), so an unknown/unprovisioned system fails
// cleanly; and a system-scoped n8n-dev bearer stays hard-bound to its own system.
const ALLOWED_SYSTEMS = new Set(
  (process.env.N8N_DEV_ALLOWED_SYSTEMS ?? 'or-adhd-agent')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const ALLOW_ANY_SYSTEM = ALLOWED_SYSTEMS.has('*');
// Same shape the factory enforces on system_name (6–30 chars).
const SYSTEM_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const PROXY_TIMEOUT_MS = 60_000;

export function n8nMcpEnabled(): boolean {
  return Boolean(N8N_MCP_URL && N8N_MCP_AUTH_TOKEN);
}

export function isAllowedN8nSystem(system: string): boolean {
  if (ALLOW_ANY_SYSTEM) return SYSTEM_NAME_RE.test(system);
  return ALLOWED_SYSTEMS.has(system);
}

// Scratch-only guard. Inspects the parsed JSON-RPC body (single object or batch)
// for tools/call to a create/update workflow tool that names a non-`dev-`
// workflow. Best-effort: a partial update that omits `name` keeps the existing
// name and is not name-checked here — the commit-side gate is the backstop.
const WRITE_TOOL_RE = /^n8n_(create|update)_/;

export function devNameViolation(body: unknown): string | null {
  const msgs = Array.isArray(body) ? body : [body];
  for (const m of msgs) {
    if (!m || typeof m !== 'object') continue;
    const rec = m as Record<string, unknown>;
    if (rec.method !== 'tools/call') continue;
    const params = rec.params as Record<string, unknown> | undefined;
    const toolName = typeof params?.name === 'string' ? params.name : '';
    if (!WRITE_TOOL_RE.test(toolName)) continue;
    const args = params?.arguments as Record<string, unknown> | undefined;
    const wfName = typeof args?.name === 'string' ? args.name : undefined;
    if (wfName !== undefined && !wfName.startsWith('dev-')) {
      return `live writes are scratch-only: workflow name "${wfName}" must start with "dev-" (re-templatize + commit to promote to production)`;
    }
  }
  return null;
}

// ── Session resilience helpers (pure — unit-tested) ──────────────────────────

// True when the JSON-RPC body (single or batch) carries an `initialize` request.
// An initialize is the only message that MINTS a session, so it must never carry
// a session id upstream and its payload is what we remember for transparent
// re-initialization.
export function isInitialize(body: unknown): boolean {
  const msgs = Array.isArray(body) ? body : [body];
  return msgs.some(
    (m) => m !== null && typeof m === 'object' && (m as Record<string, unknown>).method === 'initialize',
  );
}

// True when an upstream error response means "your session is gone — re-init".
// Scoped tightly: only 400/404, never an SSE stream (success path), and the body
// must actually mention an expired/unknown session (or the JSON-RPC session
// error codes) — so a genuine bad-request 400 is passed through untouched.
export function looksLikeSessionExpired(status: number, contentType: string, bodyText: string): boolean {
  if (status !== 400 && status !== 404) return false;
  if (contentType.includes('text/event-stream')) return false;
  const t = bodyText.toLowerCase();
  const mentionsSession = t.includes('session');
  const mentionsGone = t.includes('not found') || t.includes('expired') || t.includes('no valid');
  const sessionErrCode = /-3200[01]\b/.test(bodyText);
  return (mentionsSession && mentionsGone) || (mentionsSession && sessionErrCode);
}

// Per-client session memory, keyed by the session id the client holds (which is
// the FIRST upstream session id we minted for it). `upstreamSid` is the CURRENT
// live upstream session — it changes underneath the client on each transparent
// recovery, but the client keeps using its stable key. Lives for the instance
// lifetime; safe because the service is pinned to one warm instance
// (minScale=maxScale=1). Bounded to avoid unbounded growth.
interface SessionRecord {
  initBody: string; // exact bytes of the client's initialize request, for replay
  upstreamSid: string; // current live upstream session id
}
const sessions = new Map<string, SessionRecord>();
const recovering = new Map<string, Promise<string | null>>();
const SESSION_CAP = 2000;

function rememberSession(clientSid: string, initBody: string, upstreamSid: string): void {
  sessions.set(clientSid, { initBody, upstreamSid });
  // Map preserves insertion order → evict oldest first when over the cap.
  while (sessions.size > SESSION_CAP) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
}

// One upstream call to the sidecar, with the tenant creds injected server-side.
// `sid` (when set) is forwarded as mcp-session-id; `protocolVersion` is passed
// through when the client supplied it. Mirrors the original header set exactly.
async function fetchUpstream(
  method: string,
  sid: string | undefined,
  body: string | undefined,
  target: N8nTarget,
  protocolVersion?: string,
): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${N8N_MCP_AUTH_TOKEN}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'x-n8n-url': target.baseUrl,
    'x-n8n-key': target.apiKey,
  };
  if (sid) headers['mcp-session-id'] = sid;
  if (protocolVersion) headers['mcp-protocol-version'] = protocolVersion;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
  try {
    return await fetch(N8N_MCP_URL!, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Transparently mint a fresh upstream session for a client whose session was
// reaped: replay the remembered `initialize`, then the `initialized`
// notification (n8n-mcp gates tool calls on the completed handshake), and record
// the new upstream session id. Returns the new sid, or null if we can't recover
// (e.g. we never saw this client's initialize — the gateway restarted and lost
// the map; then the original error is passed through and the client must re-init).
async function reinitUpstream(clientSid: string, target: N8nTarget, protocolVersion?: string): Promise<string | null> {
  const rec = sessions.get(clientSid);
  if (!rec) return null;
  const initResp = await fetchUpstream('POST', undefined, rec.initBody, target, protocolVersion);
  const newSid = initResp.headers.get('mcp-session-id');
  try {
    await initResp.text(); // drain so the connection is freed
  } catch {
    /* ignore */
  }
  if (!newSid) return null;
  // Complete the MCP handshake on the new session (best-effort).
  try {
    const note = await fetchUpstream(
      'POST',
      newSid,
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      target,
      protocolVersion,
    );
    await note.text().catch(() => '');
  } catch {
    /* ignore — a failed notification still usually leaves a usable session */
  }
  rec.upstreamSid = newSid;
  sessions.set(clientSid, rec);
  return newSid;
}

// Stream an upstream Response back to the client. `clientSid` (when set) is
// re-asserted as the client-facing mcp-session-id so the client keeps a STABLE
// id even when the upstream session was swapped underneath it.
function streamResponse(upstream: globalThis.Response, res: Response, clientSid?: string): void {
  res.status(upstream.status);
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('content-type', ct);
  const usid = upstream.headers.get('mcp-session-id');
  if (clientSid) res.setHeader('mcp-session-id', clientSid);
  else if (usid) res.setHeader('mcp-session-id', usid);
  if (upstream.body) {
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } else {
    res.end();
  }
}

// Reverse-proxy one MCP request to the internal n8n-mcp sidecar, injecting the
// system's n8n URL + key. `system` is already validated (allowlist) by the
// caller. Streams the response straight back, and transparently recovers from an
// upstream session-expiry so the client never sees the drop.
export async function proxyToN8nMcp(req: Request, res: Response, system: string): Promise<void> {
  if (!n8nMcpEnabled()) {
    res.status(503).json({ error: 'n8n_live_write_disabled' });
    return;
  }

  const violation = devNameViolation(req.body);
  if (violation) {
    res.status(403).json({ error: 'scratch_only', detail: violation });
    return;
  }

  let target: N8nTarget;
  try {
    target = await resolveN8nTarget(system);
  } catch (e) {
    res.status(502).json({ error: 'n8n_target_unresolved', detail: String((e as Error).message).slice(0, 300) });
    return;
  }

  // Forward the exact bytes the client sent (rawBody captured in index.ts), so
  // n8n-mcp sees an untouched JSON-RPC payload. MCP payloads are UTF-8 JSON, so a
  // string body round-trips losslessly.
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  const bodyInit = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
  const clientSid = typeof req.headers['mcp-session-id'] === 'string' ? (req.headers['mcp-session-id'] as string) : undefined;
  const protocolVersion = typeof req.headers['mcp-protocol-version'] === 'string' ? (req.headers['mcp-protocol-version'] as string) : undefined;
  const initialize = isInitialize(req.body);

  // Client close → drop our memory of that session (hygiene).
  if (req.method === 'DELETE' && clientSid) sessions.delete(clientSid);

  // Translate the client's stable session id → the CURRENT upstream session id.
  // If a recovery is mid-flight for this client, wait for it so we use the fresh
  // upstream sid (and never double-init under a race).
  let upstreamSid = clientSid;
  if (!initialize && clientSid && sessions.has(clientSid)) {
    const inflight = recovering.get(clientSid);
    if (inflight) {
      try {
        await inflight;
      } catch {
        /* ignore */
      }
    }
    upstreamSid = sessions.get(clientSid)?.upstreamSid ?? clientSid;
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetchUpstream(req.method, initialize ? undefined : upstreamSid, bodyInit, target, protocolVersion);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'n8n_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
    } else {
      res.end();
    }
    return;
  }

  // Transparent recovery path: a non-initialize request whose session was reaped.
  if (!initialize && clientSid && (upstream.status === 400 || upstream.status === 404)) {
    const ct = upstream.headers.get('content-type') ?? '';
    if (!ct.includes('text/event-stream')) {
      let text = '';
      try {
        text = await upstream.text();
      } catch {
        /* ignore */
      }
      if (looksLikeSessionExpired(upstream.status, ct, text) && sessions.has(clientSid)) {
        // Serialize recovery per client so concurrent calls re-init only once.
        let p = recovering.get(clientSid);
        if (!p) {
          p = reinitUpstream(clientSid, target, protocolVersion).finally(() => recovering.delete(clientSid));
          recovering.set(clientSid, p);
        }
        let newSid: string | null = null;
        try {
          newSid = await p;
        } catch {
          newSid = null;
        }
        if (newSid) {
          let retry: globalThis.Response;
          try {
            retry = await fetchUpstream(req.method, newSid, bodyInit, target, protocolVersion);
          } catch (e) {
            if (!res.headersSent) {
              res.status(502).json({ error: 'n8n_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
            } else {
              res.end();
            }
            return;
          }
          streamResponse(retry, res, clientSid);
          return;
        }
        // Couldn't recover — surface the original session error unchanged.
        res.status(upstream.status);
        if (ct) res.setHeader('content-type', ct);
        res.end(text);
        return;
      }
      // A genuine (non-session) 400/404 — pass the buffered body through as-is.
      res.status(upstream.status);
      if (ct) res.setHeader('content-type', ct);
      res.end(text);
      return;
    }
  }

  // Normal path (incl. initialize): remember a newly-minted session, then stream.
  if (initialize) {
    const newSid = upstream.headers.get('mcp-session-id');
    if (newSid) rememberSession(newSid, bodyInit, newSid);
    streamResponse(upstream, res); // initialize establishes the client's id = newSid
    return;
  }
  streamResponse(upstream, res, clientSid);
}
