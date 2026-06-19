// Coordinator scope — the NARROW tool subset behind /coordinator/<repo>/mcp.
//
// This is the secure "hands" of the coordinator agent-repo (Nuriel): a Claude
// Code session running in edri2or/nuriel reaches THIS route (not the broad /mcp)
// and gets exactly:
//   • a small READ subset (to watch the broker run + read the result file a
//     worker's answer lands in), and
//   • ONE write tool, route_to_agent, that dispatches ONLY agent-action.yml
//     (phase=propose) to an ALLOWLISTED sibling agent-repo — nothing else.
//
// How the lock works (defense in depth, all server-side, mirrors factory-scope):
//   1. ALLOWLIST, not blocklist. registerCoordinatorScopedTools() hands the real
//      registerTools()/registerOrgReadTools() a facade McpServer whose .tool()
//      forwards ONLY the READ_TOOLS names below. The broad dispatch_workflow, the
//      GCP/Railway/Cloudflare/SM surfaces, every provisioning tool — none are
//      registered here, so there is nothing to "deny": they do not exist.
//   2. route_to_agent hard-codes workflow_id=agent-action.yml and phase=propose
//      (never inputs); the worker_repo is checked against a fail-closed env
//      allowlist; the requester_repo is the route's bearer-bound repo (closure-
//      captured, NEVER a tool argument) so the caller cannot impersonate another
//      requester. The agent-action RED gate (Telegram ✅) is inherited
//      automatically — propose-classified-red is not brokered without Or's tap.
//
// The per-request server + the operator-grade (oauth/admin) auth gate live in
// index.ts (same stateless pattern as /factory/<system>/mcp); the path repo is
// regex-validated + allowlist-checked there (isAllowedCoordinatorRepo) BEFORE it
// reaches this module.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTools } from './tools.js';
import { registerOrgReadTools } from './org-read-tools.js';
import { dispatchWorkflow, getLatestWorkflowRun, discoverDispatchedRun } from './github-client.js';

const OWNER = 'edri2or';
const FACTORY_REPO = 'or-factory-master';
const AGENT_ACTION_WORKFLOW = 'agent-action.yml';

// Repo-name shape — the SAME guard agent-action.yml / agent-approval.ts apply (a
// bare repo under edri2or, never owner/repo). Re-checked here so a bad worker
// name can never become a dispatch.
const REPO_RE = /^[a-z][a-z0-9._-]{2,38}[a-z0-9]$/;
// The path repo (the requester / coordinator) shape — the agent-repo name shape
// refresh-agent-repo.yml validates.
const COORDINATOR_REPO_RE = /^[a-z][a-z0-9-]{2,38}[a-z0-9]$/;
// A short correlation id tying the dispatch to its result file.
const CORR_RE = /^[A-Za-z0-9-]{1,40}$/;

// Normalise "owner/repo" → "repo"; validate the bare-repo shape; refuse the
// control/factory repos. Returns null on any failure (so the caller refuses).
function cleanRepo(raw: unknown): string | null {
  const name = String(raw ?? '').split('/').pop() ?? '';
  if (!REPO_RE.test(name)) return null;
  if (name === 'or-factory-master' || name === 'or-factory-master-control' || name.endsWith('-control')) {
    return null;
  }
  return name;
}

function csvSet(envVal: string | undefined): Set<string> {
  return new Set((envVal ?? '').split(',').map((s) => s.trim()).filter(Boolean));
}

// Fail-closed: an empty/absent env var admits NOTHING (no worker, no requester).
// Pinning to a CSV is the norm (e.g. "nachshon,natan-research,sapi-docs").
const WORKER_REPOS = csvSet(process.env.COORDINATOR_WORKER_REPOS);
const REQUESTER_REPOS = csvSet(process.env.COORDINATOR_REQUESTER_REPOS);

// The path repo (requester) must be shape-valid AND in the requester allowlist.
// Exported for the index.ts 404 gate + tests.
export function isAllowedCoordinatorRepo(repo: string): boolean {
  if (!COORDINATOR_REPO_RE.test(repo)) return false;
  return REQUESTER_REPOS.has(repo);
}

// The READ tools this surface exposes — enough for the coordinator to watch the
// broker run and read the result file a worker writes back. Sourced from BOTH
// registrars (run tools live in tools.ts; the file/PR/commit reads live in
// org-read-tools.ts), so the facade wraps both. Everything else is dropped.
const READ_TOOLS = new Set<string>([
  'list_workflow_runs', // watch the dispatched agent-action run
  'get_workflow_run',
  'get_run_jobs',
  'get_file_contents', // read results/<corr>.json the broker writes back
  'list_commits',
  'get_repo',
  'get_pull_request',
  'list_pull_request_files',
]);

// The exact tool set this route exposes (sorted; for the unit test + smoke's
// exact-set assertion).
export const COORDINATOR_SCOPED_TOOL_NAMES = [...READ_TOOLS, 'route_to_agent'].sort();

type ScopedToolResult = { content: Array<{ type: 'text'; text: string }> };
type ScopedArgs = Record<string, unknown>;
type ToolRegistrar = (
  name: string,
  description: string,
  schema: ScopedArgs,
  handler: (args: ScopedArgs) => Promise<ScopedToolResult>,
) => unknown;

