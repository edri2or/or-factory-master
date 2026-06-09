// Google Workspace MCP proxy.
//
// Reverse-proxies the MCP protocol to the internal Google Workspace MCP sidecar
// (taylorwilsdon/google_workspace_mcp, single-user streamable-http), reachable
// only at localhost inside the Cloud Run instance — never exposed publicly.
//
// Unlike n8n-mcp-proxy.ts there is NO per-tenant credential injection: ALL
// systems share ONE Google identity (the shared gmail-oauth-* token pre-seeded
// into the sidecar by its boot shim), so the proxy is a thin, authenticated
// pass-through. The public auth boundary (a system-scoped 'workspace-runtime'
// bearer) is enforced by the /workspace/:system/mcp route in index.ts BEFORE
// this runs; this module never sees an unauthenticated request.
//
// v1 is a straight pass-through (no transparent session-recovery like the n8n
// proxy). n8n's MCP Client Tool node re-initializes on session loss per the MCP
// spec; if live testing (Stage 2) shows it doesn't, port the recovery engine
// from n8n-mcp-proxy.ts. Kept minimal on purpose — build the brick, prove it,
// then iterate.

import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

// Internal sidecar MCP endpoint, e.g. http://localhost:3002/mcp/. Absent → the
// Workspace MCP feature is dormant (routes 503) until deployed with the sidecar.
const WORKSPACE_MCP_URL = process.env.WORKSPACE_MCP_URL;

// Which systems may reach the shared Workspace MCP. "*" = any syntactically-valid
// system name (the shared identity means there is no per-system reachability gate
// like n8n's resolveN8nTarget); a CSV pins to specific systems. A system-scoped
// 'workspace-runtime' bearer stays hard-bound to its own system regardless.
const ALLOWED_SYSTEMS = new Set(
  (process.env.WORKSPACE_ALLOWED_SYSTEMS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const ALLOW_ANY_SYSTEM = ALLOWED_SYSTEMS.has('*');
// Same shape the factory enforces on system_name (6–30 chars).
const SYSTEM_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const PROXY_TIMEOUT_MS = 60_000;

export function workspaceMcpEnabled(): boolean {
  return Boolean(WORKSPACE_MCP_URL);
}

export function isAllowedWorkspaceSystem(system: string): boolean {
  if (ALLOW_ANY_SYSTEM) return SYSTEM_NAME_RE.test(system);
  return ALLOWED_SYSTEMS.has(system);
}

// Reverse-proxy one MCP request to the internal Workspace MCP sidecar. `system`
// is already validated + bearer-checked by the caller (index.ts). The client's
// mcp-session-id / mcp-protocol-version pass through untouched (the shared
// identity needs no header rewriting).
export async function proxyToWorkspaceMcp(req: Request, res: Response): Promise<void> {
  if (!workspaceMcpEnabled()) {
    res.status(503).json({ error: 'workspace_mcp_disabled' });
    return;
  }

  // Forward the exact bytes the client sent (rawBody captured in index.ts) so the
  // sidecar sees an untouched JSON-RPC payload.
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  const bodyInit = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body ?? {});

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const sid = req.headers['mcp-session-id'];
  if (typeof sid === 'string') headers['mcp-session-id'] = sid;
  const pv = req.headers['mcp-protocol-version'];
  if (typeof pv === 'string') headers['mcp-protocol-version'] = pv;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(WORKSPACE_MCP_URL!, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyInit,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'workspace_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
    } else {
      res.end();
    }
    return;
  } finally {
    clearTimeout(timer);
  }

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
}
