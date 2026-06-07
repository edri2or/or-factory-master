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

// One App identity (id + installation + key) plus its own token cache. The
// broker is the default identity used by every existing tool; a second identity
// (the OIL auto-fix approver, which MERGES PRs) is constructed lazily from its
// own OIL_APPROVER_* env vars so a missing approver config never breaks the
// broker path.
interface AppIdentity {
  appId: string;
  installationId: string;
  privateKey: string;
  cached: CachedToken | null;
}

const brokerIdentity: AppIdentity = {
  appId: APP_ID,
  installationId: APP_INSTALLATION_ID,
  privateKey: PRIVATE_KEY,
  cached: null,
};

function makeJwtForApp(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 540, iss: appId }, privateKey, { algorithm: 'RS256' });
}

// Mint (and cache) an installation access token for the given App identity.
// Generic over the identity so broker + approver share one code path; each keeps
// its own cache on its AppIdentity record.
async function tokenFor(identity: AppIdentity): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  if (identity.cached && identity.cached.expiresAt - Date.now() > bufferMs) return identity.cached.token;

  const resp = await fetch(
    `https://api.github.com/app/installations/${identity.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${makeJwtForApp(identity.appId, identity.privateKey)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!resp.ok) throw new Error(`Installation token fetch failed: ${resp.status}`);
  const data = (await resp.json()) as { token: string; expires_at: string };
  identity.cached = { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return identity.cached.token;
}

async function installationToken(): Promise<string> {
  return tokenFor(brokerIdentity);
}

// Mint an installation token DOWN-SCOPED to a single repo (and a permission
// subset). Used by the OIL approver: its App is installed org-wide (so it can
// merge in any system repo), but every individual merge/close should hold a
// token scoped to exactly the one repo it acts on — a GitHub installation token
// can be narrowed to specific `repositories` + a permission subset and can never
// exceed what the installation was granted, giving per-merge isolation
// equivalent to an App-per-repo. Not cached (each call is for a specific repo and
// short-lived); the caller mints once per merge/close.
async function repoScopedToken(
  identity: AppIdentity,
  repo: string,
  permissions: Record<string, string>,
): Promise<string> {
  const resp = await fetch(
    `https://api.github.com/app/installations/${identity.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${makeJwtForApp(identity.appId, identity.privateKey)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ repositories: [repo], permissions }),
    },
  );
  if (!resp.ok) throw new Error(`Repo-scoped token fetch failed (${repo}): ${resp.status}`);
  const data = (await resp.json()) as { token: string };
  return data.token;
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