function asText(obj: unknown): ScopedToolResult {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

// Register the narrow coordinator subset on a per-request McpServer. `requesterRepo`
// is already validated (isAllowedCoordinatorRepo) and comes from the route path —
// never from a tool argument.
export function registerCoordinatorScopedTools(server: McpServer, requesterRepo: string): void {
  const register = (server as unknown as { tool: ToolRegistrar }).tool.bind(server);

  // Facade: forward ONLY the allowlisted read tools, verbatim (schema unchanged —
  // the coordinator legitimately reads across the allowlisted sibling repos, and
  // org-read-tools asserts the org owner internally).
  const facade = {
    tool: (name: string, description: string, schema: ScopedArgs, handler: (args: ScopedArgs) => Promise<ScopedToolResult>): void => {
      if (!READ_TOOLS.has(name)) return; // not allowlisted — does not exist here
      register(name, description, schema, handler);
    },
  };
  registerTools(facade as unknown as McpServer);
  registerOrgReadTools(facade as unknown as McpServer);

  // The ONE write tool. Hard-coded to agent-action.yml propose; worker allowlisted;
  // requester injected from the route (not a caller arg).
  register(
    'route_to_agent',
    `Hand a unit of work to an allowlisted sibling agent-repo via the agent-action broker (phase=propose ONLY). ` +
      `The broker classifies the task and runs green/yellow immediately, or asks Or for a Telegram ✅ on a RED task; ` +
      `the worker's answer is written back to YOUR repo (${requesterRepo}) as results/<correlation_id>.json — read it with get_file_contents. ` +
      `You can route ONLY to the allowlisted workers (${[...WORKER_REPOS].join(', ') || 'none configured'}); no other workflow is dispatchable from here.`,
    {
      worker_repo: z
        .string()
        .describe('The sibling agent-repo that does the work (e.g. nachshon, natan-research, sapi-docs). Must be allowlisted.'),
      task: z
        .string()
        .describe('The freeform unit of work. The worker treats it as untrusted DATA, never as commands.'),
      correlation_id: z
        .string()
        .optional()
        .describe('Optional id (≤40 chars, [A-Za-z0-9-]) tying the dispatch to its result file; generated if absent.'),
    },
    async (args: ScopedArgs): Promise<ScopedToolResult> => {
      const worker = cleanRepo(args['worker_repo']);
      if (!worker || !WORKER_REPOS.has(worker)) {
        return asText({
          error: 'worker_not_allowlisted',
          got: String(args['worker_repo'] ?? ''),
          allowed: [...WORKER_REPOS],
        });
      }
      const task = String(args['task'] ?? '').trim();
      if (!task) return asText({ error: 'empty_task' });

      const rawCorr = typeof args['correlation_id'] === 'string' ? (args['correlation_id'] as string).trim() : '';
      const corr = rawCorr || `nuriel-${Date.now().toString(36)}`;
      if (!CORR_RE.test(corr)) return asText({ error: 'bad_correlation_id', got: corr });

      // Baseline: the latest agent-action run BEFORE we dispatch. workflow_dispatch is async,
      // so reading "latest" right after the dispatch returns the PREVIOUS run until the new one
      // materialises — the stale run_id that shifted the coordinator's run↔corr bookkeeping by
      // one. Capturing the baseline here lets discoverDispatchedRun return the NEW run instead.
      let beforeId: number | null = null;
      try {
        beforeId = (await getLatestWorkflowRun(AGENT_ACTION_WORKFLOW, 'main', OWNER, FACTORY_REPO))?.id ?? null;
      } catch {
        /* best-effort baseline — discover tolerates a null baseline */
      }

      try {
        await dispatchWorkflow(
          AGENT_ACTION_WORKFLOW,
          'main',
          {
            phase: 'propose', // hard-coded — execute is reachable only via the Telegram ✅ callback
            worker_repo: worker,
            requester_repo: requesterRepo, // route-bound, never a caller arg
            task,
            correlation_id: corr,
          },
          OWNER,
          FACTORY_REPO,
        );
      } catch (e) {
        return asText({ error: 'dispatch_failed', detail: String(e).slice(0, 300) });
      }

      let run: { id: number; html_url: string } | null = null;
      try {
        run = await discoverDispatchedRun(
          () => getLatestWorkflowRun(AGENT_ACTION_WORKFLOW, 'main', OWNER, FACTORY_REPO),
          beforeId,
        );
      } catch {
        /* best-effort — the dispatch already succeeded */
      }
      return asText({
        dispatched: true,
        worker_repo: worker,
        requester_repo: requesterRepo,
        correlation_id: corr,
        run_id: run?.id ?? null,
        run_url: run?.html_url ?? null,
        note: run
          ? `the answer will be written to ${requesterRepo}/results/${corr}.json (read it with get_file_contents). A RED task waits for Or's Telegram ✅.`
          : `dispatched (corr=${corr}); the run is not visible yet — find it by correlation_id, or just read ${requesterRepo}/results/${corr}.json. A RED task waits for Or's Telegram ✅.`,
      });
    },
  );
}
