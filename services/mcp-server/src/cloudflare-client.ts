// Cloudflare REST client for verifier tools. The mounted token is the
// `cloudflare-token-creator` (env var CLOUDFLARE_API_TOKEN), which holds
// only "Create Additional Tokens" scope — it cannot read DNS records
// directly. Per ADR 089, the verifier mints a short-lived zone-scoped
// DNS:Read token via the creator, uses it for the actual record reads,
// then revokes it. Mirrors scripts/decommission-cloudflare.sh:92-149.
//
// Phase 3 (ADR 171) adds a SECOND long-lived token
// (`cloudflare-zones-read-token` in SM, env var CLOUDFLARE_ZONES_READ_TOKEN)
// with Zone:Read + DNS:Read at account level. Used by list_cloudflare_zones
// and list_dns_records, which need account-wide scope (no specific zone to
// scope the creator to). The creator token is left untouched to preserve the
// existing verify_cloudflare_system mint/revoke flow.

import { NotFoundError } from './manifest-helper.js';

const CF_BASE = 'https://api.cloudflare.com/client/v4';
const CF_CREATOR_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONES_READ_TOKEN = process.env.CLOUDFLARE_ZONES_READ_TOKEN;
// Placeholder value written by bootstrap-mcp-runtime-sa.sh when the secret
// is freshly created — the operator overwrites it with a real Cloudflare API
// token via `gcloud secrets versions add cloudflare-zones-read-token`.
const CF_ZONES_READ_TOKEN_PLACEHOLDER = '__NOT_CONFIGURED__';

// Permission group for scoped DNS access — same constant as ADR 089's
// write-side flow (decommission-cloudflare.sh, railway-cloudflare-bootstrap.yml).
// "Zone DNS Edit" includes read; the dedicated Zone:DNS:Read group
// (82e64a83756745bbbb1c9c2701bf816b) returned HTTP 400 from /user/tokens
// (run 26067991390), so we reuse the proven Edit constant. The verifier
// only reads — the broader scope is bounded by 1h expires_on + immediate
// revoke in the finally block.
const DNS_PERMISSION_GROUP_ID = '4755a26eedb94da69e1066d98aa820be';

const SCOPED_TOKEN_TTL_MS = 60 * 60 * 1000;

