import jwt from 'jsonwebtoken';

const DEFAULT_OWNER = 'edri2or';
// The factory's own repo. Was previously hardcoded to the OLD factory
// ('factory'), which meant every run/job/log tool silently read the wrong
// repo (404s on this repo's workflows and on system repos). Tools now accept
// owner/repo and default here.
const DEFAULT_REPO = 'or-factory-master';

const APP_ID = process.env.GITHUB_APP_ID;
const APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID;
const RAW_KEY = process.env.GITHUB_APP_PRIVATE_KEY;

if (!APP_ID || !APP_INSTALLATION_ID || !RAW_KEY) {
  throw new Error('GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY are required');
}

// Railway stores multi-line secrets with literal \n — restore newlines
const PRIVATE_KEY = RAW_KEY.replace(/\\n/g, '\n');

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 540, iss: APP_ID }, PRIVATE_KEY, { algorithm: 'RS256' });
}

async function installationToken(): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  if (cached && cached.expiresAt - Date.now() > bufferMs) return cached.token;

  const resp = await fetch(
    `https://api.github.com/app/installations/${APP_INSTALLATION_ID}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${makeJwt()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!resp.ok) throw new Error(`Installation token fetch failed: ${resp.status}`);
  const data = (await resp.json()) as { token: string; expires_at: string };
  cached = { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return cached.token;
}

async function ghFetchRepo(
  owner: string,
  repo: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await installationToken();
  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function ghFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return ghFetchRepo(DEFAULT_OWNER, DEFAULT_REPO, path, init);
}

export async function apiGet(
  path: string,
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<unknown> {
  const resp = await ghFetchRepo(owner, repo, path);
  if (!resp.ok) throw new Error(`GitHub GET ${owner}/${repo}${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export async function getRepoFile(path: string, ref: string = 'main'): Promise<string> {
  const resp = await ghFetch(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
  if (!resp.ok) throw new Error(`GitHub getRepoFile ${path}@${ref} → ${resp.status}`);
  const data = (await resp.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding ${data.encoding}`);
  return Buffer.from(data.content, 'base64').toString('utf8');
}

// Cross-repo GET. Used by verify_github_system to inspect generated repos
// (edri2or/<systemName>). Requires the App installation to cover those repos.
export async function apiGetRepo(owner: string, repo: string, path: string): Promise<unknown> {
  const token = await installationToken();
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!resp.ok) {
    throw new Error(`GitHub GET ${owner}/${repo}${path} → ${resp.status}`);
  }
  return resp.json();
}

// Trigger a workflow_dispatch event. The broker App is installed org-wide with
// actions:write, so this works on or-factory-master and any system repo. The
// dispatch endpoint returns 204 with no body — callers use getLatestWorkflowRun
// to discover the created run. The only write path through this client; the
// dispatch_workflow tool gates it behind a workflow-file allowlist.
export async function dispatchWorkflow(
  workflowFile: string,
  ref: string,
  inputs: Record<string, unknown>,
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<void> {
  const resp = await ghFetchRepo(
    owner,
    repo,
    `/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
    { method: 'POST', body: JSON.stringify({ ref, inputs }) },
  );
  if (resp.status !== 204) {
    throw new Error(`dispatch ${owner}/${repo} ${workflowFile} → ${resp.status}: ${await resp.text()}`);
  }
}

// Most recent workflow_dispatch run for a workflow file on a branch. Used right
// after dispatchWorkflow to return an actionable run id/url. Returns null if no
// run is visible yet (GitHub takes a beat to materialize the run after dispatch).
export async function getLatestWorkflowRun(
  workflowFile: string,
  ref: string,
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<{ id: number; html_url: string; status: string; created_at: string } | null> {
  const params = new URLSearchParams({ branch: ref, event: 'workflow_dispatch', per_page: '1' });
  const data = (await apiGet(
    `/actions/workflows/${encodeURIComponent(workflowFile)}/runs?${params}`,
    owner,
    repo,
  )) as { workflow_runs?: Array<Record<string, unknown>> };
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    id: run['id'] as number,
    html_url: run['html_url'] as string,
    status: run['status'] as string,
    created_at: run['created_at'] as string,
  };
}

// 5 MB default ceiling. The MCP transport handles multi-MB payloads and the
// Claude Code harness spills large tool outputs to a local file the agent reads
// in chunks, so this only exists to bound a pathological 100 MB log — not to
// hide content. Override with maxBytes, or use grep/tailLines for a small read.
export const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;

export interface LogReadOptions {
  owner?: string;
  repo?: string;
  // Surgical mode: JS regex (case-insensitive). Returns only matching lines
  // plus `context` lines around each, with a match-count header.
  grep?: string;
  context?: number;
  // Pagination: byte window into the full log.
  offsetBytes?: number;
  maxBytes?: number;
  // Return only the last N lines (ignored when grep is set).
  tailLines?: number;
}

// Applies grep / tail / offset+maxBytes to a raw log string. Exported so the
// Railway and Cloud Run log tools share one filtering contract.
export function filterLogText(text: string, opts: LogReadOptions = {}): string {
  if (opts.grep) {
    let re: RegExp;
    try {
      re = new RegExp(opts.grep, 'i');
    } catch {
      return `[invalid grep regex: ${opts.grep}]`;
    }
    const ctx = opts.context ?? 3;
    const lines = text.split('\n');
    const keep = new Array<boolean>(lines.length).fill(false);
    let matches = 0;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        matches++;
        for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) keep[j] = true;
      }
    }
    if (matches === 0) {
      return `[no lines matched /${opts.grep}/i in ${lines.length} lines (${Buffer.byteLength(text, 'utf8')} bytes)]`;
    }
    const out: string[] = [
      `[grep /${opts.grep}/i — ${matches} match(es), ±${ctx} context lines, of ${lines.length} total lines]`,
    ];
    let lastKept = -2;
    for (let i = 0; i < lines.length; i++) {
      if (!keep[i]) continue;
      if (i > lastKept + 1) out.push('--');
      out.push(`${i + 1}: ${lines[i]}`);
      lastKept = i;
    }
    return out.join('\n');
  }

  if (opts.tailLines && opts.tailLines > 0) {
    const lines = text.split('\n');
    return lines.slice(Math.max(0, lines.length - opts.tailLines)).join('\n');
  }

  const offset = opts.offsetBytes ?? 0;
  const max = opts.maxBytes ?? DEFAULT_MAX_LOG_BYTES;
  const buf = Buffer.from(text, 'utf8');
  if (offset >= buf.length) return `[offset_bytes=${offset} is at/beyond end of log (${buf.length} bytes)]`;
  const slice = buf.subarray(offset, offset + max).toString('utf8');
  if (offset + max < buf.length) {
    const remaining = buf.length - offset - max;
    return `${slice}\n[... ${remaining} more bytes; resume with offset_bytes=${offset + max} (total ${buf.length} bytes) ...]`;
  }
  return slice;
}

export async function fetchJobLogs(jobId: string, opts: LogReadOptions = {}): Promise<string> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const resp = await ghFetchRepo(owner, repo, `/actions/jobs/${jobId}/logs`, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`Job logs fetch failed for ${owner}/${repo} job ${jobId}: ${resp.status}`);
  return filterLogText(await resp.text(), opts);
}
