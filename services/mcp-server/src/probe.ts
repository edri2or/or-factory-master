// HTTP probe helper for verifier tools (probe_endpoint, verify_mcp_server).
// Cloud Run has no network-layer egress allowlist; this is the application-
// layer defense against SSRF-via-LLM-input. Allowlist matches the only
// hostnames factory-created systems use:
//
//   *.or-infra.com         — Cloudflare-managed system DNS
//   *.up.railway.app       — Railway-assigned per-service hostnames
//   *.run.app              — Cloud Run (factory MCP self-probe + per-system)
//
// Add new suffixes only if a new provider lands in the scaffold.

const ALLOWED_HOST_SUFFIXES = ['.or-infra.com', '.up.railway.app', '.run.app'];
const ALLOWED_SCHEMES = new Set(['https:']);
const TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_BODY = 4096;

export interface ProbeResult {
  url: string;
  method: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  body: string;
  bodyTruncated: boolean;
  durationMs: number;
  checks: {
    statusMatched: boolean;
    bodyMatched: boolean;
  };
}

// POST/body/timeout opts. The host allowlist still applies to every request —
// these only let a verifier POST to a factory-owned webhook (e.g. the Agent
// Router) and wait longer for an LLM-backed response.
export interface ProbeOptions {
  method?: string;
  body?: string;
  contentType?: string;
  timeoutMs?: number;
}

export class AllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllowlistError';
  }
}

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) return false;
    return ALLOWED_HOST_SUFFIXES.some((s) => parsed.hostname.endsWith(s));
  } catch {
    return false;
  }
}

// Allowlist gate for bare hostnames (no URL parsing). Used by tools that
// take a hostname directly (dns_resolve, tls_cert_inspect) where there's
// no URL scheme to check. Same SSRF defense-in-depth as isAllowedUrl.
export function isAllowedHost(host: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

export const ALLOWLIST_SUFFIXES_PUBLIC = ALLOWED_HOST_SUFFIXES;

export async function probe(
  url: string,
  expectStatus?: number,
  expectBodyContains?: string,
  opts: ProbeOptions = {},
): Promise<ProbeResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AllowlistError(`invalid URL: ${url}`);
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new AllowlistError(`scheme not allowed: ${parsed.protocol}`);
  }
  if (!ALLOWED_HOST_SUFFIXES.some((s) => parsed.hostname.endsWith(s))) {
    throw new AllowlistError(
      `host not in allowlist: ${parsed.hostname} (allowed suffixes: ${ALLOWED_HOST_SUFFIXES.join(', ')})`,
    );
  }

  const method = (opts.method ?? 'GET').toUpperCase();
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? TIMEOUT_MS, 1), MAX_TIMEOUT_MS);
  const init: RequestInit = { signal: undefined, redirect: 'follow', method };
  if (opts.body != null && method !== 'GET' && method !== 'HEAD') {
    init.body = opts.body;
    init.headers = { 'content-type': opts.contentType ?? 'application/json' };
  }

  const ctrl = new AbortController();
  init.signal = ctrl.signal;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const resp = await fetch(url, init);
    const raw = await resp.text();
    const body = raw.slice(0, MAX_BODY);
    return {
      url,
      method,
      status: resp.status,
      ok: resp.ok,
      contentType: resp.headers.get('content-type'),
      body,
      bodyTruncated: raw.length > MAX_BODY,
      durationMs: Date.now() - start,
      checks: {
        statusMatched: expectStatus == null || resp.status === expectStatus,
        bodyMatched: expectBodyContains == null || body.includes(expectBodyContains),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
