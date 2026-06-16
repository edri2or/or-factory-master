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
// The ONE exception to pure pass-through is a gateway-owned synthetic tool,
// edit_drive_file_content (workspace-drive-edit.ts): tools/list is augmented with
// it, and a tools/call to it is handled here (the Drive files.update media path
// the bundled update_drive_file refuses). Every other request still streams
// straight through to the sidecar untouched.

import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import {
  parseDriveEditCall,
  isToolsListRequest,
  extractJsonRpcMessage,
  injectToolIntoToolsList,
  buildToolResult,
  executeDriveContentEdit,
} from './workspace-drive-edit.js';

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

// Forward one request to the sidecar and return the raw upstream Response (the
// caller decides whether to stream it or buffer + rewrite it). The client's
// mcp-session-id / mcp-protocol-version pass through untouched (the shared
// identity needs no header rewriting).
async function forwardToSidecar(req: Request): Promise<globalThis.Response> {
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
  try {
    return await fetch(WORKSPACE_MCP_URL!, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyInit,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Augment a tools/list response with the synthetic edit_drive_file_content tool.
// Buffers the sidecar's response (small), extracts the JSON-RPC message whether
// framed as JSON or SSE, injects the tool, and returns it as application/json
// (the client accepts both). On any parse surprise, falls back to a clean
// passthrough of the original bytes so tools/list is never broken.
async function proxyToolsListWithInjection(req: Request, res: Response): Promise<void> {
  let upstream: globalThis.Response;
  try {
    upstream = await forwardToSidecar(req);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'workspace_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
    } else {
      res.end();
    }
    return;
  }

  const ct = upstream.headers.get('content-type') ?? '';
  const text = await upstream.text().catch(() => '');
  const usid = upstream.headers.get('mcp-session-id');

  const msg = upstream.ok ? extractJsonRpcMessage(ct, text) : null;
  if (!msg) {
    // Could not parse (or upstream error) — pass the original response through.
    res.status(upstream.status);
    if (ct) res.setHeader('content-type', ct);
    if (usid) res.setHeader('mcp-session-id', usid);
    res.end(text);
    return;
  }

  injectToolIntoToolsList(msg);
  res.status(200).setHeader('content-type', 'application/json');
  if (usid) res.setHeader('mcp-session-id', usid);
  res.end(JSON.stringify(msg));
}

// Reverse-proxy one MCP request to the internal Workspace MCP sidecar. `system`
// is already validated + bearer-checked by the caller (index.ts).
export async function proxyToWorkspaceMcp(req: Request, res: Response): Promise<void> {
  if (!workspaceMcpEnabled()) {
    res.status(503).json({ error: 'workspace_mcp_disabled' });
    return;
  }

  // (1) A tools/call to our gateway-owned synthetic tool — handled here, the
  // sidecar never sees it. Errors come back as an MCP tool result (isError),
  // not a transport failure, so the model reads a clear message.
  const call = parseDriveEditCall(req.body);
  if (call) {
    let payload: unknown;
    let isError = false;
    try {
      payload = await executeDriveContentEdit(call.args);
    } catch (e) {
      payload = { ok: false, error: String((e as Error).message) };
      isError = true;
    }
    const sid = req.headers['mcp-session-id'];
    if (typeof sid === 'string') res.setHeader('mcp-session-id', sid);
    res.status(200).setHeader('content-type', 'application/json');
    res.end(JSON.stringify(buildToolResult(call.id, payload, isError)));
    return;
  }

  // (2) tools/list — forward, then inject the synthetic tool into the result.
  if (isToolsListRequest(req.body)) {
    await proxyToolsListWithInjection(req, res);
    return;
  }

  // (3) Everything else — straight pass-through (the v1 behavior).
  let upstream: globalThis.Response;
  try {
    upstream = await forwardToSidecar(req);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'workspace_mcp_upstream_error', detail: String((e as Error).message).slice(0, 300) });
    } else {
      res.end();
    }
    return;
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
