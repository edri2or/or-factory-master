// Client for a per-system n8n Public API (/api/v1), used by the n8n
// observability tools (list_n8n_workflows, inspect_n8n_execution). This is the
// supported, structured way to read n8n state — workflow `active` flags and
// per-execution status/errors — instead of scraping container logs.
//
// Auth: header `X-N8N-API-KEY`, value read from the system's GCP Secret Manager
// (secret `n8n-api-key`, minted headlessly at deploy via POST /rest/api-keys).
// Base host: https://n8n-<system>.or-infra.com — guarded by the probe.ts SSRF
// allowlist (*.or-infra.com). We use bare fetch (not probe()) because workflow
// lists and execution data exceed probe's 4 KB body cap.

import { resolveSystem } from './manifest-helper.js';
import { getSecretValue } from './gcp-client.js';
import { isAllowedUrl } from './probe.js';

const TIMEOUT_MS = 20_000;

// Thrown when the system has no n8n-api-key in SM yet (deploy not run, or a
// reuse-mode round wiped it). Callers surface a clear remediation message.
export class N8nKeyMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'N8nKeyMissingError';
  }
}

// The live n8n target for a system: its public base URL + its API key. The key
// is read from the SYSTEM's own GCP Secret Manager (never the control project,
// never the session) and lives only in server memory. Used both by n8nApiGet
// (read tools) and by the n8n-mcp live-write proxy, which injects baseUrl/apiKey
// as the x-n8n-url / x-n8n-key headers server-side.
export interface N8nTarget {
  baseUrl: string;   // https://n8n-<system>.or-infra.com  (no trailing slash)
  apiKey: string;
}

export async function resolveN8nTarget(systemName: string): Promise<N8nTarget> {
  const m = await resolveSystem(systemName);
  const projectId = m.gcpProjectId;
  if (!projectId) {
    throw new Error(`cannot resolve GCP project for ${systemName} (repo var GCP_PROJECT_ID)`);
  }
  const baseUrl = `https://n8n-${systemName}.or-infra.com`;
  // Reuse the read-path SSRF allowlist (*.or-infra.com) on the /api/v1 base.
  if (!isAllowedUrl(`${baseUrl}/api/v1`)) {
    throw new Error(`url not in allowlist: ${baseUrl}`);
  }
  let apiKey: string;
  try {
    apiKey = (await getSecretValue(projectId, 'n8n-api-key')).trim();
  } catch {
    throw new N8nKeyMissingError(
      `n8n-api-key not found in ${projectId} Secret Manager — run deploy-railway-cloudflare.yml on ${systemName} (it mints the key)`,
    );
  }
  return { baseUrl, apiKey };
}

// GET a path under the system's n8n Public API. Returns parsed JSON.
export async function n8nApiGet(systemName: string, path: string): Promise<unknown> {
  const { baseUrl, apiKey } = await resolveN8nTarget(systemName);
  const url = `${baseUrl}/api/v1${path}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`n8n GET ${path} → ${resp.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}
