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

// GET a path under the system's n8n Public API. Returns parsed JSON.
export async function n8nApiGet(systemName: string, path: string): Promise<unknown> {
  const m = await resolveSystem(systemName);
  const projectId = m.gcpProjectId;
  if (!projectId) {
    throw new Error(`cannot resolve GCP project for ${systemName} (repo var GCP_PROJECT_ID)`);
  }
  const url = `https://n8n-${systemName}.or-infra.com/api/v1${path}`;
  if (!isAllowedUrl(url)) {
    throw new Error(`url not in allowlist: ${url}`);
  }

  let apiKey: string;
  try {
    apiKey = (await getSecretValue(projectId, 'n8n-api-key')).trim();
  } catch {
    throw new N8nKeyMissingError(
      `n8n-api-key not found in ${projectId} Secret Manager — run deploy-railway-cloudflare.yml on ${systemName} (it mints the key)`,
    );
  }

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
