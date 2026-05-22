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
const MAX_BODY = 4096;

export interface ProbeResult {
  url: string;
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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const resp = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    const raw = await resp.text();
    const body = raw.slice(0, MAX_BODY);
    return {
      url,
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
