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

import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { resolveN8nTarget } from './n8n-client.js';

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

// Reverse-proxy one MCP request to the internal n8n-mcp sidecar, injecting the
// system's n8n URL + key. `system` is already validated (allowlist) by the
// caller. Streams the response (n8n-mcp may answer with SSE) straight back.
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

  let target;
  try {
    target = await resolveN8nTarget(system);
  } catch (e) {
    res.status(502).json({ error: 'n8n_target_unresolved', detail: String((e as Error).message).slice(0, 300) });
    return;
  }

  // Build a clean header set: never forward client-supplied x-n8n-* or auth.
  const headers: Record<string, string> = {
    authorization: `Bearer ${N8N_MCP_AUTH_TOKEN}`,
    'content-type': (req.headers['content-type'] as string) || 'application/json',
    accept: (req.headers['accept'] as string) || 'application/json, text/event-stream',
    'x-n8n-url': target.baseUrl,
    'x-n8n-key': target.apiKey,
  };
  const sid = req.headers['mcp-session-id'];
  if (typeof sid === 'string') headers['mcp-session-id'] = sid;
  const pv = req.headers['mcp-protocol-version'];
  if (typeof pv === 'string') headers['mcp-protocol-version'] = pv;

  // Forward the exact bytes the client sent (rawBody captured in index.ts), so
  // n8n-mcp sees an untouched JSON-RPC payload.
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  // MCP payloads are UTF-8 JSON, so a string body round-trips losslessly and
  // avoids the Buffer/Uint8Array-vs-BodyInit typing friction with global fetch.
  const bodyInit = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body ?? {});

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(N8N_MCP_URL!, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyInit,
      signal: ctrl.signal,
    });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const usid = upstream.headers.get('mcp-session-id');
    if (usid) res.setHeader('mcp-session-id', usid);
    if (upstream.body) {
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'n8n_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
    } else {
      res.end();
    }
  } finally {
    clearTimeout(timer);
  }
}