async function cfFetch(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (resp.status === 404) throw new NotFoundError(`Cloudflare ${path}: 404`);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Cloudflare ${path} → ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = (await resp.json()) as { success: boolean; result?: unknown; errors?: unknown[] };
  if (!data.success) {
    throw new Error(`Cloudflare error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

export interface ScopedToken {
  token: string;
  tokenId: string;
}

export async function createScopedReadToken(zoneId: string): Promise<ScopedToken> {
  if (!CF_CREATOR_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN not set');
  // Cloudflare /user/tokens rejects fractional seconds in expires_on; match
  // decommission-cloudflare.sh:90's `date +%Y-%m-%dT%H:%M:%SZ` format.
  const expiresOn = new Date(Date.now() + SCOPED_TOKEN_TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const body = {
    name: `factory-actions-mcp-verify-${Date.now()}`,
    policies: [{
      effect: 'allow',
      resources: { [`com.cloudflare.api.account.zone.${zoneId}`]: '*' },
      permission_groups: [{ id: DNS_PERMISSION_GROUP_ID }],
    }],
    expires_on: expiresOn,
  };
  const result = (await cfFetch('/user/tokens', CF_CREATOR_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { id: string; value: string };
  return { token: result.value, tokenId: result.id };
}

export async function revokeScopedToken(tokenId: string): Promise<void> {
  if (!CF_CREATOR_TOKEN) return;
  try {
    await cfFetch(`/user/tokens/${encodeURIComponent(tokenId)}`, CF_CREATOR_TOKEN, { method: 'DELETE' });
  } catch (e) {
    process.stderr.write(`warning: Cloudflare scoped token revoke failed (auto-expires in 1h): ${String(e).slice(0, 200)}\n`);
  }
}

// Cloudflare scoped tokens propagate to edge POPs with eventual consistency.
// Empirical: a freshly-minted token may return 401 from one POP while 200 from
// another for ~1-2 seconds post-mint. or-test-45's verify_cloudflare_system
// run (factory run 26101528445) caught this — first record returned 401, the
// second 200, same token, same zone. The [0.10.79]/[0.10.80]/[0.10.81] fixes
// addressed the mint payload but not this edge-propagation window. Retry on
// 401 with 1.5s delay covers the propagation lag; max 3 attempts caps total
// stall at ~3s if a POP simply rejects this token.
const SCOPED_TOKEN_RETRY_ATTEMPTS = 3;
const SCOPED_TOKEN_RETRY_DELAY_MS = 1500;

// === Phase 3 (ADR 171) read helpers using the long-lived zones-read token ===

export class CfZonesTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CfZonesTokenError';
  }
}

function getZonesReadToken(): string {
  if (!CF_ZONES_READ_TOKEN) {
    throw new CfZonesTokenError('CLOUDFLARE_ZONES_READ_TOKEN env var not set — Cloud Run service may not have been redeployed since Phase 3 secret was added');
  }
  if (CF_ZONES_READ_TOKEN === CF_ZONES_READ_TOKEN_PLACEHOLDER) {
    throw new CfZonesTokenError('cloudflare-zones-read-token contains placeholder value — operator must add a real Cloudflare API token via `gcloud secrets versions add cloudflare-zones-read-token --data-file=- --project=factory-control-9piybr` (Zone:Read + DNS:Read at account level)');
  }
  return CF_ZONES_READ_TOKEN;
}

export interface CfZone {
  id: string;
  name: string;
  status: string;
  type: string;
  paused: boolean;
  account: { id: string; name: string };
  createdOn: string | null;
  modifiedOn: string | null;
}

export async function listZones(): Promise<CfZone[]> {
  const token = getZonesReadToken();
  const all: CfZone[] = [];
  let page = 1;
  while (true) {
    const result = (await cfFetch(`/zones?per_page=50&page=${page}`, token)) as Array<{
      id: string;
      name: string;
      status?: string;
      type?: string;
      paused?: boolean;
      account?: { id?: string; name?: string };
      created_on?: string;
      modified_on?: string;
    }>;
    if (!Array.isArray(result) || result.length === 0) break;
    for (const z of result) {
      all.push({
        id: z.id,
        name: z.name,
        status: z.status ?? 'unknown',
        type: z.type ?? 'full',
        paused: z.paused ?? false,
        account: { id: z.account?.id ?? '', name: z.account?.name ?? '' },
        createdOn: z.created_on ?? null,
        modifiedOn: z.modified_on ?? null,
      });
    }
    if (result.length < 50) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  createdOn: string | null;
  modifiedOn: string | null;
  comment: string | null;
}

// Lists all DNS records in a zone. Accepts zone ID (hex string) or zone name
// (e.g. "or-infra.com"); name → ID resolution uses listZones() and matches
// case-insensitively. Read-only.
export async function listDnsRecords(zoneIdOrName: string): Promise<CfDnsRecord[]> {
  const token = getZonesReadToken();
  let zoneId = zoneIdOrName;
  const looksLikeId = /^[a-f0-9]{32}$/i.test(zoneIdOrName);
  if (!looksLikeId) {
    const zones = await listZones();
    const match = zones.find((z) => z.name.toLowerCase() === zoneIdOrName.toLowerCase());
    if (!match) throw new NotFoundError(`Cloudflare zone not found by name: ${zoneIdOrName}`);
    zoneId = match.id;
  }
  const result = (await cfFetch(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100`, token)) as Array<{
    id: string;
    type: string;
    name: string;
    content: string;
    proxied?: boolean;
    ttl?: number;
    created_on?: string;
    modified_on?: string;
    comment?: string;
  }>;
  return result.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied ?? false,
    ttl: r.ttl ?? 1,
    createdOn: r.created_on ?? null,
    modifiedOn: r.modified_on ?? null,
    comment: r.comment ?? null,
  }));
}

export async function getDnsRecord(
  zoneId: string,
  recordId: string,
  token: string,
): Promise<DnsRecord | null> {
  for (let attempt = 1; attempt <= SCOPED_TOKEN_RETRY_ATTEMPTS; attempt++) {
    try {
      return (await cfFetch(
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
        token,
      )) as DnsRecord;
    } catch (e) {
      if (e instanceof NotFoundError) return null;
      const isAuthError = e instanceof Error && / → 401:/.test(e.message);
      if (isAuthError && attempt < SCOPED_TOKEN_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, SCOPED_TOKEN_RETRY_DELAY_MS));
        continue;
      }
      throw e;
    }
  }
  return null; // unreachable; satisfies type checker
}
