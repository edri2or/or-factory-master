// Factory telemetry scope — the tenant-locked tool subset behind
// /factory/<system>/mcp ("לידה מחוברת": every provisioned system is born with
// read-only factory telemetry over ITSELF — never over a sibling system, the
// org, or the factory's write surfaces).
//
// How the lock works (defense in depth, all server-side):
//   1. ALLOWLIST, not blocklist: registerFactoryScopedTools() hands the real
//      registerTools() a facade McpServer whose .tool() forwards ONLY the 8
//      names below. Everything else (org-read tools, dispatch_workflow, GCP /
//      Cloudflare / SM surfaces) is silently dropped — it never exists on this
//      route, so there is nothing to "deny".
//   2. The tenant-identifying parameters (systemName / owner+repo) are REMOVED
//      from each tool's schema and INJECTED from the signed bearer claim — the
//      caller cannot even express a cross-tenant request.
//   3. Tools whose remaining parameters could still reach a sibling (raw
//      Railway ids; an arbitrary probe URL) get a guard that resolves the
//      system's OWN resources and refuses anything else with `tenant_blocked`
//      before the underlying handler (and any network call) runs.
//
// The per-request server is built by index.ts (same stateless pattern as /mcp);
// the system string is regex-validated + allowlist-checked there BEFORE it
// reaches this module.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools.js';
import {
  listProjects as railwayListProjects,
  getProject as railwayGetProject,
} from './railway-client.js';

// Same shape the factory enforces on system_name (6–30 chars).
const SYSTEM_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