// Read a repository Actions variable (e.g. GCP_PROJECT_ID) from any repo the
// App installation covers. Returns the value, or null if the variable (or the
// repo) is not found. Used by resolveSystem to locate a system's GCP project
// without a manifest. Read access relies on the broker App's administration
// grant — the same grant provision-system.yml uses to WRITE these variables —
// so a future permission tightening degrades to null (caller falls back).
export async function getRepoVariable(
  owner: string,
  repo: string,
  name: string,
): Promise<string | null> {
  const token = await installationToken();
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub getRepoVariable ${owner}/${repo} ${name} → ${resp.status}`);
  const data = (await resp.json()) as { value: string };
  return data.value;
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

// ── Org-wide read helpers (consolidated from the retired org-reader MCP) ────────
// The broker App is installed org-wide, so these read across every edri2or repo
// using the SAME installationToken() the rest of this client uses — no separate
// reader-App credentials (the org-reader MCP's distinct GitHub App is retired by
// this consolidation). assertOrgOwner keeps the org-scoped App from being aimed
// outside edri2or (every org-read tool's `owner` arg defaults to ORG).
export const ORG = DEFAULT_OWNER;

function assertOrgOwner(owner: string): void {
  if (owner !== ORG) {
    throw new Error(`owner must be '${ORG}' — this App is scoped org-wide to ${ORG} only`);
  }
}

// GET https://api.github.com<path> under the broker installation token.
async function ghApiGet(path: string): Promise<unknown> {
  const token = await installationToken();
  const resp = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!resp.ok) throw new Error(`GitHub GET ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Cross-repo GET, org-asserted. Mirrors the retired org-reader's repoGet — `path`
// is appended after /repos/<owner>/<repo> (e.g. '' for the repo, '/pulls?...').
export async function repoGet(owner: string, repo: string, path: string): Promise<unknown> {
  assertOrgOwner(owner);
  return ghApiGet(`/repos/${owner}/${repo}${path}`);
}

// GET /orgs/<ORG><path> — org repo list, org-level Actions variables.
export async function orgGet(path: string): Promise<unknown> {
  return ghApiGet(`/orgs/${ORG}${path}`);
}

// GET /search<path> — code / issue search across the org.
export async function searchGet(path: string): Promise<unknown> {
  return ghApiGet(`/search${path}`);
}

// Decoded UTF-8 contents of a file in any org repo (truncated at 50 KB). Distinct
// from getRepoFile, which is hardwired to this repo; this takes owner/repo.
export async function fetchFileContents(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
): Promise<string> {
  assertOrgOwner(owner);
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const data = (await ghApiGet(`/repos/${owner}/${repo}/contents/${filePath}${q}`)) as {
    content?: string;
    encoding?: string;
    type?: string;
  };
  if (data.type !== 'file') throw new Error(`Path is not a file (type=${data.type})`);
  if (data.encoding !== 'base64' || !data.content) throw new Error(`Unexpected encoding: ${data.encoding}`);
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
  const MAX = 50 * 1024;
  return decoded.length > MAX ? `${decoded.slice(0, MAX)}\n[... truncated at 50 KB ...]` : decoded;
}

// Delete a repository as the broker App (DELETE /repos/edri2or/<repo>). Uses the
// broker's administration:write (already granted org-wide — it archived repos).
// HARD guards: owner is always edri2or; refuse or-factory-master + the ALWAYS_KEEP
// set so a crafted/buggy caller can never remove the survivor or a protected repo.
// Reached ONLY from the verified Telegram-✅ callback (repo-approval.ts) — never
// agent-triggerable. Structured, never-throws (like mergePullRequestAsApprover).
const ALWAYS_KEEP_REPOS = new Set<string>(['or-factory-master']);

export interface RepoDeleteResult {
  repo: string;
  deleted: boolean;
  status: number;
  message?: string;
}

export async function deleteRepoAsBroker(repo: string): Promise<RepoDeleteResult> {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(repo)) {
    return { repo, deleted: false, status: 400, message: 'invalid repo name' };
  }
  if (ALWAYS_KEEP_REPOS.has(repo)) {
    return { repo, deleted: false, status: 403, message: 'refused: protected repo' };
  }
  try {
    const resp = await ghFetchRepo(DEFAULT_OWNER, repo, '', { method: 'DELETE' });
    if (resp.status === 204) return { repo, deleted: true, status: 204 };
    const txt = await resp.text().catch(() => '');
    return { repo, deleted: false, status: resp.status, message: txt.slice(0, 160) };
  } catch (e) {
    return { repo, deleted: false, status: 0, message: String(e).slice(0, 160) };
  }
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

// Trigger a repository_dispatch event (the inbound trigger the OIL investigator
// workflow listens for: on.repository_dispatch.types=[oil-investigate]). Same
// broker-App auth as dispatchWorkflow; the /dispatches endpoint returns 204 with
// no body. Needs the App's contents:write — the broker has it (it writes repo
// content during provisioning).
export async function dispatchRepositoryEvent(
  eventType: string,
  clientPayload: Record<string, unknown>,
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<void> {
  const resp = await ghFetchRepo(owner, repo, '/dispatches', {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
  });
  if (resp.status !== 204) {
    throw new Error(`repository_dispatch ${owner}/${repo} ${eventType} → ${resp.status}: ${await resp.text()}`);
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

// ── OIL auto-fix approver identity (SECOND App — merges/closes PRs) ──────────────
// A distinct GitHub App from the broker, with only contents:write +
// pull_requests:write. The OIL loop's broker opens a DRAFT PR; this separate
// identity performs the merge after a verified human Telegram ✅ — so the same
// principal can never both author and merge. Built lazily from its own env vars
// (mounted by deploy-mcp-server.yml); when they are absent the approver is simply
// unavailable and approverConfigured() returns false (the broker path is intact).
// deploy-mcp-server.yml creates these as placeholder secrets (literal
// __NOT_CONFIGURED__) so the Cloud Run mount always resolves, even before
// register-oil-approver-app.yml writes the real credentials. Treat the
// placeholder (or empty) as "not configured" so the bridge stays dormant.
const PLACEHOLDER = '__NOT_CONFIGURED__';
const configured = (v: string | undefined): v is string => Boolean(v) && v !== PLACEHOLDER;

const OIL_APPROVER_APP_ID = process.env.OIL_APPROVER_APP_ID;
const OIL_APPROVER_INSTALLATION_ID = process.env.OIL_APPROVER_INSTALLATION_ID;
const OIL_APPROVER_RAW_KEY = process.env.OIL_APPROVER_PRIVATE_KEY;

let approverIdentity: AppIdentity | null = null;

export function approverConfigured(): boolean {
  return configured(OIL_APPROVER_APP_ID) && configured(OIL_APPROVER_INSTALLATION_ID) && configured(OIL_APPROVER_RAW_KEY);
}

function getApproverIdentity(): AppIdentity {
  if (!approverConfigured()) {
    throw new Error('OIL approver App not configured (OIL_APPROVER_APP_ID/_INSTALLATION_ID/_PRIVATE_KEY)');
  }
  if (!approverIdentity) {
    approverIdentity = {
      appId: OIL_APPROVER_APP_ID as string,
      installationId: OIL_APPROVER_INSTALLATION_ID as string,
      // Same literal-\n restoration as the broker key (Secret Manager / Railway).
      privateKey: (OIL_APPROVER_RAW_KEY as string).replace(/\\n/g, '\n'),
      cached: null,
    };
  }
  return approverIdentity;
}

// Generic repo fetch under an explicit App identity (mirrors ghFetchRepo, which
// is hardwired to the broker). Used only by the approver merge/close calls.
async function ghFetchRepoAs(
  identity: AppIdentity,
  owner: string,
  repo: string,
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
): Promise<Response> {
  const token = tokenOverride ?? (await tokenFor(identity));
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

export interface MergeResult {
  merged: boolean;
  // True when the merge was not done synchronously but native auto-merge was
  // armed: GitHub will merge once branch protection's required checks pass.
  pending?: boolean;
  sha?: string;
  status: number;
  message?: string;
}

// GitHub GraphQL under an explicit App identity. Needed for operations REST can't
// do — chiefly markPullRequestReadyForReview (un-drafting a PR; the REST
// PATCH {draft:false} is silently ignored by GitHub).
async function ghGraphQLAs(
  identity: AppIdentity,
  query: string,
  variables: Record<string, unknown>,
  tokenOverride?: string,
): Promise<unknown> {
  const token = tokenOverride ?? (await tokenFor(identity));
  const resp = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await resp.json().catch(() => ({}))) as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data;
}

// Merge a PR as the approver App, SAFELY — never merging a PR whose required CI
// checks aren't green. We do NOT trust the REST `mergeable_state` field, which is
// documented to be unreliable for merge automation (it reports 'clean' on a repo
// without branch protection even when checks fail, and flips to 'unknown' while
// GitHub recomputes — see pascalgn/automerge-action #103/#164). Instead we rely
// on the platform: branch protection on main lists the 4 CI checks as REQUIRED,
// and we arm GitHub's NATIVE auto-merge — GitHub then merges the PR itself, but
// only once every required check passes. That makes green-CI a platform-enforced
// precondition, not something this code has to (mis)judge.
//
// Steps:
//  1. Un-draft via GraphQL markPullRequestReadyForReview (REST {draft:false} is
//     silently ignored; auto-merge can't be enabled on a draft).
//  2. Arm native auto-merge via GraphQL enablePullRequestAutoMerge(SQUASH).
//     → success: { merged:false, pending:true } — GitHub will merge when green.
//  3. If GitHub rejects auto-merge because the PR is ALREADY in a mergeable
//     ("clean") state (nothing left to wait for), fall back to a direct PUT
//     merge — branch protection still enforces required checks, so a red PR is
//     rejected here too (reported, never forced).
// Returns a structured result (never throws) so the Telegram handler reports cleanly.
export async function mergePullRequestAsApprover(
  prNumber: number,
  mergeMethod: 'MERGE' | 'SQUASH' | 'REBASE' = 'SQUASH',
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<MergeResult> {
  // Refuse to act on anything but a well-formed repo in our org — `repo`
  // originates from the verified callback_data, never free input, but guard
  // anyway so the org-wide approver install can never be aimed elsewhere.
  if (owner !== DEFAULT_OWNER || !repo) {
    return { merged: false, status: 400, message: `refused: invalid merge target ${owner}/${repo}` };
  }
  try {
    const identity = getApproverIdentity();
    // Down-scope the approver token to exactly this repo + merge perms, so the
    // org-wide install never yields a broad token at merge time.
    const token = await repoScopedToken(identity, repo, {
      contents: 'write',
      pull_requests: 'write',
    });

    // 1. Resolve the PR node id + draft state, then un-draft via GraphQL.
    const pr = (await (await ghFetchRepoAs(identity, owner, repo, `/pulls/${prNumber}`, {}, token)).json().catch(() => ({}))) as {
      node_id?: string;
      draft?: boolean;
    };
    if (!pr.node_id) return { merged: false, status: 404, message: `could not resolve PR #${prNumber}` };
    if (pr.draft) {
      await ghGraphQLAs(
        identity,
        'mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest{ id isDraft } } }',
        { id: pr.node_id },
        token,
      ).catch(() => undefined);
    }

    // 2. Arm native auto-merge — GitHub merges only when required checks pass.
    try {
      await ghGraphQLAs(
        identity,
        'mutation($id:ID!,$m:PullRequestMergeMethod!){ enablePullRequestAutoMerge(input:{pullRequestId:$id, mergeMethod:$m}){ pullRequest{ id } } }',
        { id: pr.node_id, m: mergeMethod },
        token,
      );
      // Armed. GitHub will merge once the required checks are green.
      return { merged: false, pending: true, status: 200 };
    } catch (e) {
      const msg = String(e);
      // "Pull request is in clean status" / "not in the correct state" ⇒ nothing
      // to wait on (checks already settled / no required checks pending). Fall
      // through to a direct merge, which branch protection still gates on green.
      const alreadyMergeable = /clean status|correct state|not mergeable|cannot be merged|Base branch/i.test(msg);
      if (!alreadyMergeable) {
        return { merged: false, status: 422, message: `enable auto-merge failed: ${msg.slice(0, 160)}` };
      }
    }

    // 3. Fallback: direct merge (branch protection enforces required checks; a red
    //    PR is rejected here, never forced).
    const restMethod = mergeMethod.toLowerCase(); // SQUASH → squash
    const resp = await ghFetchRepoAs(identity, owner, repo, `/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: restMethod }),
    }, token);
    const data = (await resp.json().catch(() => ({}))) as { merged?: boolean; sha?: string; message?: string };
    if (resp.ok && data.merged) {
      return { merged: true, sha: data.sha, status: resp.status };
    }
    // 405 = blocked by branch protection (e.g. required checks not green) — the
    // safety net working as intended.
    return {
      merged: false,
      status: resp.status,
      message: data.message ?? `merge HTTP ${resp.status}`,
    };
  } catch (e) {
    return { merged: false, status: 0, message: String(e).slice(0, 200) };
  }
}

// Close a PR without merging (the ❌ path), as the approver App. Structured,
// never-throws result. The branch is left for the workflow/operator to prune.
export async function closePullRequestAsApprover(
  prNumber: number,
  owner: string = DEFAULT_OWNER,
  repo: string = DEFAULT_REPO,
): Promise<MergeResult> {
  if (owner !== DEFAULT_OWNER || !repo) {
    return { merged: false, status: 400, message: `refused: invalid close target ${owner}/${repo}` };
  }
  try {
    const identity = getApproverIdentity();
    const token = await repoScopedToken(identity, repo, {
      contents: 'write',
      pull_requests: 'write',
    });
    const resp = await ghFetchRepoAs(identity, owner, repo, `/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    }, token);
    const data = (await resp.json().catch(() => ({}))) as { state?: string; message?: string };
    if (resp.ok && data.state === 'closed') {
      return { merged: false, status: resp.status };
    }
    return { merged: false, status: resp.status, message: data.message ?? `close HTTP ${resp.status}` };
  } catch (e) {
    return { merged: false, status: 0, message: String(e).slice(0, 200) };
  }
}