// Kill-switch / pin: "*" (default) admits any syntactically-valid system name —
// the per-system bearer is the real boundary, and reachability of each tool is
// still gated by the system's own resources (SM key, Railway project, repo).
// Set a CSV to pin to specific systems, or empty to close the surface entirely.
const ALLOWED_SYSTEMS = new Set(
  (process.env.FACTORY_TOOLS_ALLOWED_SYSTEMS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const ALLOW_ANY_SYSTEM = ALLOWED_SYSTEMS.has('*');

export function isAllowedFactorySystem(system: string): boolean {
  if (!SYSTEM_NAME_RE.test(system)) return false;
  return ALLOW_ANY_SYSTEM || ALLOWED_SYSTEMS.has(system);
}

type ScopedToolResult = { content: Array<{ type: 'text'; text: string }> };
type ScopedArgs = Record<string, unknown>;
type ToolRegistrar = (
  name: string,
  description: string,
  schema: ScopedArgs,
  handler: (args: ScopedArgs) => Promise<ScopedToolResult>,
) => unknown;

type GuardResult =
  | { ok: true; inject?: ScopedArgs }
  | { ok: false; error: string; message: string };

// Pure cross-tenant probe check (unit-tested). The scoped probe surface is the
// system's ONE public host — its n8n edge (Caddy) on or-infra.com. Returns a
// human-readable violation, or null when the URL is the system's own host.
export function probeTenantViolation(system: string, url: unknown): string | null {
  const allowedHost = `n8n-${system}.or-infra.com`;
  let parsed: URL;
  try {
    parsed = new URL(String(url ?? ''));
  } catch {
    return `invalid URL — this surface may only probe https://${allowedHost}/...`;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost) {
    return `probe blocked: host must be exactly ${allowedHost} (got ${parsed.hostname || 'none'})`;
  }
  return null;
}

// Resolve the system's OWN Railway project + production environment, and verify
// the caller-supplied serviceId actually belongs to that project. Injects the
// resolved projectId/environmentId (both removed from the schema), so the two
// by-id Railway tools can never read a sibling project's deployments or logs.
async function railwayScopeGuard(system: string, args: ScopedArgs): Promise<GuardResult> {
  const summary = (await railwayListProjects()).find((p) => p.name === system);
  if (!summary) {
    return { ok: false, error: 'railway_project_not_found', message: `no Railway project named ${system}` };
  }
  const proj = await railwayGetProject(summary.id);
  if (!proj) {
    return { ok: false, error: 'railway_project_not_found', message: `Railway project ${summary.id} unreadable` };
  }
  const env =
    proj.environments.edges.find((e) => e.node.name === 'production') ??
    proj.environments.edges[0];
  if (!env) {
    return { ok: false, error: 'railway_no_environment', message: `Railway project ${summary.id} has no environments` };
  }
  const serviceId = String(args['serviceId'] ?? '');
  if (!proj.services.edges.some((s) => s.node.id === serviceId)) {
    return {
      ok: false,
      error: 'tenant_blocked',
      message: `serviceId ${serviceId || '(empty)'} is not a service of ${system}'s Railway project — call inspect_railway_service to discover your own service ids`,
    };
  }
  return { ok: true, inject: { projectId: summary.id, environmentId: env.node.id } };
}

interface ScopedSpec {
  // Replaces the factory-internal description with one that states the scoped
  // contract (no mention of parameters that no longer exist).
  description: (system: string) => string;
  // Parameters removed from the visible schema (re-injected server-side).
  drop: string[];
  // Static claim-derived arguments, merged over the caller's.
  inject?: (system: string) => ScopedArgs;
  // Async pre-handler check; may add resolved arguments on success.
  guard?: (system: string, args: ScopedArgs) => Promise<GuardResult>;
}

const SPECS: Record<string, ScopedSpec> = {
  list_n8n_workflows: {
    description: (s) =>
      `List ${s}'s n8n workflows via the n8n Public API: each workflow's id, name, ACTIVE flag, and trigger node types. The system identity is fixed server-side.`,
    drop: ['systemName'],
    inject: (s) => ({ systemName: s }),
  },
  inspect_n8n_execution: {
    description: (s) =>
      `Inspect ${s}'s n8n executions. With no executionId, lists recent executions (optionally filtered by status/workflowId) and fetches detail for the most recent match; with executionId, fetches that one. Returns status and, on failure, the failing node + error message.`,
    drop: ['systemName'],
    inject: (s) => ({ systemName: s }),
  },
  inspect_railway_service: {
    description: (s) =>
      `Inspect a Railway service in ${s}'s own Railway project: latest deployment status, public domains, and the service/environment ids the other Railway tools take. Pass serviceName (e.g. n8n, postgres, caddy).`,
    drop: ['systemName'],
    inject: (s) => ({ systemName: s }),
  },
  list_railway_deployments: {
    description: (s) =>
      `List the recent N deployments (id, status, createdAt) for one of ${s}'s own Railway services. Pass serviceId (discover it via inspect_railway_service); the project and environment are resolved server-side.`,
    drop: ['projectId', 'environmentId'],
    guard: railwayScopeGuard,
  },
  tail_railway_deployment_logs: {
    description: (s) =>
      `Tail recent runtime logs (stdout/stderr) of the latest deployment of one of ${s}'s own Railway services. Pass serviceId (discover it via inspect_railway_service); the project and environment are resolved server-side.`,
    drop: ['projectId', 'environmentId'],
    guard: railwayScopeGuard,
  },
  probe_endpoint: {
    description: (s) =>
      `HTTPS request to ${s}'s own public host ONLY (https://n8n-${s}.or-infra.com/...). Defaults to GET; pass method=POST + body to fire one of your webhooks end-to-end (e.g. /webhook/agent-router) and read the reply. Returns status, content-type, body (truncated 4 KB), and optional expect_status / expect_body_contains checks. Any other host is refused (tenant_blocked).`,
    drop: [],
    guard: async (system, args) => {
      const violation = probeTenantViolation(system, args['url']);
      return violation === null ? { ok: true } : { ok: false, error: 'tenant_blocked', message: violation };
    },
  },
  list_workflow_runs: {
    description: (s) =>
      `List recent GitHub Actions workflow runs in ${s}'s own repo (edri2or/${s}). Optionally filter by workflow file name, branch, or status.`,
    drop: ['owner', 'repo'],
    inject: (s) => ({ owner: 'edri2or', repo: s }),
  },
  get_run_jobs: {
    description: (s) =>
      `Get jobs and steps for a workflow run in ${s}'s own repo (edri2or/${s}) — step conclusions, plus optional full job logs via fetch_logs_for_job_id (narrow with grep/tail_lines).`,
    drop: ['owner', 'repo'],
    inject: (s) => ({ owner: 'edri2or', repo: s }),
  },
};

// The exact tool names this surface exposes (sorted; exported for tests + the
// smoke's exact-set assertion).
export const FACTORY_SCOPED_TOOL_NAMES = Object.keys(SPECS).sort();

// Register the scoped subset on a per-request McpServer. `system` is already
// validated (isAllowedFactorySystem) and comes from the signed bearer claim /
// path — never from a tool argument.
export function registerFactoryScopedTools(server: McpServer, system: string): void {
  const register = (server as unknown as { tool: ToolRegistrar }).tool.bind(server);
  const facade = {
    tool: (name: string, _description: string, schema: ScopedArgs, handler: (args: ScopedArgs) => Promise<ScopedToolResult>): void => {
      const spec = SPECS[name];
      if (!spec) return; // not allowlisted — this tool does not exist here
      const narrowed: ScopedArgs = {};
      for (const [key, validator] of Object.entries(schema)) {
        if (!spec.drop.includes(key)) narrowed[key] = validator;
      }
      register(name, spec.description(system), narrowed, async (args: ScopedArgs) => {
        let injected: ScopedArgs = spec.inject ? spec.inject(system) : {};
        if (spec.guard) {
          const g = await spec.guard(system, args);
          if (!g.ok) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: g.error, system, message: g.message }, null, 2) }],
            };
          }
          injected = { ...injected, ...(g.inject ?? {}) };
        }
        return handler({ ...args, ...injected });
      });
    },
  };
  registerTools(facade as unknown as McpServer);
}
