import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiGetRepo, fetchJobLogs, filterLogText, dispatchWorkflow, getLatestWorkflowRun } from './github-client.js';
import {
  getProject as gcpGetProject,
  listEnabledServices as gcpListEnabledServices,
  getServiceAccount as gcpGetServiceAccount,
  listSAKeys as gcpListSAKeys,
  listSecrets as gcpListSecrets,
  getEnabledSecretVersionCount as gcpGetSecretVersionCount,
  getWifPool as gcpGetWifPool,
  getWifProvider as gcpGetWifProvider,
  getWifProviderDetails as gcpGetWifProviderDetails,
  getCloudRunService as gcpGetCloudRunService,
  listSecretsWithMetadata as gcpListSecretsWithMetadata,
  listSecretsExtendedMetadata as gcpListSecretsExtendedMetadata,
  getProjectNumber as gcpGetProjectNumber,
  listAllProjects as gcpListAllProjects,
  getProjectIamPolicy as gcpGetProjectIamPolicy,
  listWifPools as gcpListWifPools,
  listWifProviders as gcpListWifProviders,
  listArtifactRegistryRepos as gcpListArRepos,
  listArtifactRegistryDockerImages as gcpListArImages,
  listCloudBuilds as gcpListCloudBuilds,
} from './gcp-client.js';
import { tailCloudRunLogs as gcpTailCloudRunLogs } from './gcp-logging-client.js';
import {
  getProject as railwayGetProject,
  getServiceLatestDeployment as railwayGetDeployment,
  getServiceInstance as railwayGetServiceInstance,
  listProjects as railwayListProjects,
  getDeploymentLogs as railwayGetDeploymentLogs,
  getBuildLogs as railwayGetBuildLogs,
  listServiceVariables as railwayListServiceVariables,
  listVolumes as railwayListVolumes,
  listDeployments as railwayListDeployments,
  rawGraphqlRead as railwayRawGraphqlRead,
} from './railway-client.js';
import {
  getDnsRecord as cfGetDnsRecord,
  createScopedReadToken as cfCreateScopedReadToken,
  revokeScopedToken as cfRevokeScopedToken,
  listZones as cfListZones,
  listDnsRecords as cfListDnsRecords,
  CfZonesTokenError,
} from './cloudflare-client.js';
import { buildInventory } from './inventory-aggregator.js';
import { resolveSystem, condition, summarize, NotFoundError, type SystemManifest, type Check, type VerifyResult } from './manifest-helper.js';
import { probe, isAllowedUrl, AllowlistError, type ProbeResult } from './probe.js';
import { resolveRecord as dnsResolveRecord, SUPPORTED_DNS_TYPES, DnsAllowlistError } from './dns-helper.js';
import { inspectCert as tlsInspectCert, TlsAllowlistError } from './tls-helper.js';
import { n8nApiGet, N8nKeyMissingError } from './n8n-client.js';
import { emitEvent, type EmitEventInput } from './observability-client.js';

export function registerTools(server: McpServer): void {
  // Shared owner/repo params for every GitHub-backed tool. Default to the
  // factory's own repo; pass repo (e.g. "factory-test-23") to read a system
  // repo. The App installation must cover the target repo.
  const repoParams = {
    owner: z.string().optional().describe("Repo owner (default 'edri2or')"),
    repo: z
      .string()
      .optional()
      .describe("Repo name (default 'or-factory-master'; e.g. 'factory-test-23' for a system repo)"),
  };
  // 5 MB ceiling for entry-array log tools (Railway/Cloud Run), matching the
  // GitHub raw-log ceiling. Bounds a pathological response without hiding data.
  const MAX_LOG_BYTES = 5 * 1024 * 1024;
  // Case-insensitive regex filter over serialized log entries. Invalid regex
  // falls through to no-op (returns all) rather than throwing.
  const grepEntries = <T>(entries: T[], pattern?: string): T[] => {
    if (!pattern) return entries;
    let re: RegExp;
    try {
      re = new RegExp(pattern, 'i');
    } catch {
      return entries;
    }
    return entries.filter((e) => re.test(JSON.stringify(e)));
  };

  // Shared log-read params (no 50 KB cap; surgical filtering + pagination).
  const logReadParams = {
    grep: z
      .string()
      .optional()
      .describe('Case-insensitive regex; return only matching lines + context (surgical mode)'),
    context: z.number().int().min(0).max(50).optional().describe('Lines of context around each grep match (default 3)'),
    offset_bytes: z.number().int().min(0).optional().describe('Start of the byte window into the full log (pagination)'),
    max_bytes: z.number().int().min(1).optional().describe('Byte ceiling for this read (default 5 MB)'),
    tail_lines: z.number().int().min(1).optional().describe('Return only the last N lines (ignored if grep set)'),
  };

  server.tool(
    'list_workflow_runs',
    "List recent GitHub Actions workflow runs (default repo edri2or/or-factory-master; pass repo for a system repo).",
    {
      ...repoParams,
      workflow_id: z.string().optional().describe('Workflow file name, e.g. provision-system.yml'),
      branch: z.string().optional().describe('Filter by branch name'),
      status: z
        .enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending'])
        .optional()
        .describe('Filter by run status'),
      limit: z.number().int().min(1).max(20).optional().default(10).describe('Number of runs to return'),
    },
    async ({ owner, repo, workflow_id, branch, status, limit }) => {
      const params = new URLSearchParams();
      if (branch) params.set('branch', branch);
      if (status) params.set('status', status);
      params.set('per_page', String(limit ?? 10));

      const path = workflow_id
        ? `/actions/workflows/${encodeURIComponent(workflow_id)}/runs?${params}`
        : `/actions/runs?${params}`;

      const data = (await apiGet(path, owner, repo)) as { workflow_runs: unknown[] };
      const runs = (data.workflow_runs ?? []).map((r: unknown) => {
        const run = r as Record<string, unknown>;
        return {
          id: run['id'],
          name: run['name'],
          workflow_id: run['workflow_id'],
          head_branch: run['head_branch'],
          status: run['status'],
          conclusion: run['conclusion'],
          created_at: run['created_at'],
          updated_at: run['updated_at'],
          html_url: run['html_url'],
        };
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(runs, null, 2) }] };
    },
  );

  server.tool(
    'get_workflow_run',
    'Get details of a specific GitHub Actions workflow run',
    { ...repoParams, run_id: z.string().describe('The numeric workflow run ID') },
    async ({ owner, repo, run_id }) => {
      const run = (await apiGet(`/actions/runs/${run_id}`, owner, repo)) as Record<string, unknown>;
      const summary = {
        id: run['id'],
        name: run['name'],
        workflow_id: run['workflow_id'],
        head_branch: run['head_branch'],
        head_sha: run['head_sha'],
        status: run['status'],
        conclusion: run['conclusion'],
        created_at: run['created_at'],
        updated_at: run['updated_at'],
        run_started_at: run['run_started_at'],
        html_url: run['html_url'],
        jobs_url: run['jobs_url'],
        triggering_actor: (run['triggering_actor'] as Record<string, unknown>)?.['login'],
        event: run['event'],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    'get_run_jobs',
    'Get jobs and steps for a workflow run — includes step conclusions and log URLs',
    {
      ...repoParams,
      run_id: z.string().describe('The numeric workflow run ID'),
      fetch_logs_for_job_id: z
        .string()
        .optional()
        .describe('If provided, also fetch full plain-text logs for this job ID (no 50 KB cap; use grep/tail_lines/offset_bytes to narrow)'),
      ...logReadParams,
    },
    async ({ owner, repo, run_id, fetch_logs_for_job_id, grep, context, offset_bytes, max_bytes, tail_lines }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/jobs`, owner, repo)) as { jobs: unknown[] };
      const jobs = (data.jobs ?? []).map((j: unknown) => {
        const job = j as Record<string, unknown>;
        return {
          id: job['id'],
          name: job['name'],
          status: job['status'],
          conclusion: job['conclusion'],
          started_at: job['started_at'],
          completed_at: job['completed_at'],
          html_url: job['html_url'],
          steps: ((job['steps'] as unknown[]) ?? []).map((s: unknown) => {
            const step = s as Record<string, unknown>;
            return {
              number: step['number'],
              name: step['name'],
              status: step['status'],
              conclusion: step['conclusion'],
            };
          }),
        };
      });

      let logs: string | null = null;
      if (fetch_logs_for_job_id) {
        try {
          logs = await fetchJobLogs(fetch_logs_for_job_id, {
            owner,
            repo,
            grep,
            context,
            offsetBytes: offset_bytes,
            maxBytes: max_bytes,
            tailLines: tail_lines,
          });
        } catch (e) {
          logs = `Error fetching logs: ${String(e)}`;
        }
      }

      const result: Record<string, unknown> = { jobs };
      if (logs !== null) result['logs'] = logs;
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'read_github_actions_run_logs',
    'Read FULL plain-text logs for a single GitHub Actions job in any edri2or repo. No 50 KB cap (5 MB default ceiling; the Claude Code harness spills large output to a local file the agent reads in chunks). Use grep for surgical server-side filtering (case-insensitive regex + context lines), or offset_bytes/tail_lines to paginate. Resolve the job_id first via get_run_jobs. Read-only.',
    {
      ...repoParams,
      job_id: z.string().describe('The numeric job ID (from get_run_jobs)'),
      ...logReadParams,
    },
    async ({ owner, repo, job_id, grep, context, offset_bytes, max_bytes, tail_lines }) => {
      try {
        const logs = await fetchJobLogs(job_id, {
          owner,
          repo,
          grep,
          context,
          offsetBytes: offset_bytes,
          maxBytes: max_bytes,
          tailLines: tail_lines,
        });
        return { content: [{ type: 'text' as const, text: logs }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error fetching logs: ${String(e)}` }] };
      }
    },
  );

  server.tool(
    'list_workflows',
    'List all workflows defined in a repo (default edri2or/or-factory-master; returns name, file path, state).',
    { ...repoParams, limit: z.number().int().min(1).max(100).optional().default(30) },
    async ({ owner, repo, limit }) => {
      const data = (await apiGet(`/actions/workflows?per_page=${limit ?? 30}`, owner, repo)) as { workflows: unknown[] };
      const workflows = (data.workflows ?? []).map((w: unknown) => {
        const wf = w as Record<string, unknown>;
        return {
          id: wf['id'],
          name: wf['name'],
          path: wf['path'],
          state: wf['state'],
          html_url: wf['html_url'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(workflows, null, 2) }] };
    },
  );

  server.tool(
    'list_run_artifacts',
    'List artifacts produced by a workflow run (metadata only — name, size, expiration, download URL).',
    { ...repoParams, run_id: z.string().describe('The numeric workflow run ID') },
    async ({ owner, repo, run_id }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/artifacts`, owner, repo)) as { artifacts: unknown[] };
      const artifacts = (data.artifacts ?? []).map((a: unknown) => {
        const art = a as Record<string, unknown>;
        return {
          id: art['id'],
          name: art['name'],
          size_in_bytes: art['size_in_bytes'],
          expired: art['expired'],
          created_at: art['created_at'],
          expires_at: art['expires_at'],
          archive_download_url: art['archive_download_url'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(artifacts, null, 2) }] };
    },
  );

  server.tool(
    'list_pending_deployments',
    'List environments awaiting approval for a workflow run.',
    { ...repoParams, run_id: z.string().describe('The numeric workflow run ID') },
    async ({ owner, repo, run_id }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/pending_deployments`, owner, repo)) as unknown[];
      const pending = (data ?? []).map((p: unknown) => {
        const dep = p as Record<string, unknown>;
        const env = dep['environment'] as Record<string, unknown> | undefined;
        return {
          environment_id: env?.['id'],
          environment_name: env?.['name'],
          wait_timer: dep['wait_timer'],
          wait_timer_started_at: dep['wait_timer_started_at'],
          current_user_can_approve: dep['current_user_can_approve'],
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(pending, null, 2) }] };
    },
  );

  server.tool(
    'get_workflow_run_usage',
    'Get billable time + duration breakdown for a workflow run.',
    { ...repoParams, run_id: z.string().describe('The numeric workflow run ID') },
    async ({ owner, repo, run_id }) => {
      const data = await apiGet(`/actions/runs/${run_id}/timing`, owner, repo);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ─── Workflow dispatch (the one WRITE tool) ─────────────────────────────
  // Lets the agent trigger the factory's lifecycle workflows itself instead of
  // the operator clicking "Run workflow" or curling the API with a temporary
  // PAT. Auth is the org-wide broker App (actions:write), so it reaches both
  // or-factory-master and any system repo. Bounded by an allowlist.
  // decommission-test-system.yml IS allowed — it's narrow + test-only (deletes
  // a test system's Railway project + DNS, archives its repo; touches no GCP
  // project or SM). decommission-system.yml (real-system teardown, soft-deletes
  // a GCP project) stays excluded — destructive; requires written approval.
  // configure-agent-router.yml IS allowed — it's a per-system n8n config workflow
  // (idempotent create/update of the Agent Router workflows via REST; soft-fail,
  // touches no GCP/SM), so the agent can wire the router itself instead of the
  // operator clicking "Run workflow".
  const DISPATCHABLE_WORKFLOWS = new Set([
    'provision-system.yml',
    'register-system-app.yml',
    'deploy-railway-cloudflare.yml',
    'configure-agent-router.yml',
    'decommission-test-system.yml',
  ]);

  server.tool(
    'dispatch_workflow',
    'Trigger a workflow_dispatch event for an ALLOWLISTED factory workflow (provision-system.yml, register-system-app.yml, deploy-railway-cloudflare.yml, configure-agent-router.yml, decommission-test-system.yml). Dispatches as the org-wide broker App, so it works on or-factory-master AND any system repo (pass repo, e.g. "factory-test-24"). Polls briefly and returns the created run_id + run_url. This is the only WRITE tool on the server. configure-agent-router.yml wires the multi-agent router into a system\'s n8n (idempotent, soft-fail); decommission-test-system.yml is test-only (Railway+DNS+repo-archive, no GCP/SM); the real-system decommission-system.yml is intentionally NOT dispatchable here.',
    {
      ...repoParams,
      workflow_id: z.string().describe('Workflow file name to dispatch, e.g. provision-system.yml. Must be on the allowlist.'),
      ref: z.string().optional().default('main').describe('Git ref to run on (default: main; the broker WIF CEL pins refs/heads/main)'),
      inputs: z
        .record(z.string(), z.string())
        .optional()
        .describe('workflow_dispatch inputs, e.g. {"system_name":"factory-test-24"} (deploy-railway-cloudflare.yml takes none)'),
    },
    async ({ owner, repo, workflow_id, ref, inputs }) => {
      if (!DISPATCHABLE_WORKFLOWS.has(workflow_id)) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'workflow_not_allowlisted',
              workflow_id,
              allowed: [...DISPATCHABLE_WORKFLOWS],
              message: 'Not on the dispatch allowlist. decommission-system.yml is intentionally excluded (destructive; requires written approval).',
            }, null, 2),
          }],
        };
      }
      const targetRef = ref ?? 'main';
      try {
        await dispatchWorkflow(workflow_id, targetRef, inputs ?? {}, owner, repo);
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'dispatch_failed', workflow_id, detail: String(e).slice(0, 400) }, null, 2) }],
        };
      }
      // The dispatch API returns 204 with no body — poll briefly for the run.
      let run: Awaited<ReturnType<typeof getLatestWorkflowRun>> = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          run = await getLatestWorkflowRun(workflow_id, targetRef, owner, repo);
          if (run) break;
        } catch { /* transient — keep polling */ }
      }
      const result = {
        dispatched: true,
        owner: owner ?? 'edri2or',
        repo: repo ?? 'or-factory-master',
        workflow_id,
        ref: targetRef,
        inputs: inputs ?? {},
        run_id: run?.id ?? null,
        run_url: run?.html_url ?? null,
        run_status: run?.status ?? null,
        note: run ? undefined : 'run not visible yet — use list_workflow_runs to find it shortly',
        timestamp: new Date().toISOString(),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'emit_event',
    "Emit one observability event into the factory pipeline — the same OTel-shaped event + soft-fail fan-out as scripts/emit-event.sh, reimplemented in TypeScript (the image ships no scripts/). Fans out to Axiom (always), Telegram (severity warning|error|critical), and Linear (severity error|critical OR action_required=true, with 24h dedup + managed labels). The 5 destination secrets are read at runtime from or-factory-master-control as the broker SA. Each destination fails independently; the call never errors. WRITE-ish: an error/critical/action_required event will create or comment a Linear issue and a warning+ event will send Telegram — use info for silent (Axiom-only) telemetry.",
    {
      name: z.string().describe("OTel event name, e.g. 'factory.agent.note' (dotted, lower-snake)."),
      severity: z.enum(['info', 'warning', 'error', 'critical']).describe('info → Axiom only; warning+ → also Telegram; error/critical → also Linear.'),
      layer: z.enum(['factory', 'system']).optional().default('factory').describe("Event layer (default 'factory')."),
      system: z.string().optional().describe('System this event is about (sets factory.system_name). Omit for control-plane/global events.'),
      workflow: z.string().optional().default('mcp:emit_event').describe("Source label (factory.workflow); also drives the Linear source-* label. Default 'mcp:emit_event'."),
      run_id: z.string().optional().describe('Correlation id (factory.run_id). Defaults to an ISO timestamp.'),
      action_required: z.boolean().optional().default(false).describe('When true, routes to Linear even for info/warning severity.'),
      body: z.record(z.string(), z.unknown()).optional().describe('Arbitrary structured detail (event.body). Default {}.'),
    },
    async ({ name, severity, layer, system, workflow, run_id, action_required, body }) => {
      const input: EmitEventInput = {
        name,
        severity,
        layer: layer ?? 'factory',
        system,
        workflow: workflow ?? 'mcp:emit_event',
        runId: run_id ?? new Date().toISOString(),
        actionRequired: action_required ?? false,
        body,
      };
      try {
        const result = await emitEvent(input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        // emitEvent is soft-fail and should not throw, but guard anyway.
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'emit_failed', detail: String(e).slice(0, 400) }, null, 2) }],
        };
      }
    },
  );

  // ─── Direct Verification tools (ADR 137 / PR 2b) ───────────────────────
  // Each verify_* tool resolves the system via resolveSystem (repo vars, no
  // manifest), calls the relevant provider's read-only API, and returns a
  // Kubernetes-style result.

  // GCP Systems folder (CLAUDE.md fixed values). The v1 Resource Manager API
  // returns the bare numeric id with parent.type='folder'.
  const SYSTEMS_FOLDER_ID = '123180924297';

  const systemNameSchema = {
    systemName: z.string().min(1).describe('The system name (e.g. or-test-N or svc-foo)'),
  };

  function registerVerifier(
    toolName: string,
    description: string,
    conditionType: string,
    planeName: string,
    runChecks: (m: SystemManifest) => Promise<Check[]>,
  ): void {
    server.tool(toolName, description, systemNameSchema, async ({ systemName }) => {
      const m = await resolveSystem(systemName);
      const checks = await runChecks(m);
      const result: VerifyResult = {
        system: systemName,
        timestamp: new Date().toISOString(),
        manifestSchemaVersion: m.manifestSchemaVersion,
        checks,
        conditions: [condition(conditionType, checks, planeName)],
        summary: summarize(checks),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    });
  }

  registerVerifier(
    'verify_github_system',
    'Verify the generated system\'s GitHub state: repo private, branch ruleset active, production env exists, scaffold files present.',
    'GithubReady',
    'GitHub',
    async (m) => {
      if (!m.githubRepo) {
        return [{ name: 'manifest-has-githubRepo', status: 'fail', evidence: 'missing githubRepo in manifest' }];
      }
      const [owner, name] = m.githubRepo.split('/');
      const [repoR, rulesetsR, envR, bootR] = await Promise.allSettled([
        apiGetRepo(owner, name, '') as Promise<{ private?: boolean }>,
        apiGetRepo(owner, name, '/rulesets') as Promise<Array<{ name: string; enforcement: string }>>,
        apiGetRepo(owner, name, '/environments/production'),
        apiGetRepo(owner, name, '/contents/.bootstrap-complete'),
      ]);
      const checks: Check[] = [];
      checks.push(
        repoR.status === 'fulfilled'
          ? { name: 'repo-private', status: repoR.value.private === true ? 'pass' : 'fail', evidence: `private=${repoR.value.private}` }
          : { name: 'repo-exists', status: 'fail', evidence: String(repoR.reason).slice(0, 200) },
      );
      if (rulesetsR.status === 'fulfilled') {
        const protectMain = rulesetsR.value.find((r) => r.name === 'protect-main');
        checks.push({
          name: 'ruleset-protect-main-active',
          status: protectMain && protectMain.enforcement === 'active' ? 'pass' : 'fail',
          evidence: protectMain ? `enforcement=${protectMain.enforcement}` : 'no protect-main ruleset',
        });
      } else {
        checks.push({ name: 'ruleset-protect-main-active', status: 'skip', evidence: String(rulesetsR.reason).slice(0, 150) });
      }
      checks.push({ name: 'production-env-exists', status: envR.status === 'fulfilled' ? 'pass' : 'fail', evidence: envR.status === 'rejected' ? '404' : undefined });
      checks.push({ name: 'bootstrap-complete-marker', status: bootR.status === 'fulfilled' ? 'pass' : 'fail', evidence: bootR.status === 'rejected' ? '404' : undefined });
      return checks;
    },
  );

  registerVerifier(
    'verify_gcp_system',
    'Verify the generated system\'s GCP state: project active, APIs enabled, SAs exist, no SA keys, WIF pool/provider ACTIVE, required secrets present + populated.',
    'GcpReady',
    'GCP',
    async (m) => {
      if (!m.gcpProjectId) {
        return [{ name: 'gcp-project-resolved', status: 'fail', evidence: 'could not resolve GCP_PROJECT_ID repo var' }];
      }
      const projectId = m.gcpProjectId;
      const checks: Check[] = [];
      // Independent calls: project, APIs, per-SA describe — all in parallel.
      const [projR, apisR, deployR, runtimeR] = await Promise.allSettled([
        gcpGetProject(projectId),
        gcpListEnabledServices(projectId),
        gcpGetServiceAccount(projectId, `deploy-sa@${projectId}.iam.gserviceaccount.com`),
        gcpGetServiceAccount(projectId, `runtime-sa@${projectId}.iam.gserviceaccount.com`),
      ]);
      if (projR.status === 'fulfilled') {
        const p = projR.value;
        checks.push({ name: 'project-active', status: p.lifecycleState === 'ACTIVE' ? 'pass' : 'fail', evidence: `lifecycleState=${p.lifecycleState}` });
        checks.push({
          name: 'project-under-correct-folder',
          status: p.parent?.type === 'folder' && p.parent?.id === SYSTEMS_FOLDER_ID ? 'pass' : 'fail',
          evidence: `parent=${p.parent?.type}:${p.parent?.id}`,
        });
      } else {
        checks.push({ name: 'project-active', status: 'fail', evidence: String(projR.reason).slice(0, 200) });
      }
      if (apisR.status === 'fulfilled') {
        for (const api of ['run.googleapis.com', 'secretmanager.googleapis.com', 'iam.googleapis.com', 'sts.googleapis.com', 'artifactregistry.googleapis.com']) {
          const ok = apisR.value.some((s) => s.endsWith(`/${api}`) || s === api);
          checks.push({ name: `api-${api.split('.')[0]}-enabled`, status: ok ? 'pass' : 'fail', evidence: ok ? undefined : 'not enabled' });
        }
      } else {
        checks.push({ name: 'apis-enabled', status: 'skip', evidence: String(apisR.reason).slice(0, 150) });
      }
      // SA existence + (only when SA exists) parallel key listing.
      const saKeyChecks = await Promise.all(
        ([['deploy-sa', deployR], ['runtime-sa', runtimeR]] as const).map(async ([label, saR]) => {
          if (saR.status === 'rejected') {
            return [{ name: `sa-${label}-exists`, status: 'skip' as const, evidence: String(saR.reason).slice(0, 150) }];
          }
          const exists = !!saR.value;
          const out: Check[] = [{ name: `sa-${label}-exists`, status: exists ? 'pass' : 'fail', evidence: exists ? undefined : '404' }];
          if (exists) {
            try {
              const keys = await gcpListSAKeys(projectId, `${label}@${projectId}.iam.gserviceaccount.com`);
              out.push({
                name: `sa-${label}-no-user-managed-keys`,
                status: keys.length === 0 ? 'pass' : 'fail',
                evidence: keys.length === 0 ? undefined : `${keys.length} user-managed key(s)`,
              });
            } catch (e) {
              out.push({ name: `sa-${label}-no-user-managed-keys`, status: 'skip', evidence: String(e).slice(0, 150) });
            }
          }
          return out;
        }),
      );
      checks.push(...saKeyChecks.flat());
      return checks;
    },
  );

  registerVerifier(
    'verify_railway_system',
    'Verify the system\'s Railway project (resolved live by project name): project + environment exist, postgres/n8n services present, latest deployment SUCCESS.',
    'RailwayReady',
    'Railway',
    async (m) => {
      // Manifest-free: the Railway project is named after the system. Resolve it
      // live by name, then match the default ('production') environment and the
      // postgres/n8n services by name.
      let projSummary;
      try {
        projSummary = (await railwayListProjects()).find((p) => p.name === m.systemName);
      } catch (e) {
        return [{ name: 'project-exists', status: 'fail', evidence: String(e).slice(0, 200) }];
      }
      if (!projSummary) {
        return [{ name: 'project-exists', status: 'fail', evidence: `no Railway project named ${m.systemName}` }];
      }
      const projectId = projSummary.id;
      const checks: Check[] = [];
      const proj = await railwayGetProject(projectId);
      checks.push({ name: 'project-exists', status: proj ? 'pass' : 'fail', evidence: proj ? `name=${proj.name} id=${projectId}` : 'project-not-found' });
      if (!proj) return checks;
      const env =
        proj.environments.edges.find((e) => e.node.name === 'production') ??
        proj.environments.edges[0];
      checks.push({ name: 'environment-exists', status: env ? 'pass' : 'fail', evidence: env ? `name=${env.node.name}` : 'no environments' });
      if (!env) return checks;
      // Match the deploy template's service names. The factory's own mcp service
      // isn't part of an n8n system deploy, so only postgres + n8n are checked.
      const serviceResults = await Promise.all(
        (['postgres', 'n8n'] as const).map(async (label): Promise<Check[]> => {
          const found = proj.services.edges.find((s) => s.node.name === label);
          const out: Check[] = [
            { name: `service-${label}-exists`, status: found ? 'pass' : 'fail', evidence: found ? `id=${found.node.id}` : 'not found in project' },
          ];
          if (found) {
            try {
              const dep = await railwayGetDeployment(projectId, env.node.id, found.node.id);
              out.push({
                name: `service-${label}-latest-deploy-success`,
                status: dep?.status === 'SUCCESS' ? 'pass' : 'fail',
                evidence: dep ? `status=${dep.status}` : 'no deployments',
              });
            } catch (e) {
              out.push({ name: `service-${label}-latest-deploy-success`, status: 'skip', evidence: String(e).slice(0, 150) });
            }
          }
          return out;
        }),
      );
      checks.push(...serviceResults.flat());
      return checks;
    },
  );

  registerVerifier(
    'verify_cloudflare_system',
    'Verify the generated system\'s Cloudflare DNS records exist and are routable.',
    'CloudflareReady',
    'Cloudflare',
    async (m) => {
      const records = m.externalResources?.cloudflare?.records ?? [];
      const zoneId = m.externalResources?.cloudflare?.zoneId ?? process.env.CLOUDFLARE_ZONE_ID;
      if (records.length === 0 || !zoneId) {
        return [{
          name: 'cloudflare-records-resolvable',
          status: 'skip',
          evidence: 'Cloudflare records are not derivable from repo vars — verify DNS directly with list_dns_records / dns_resolve, or probe_endpoint / tls_cert_inspect on n8n-<system>.or-infra.com',
        }];
      }
      const { token, tokenId } = await cfCreateScopedReadToken(zoneId);
      // Brief settle for CF scoped-token edge propagation (~1-2s eventual
      // consistency window across POPs). cfGetDnsRecord also retries on 401
      // internally; this reduces the average-case retry count by giving the
      // token a head start across the global edge.
      await new Promise((r) => setTimeout(r, 1000));
      try {
        return await Promise.all(
          records.map(async (rec): Promise<Check> => {
            if (!rec.recordId) return { name: `record-${rec.name}-has-id`, status: 'skip', evidence: 'manifest record has no recordId' };
            try {
              const r = await cfGetDnsRecord(zoneId, rec.recordId, token);
              return {
                name: `record-${rec.name}-exists`,
                status: r && r.type === rec.type ? 'pass' : 'fail',
                evidence: r ? `type=${r.type} content=${r.content}` : '404',
              };
            } catch (e) {
              return { name: `record-${rec.name}-exists`, status: 'fail', evidence: String(e).slice(0, 200) };
            }
          }),
        );
      } finally {
        await cfRevokeScopedToken(tokenId);
      }
    },
  );

  // ─── PR B: Empirical observability tools (ADR 161) ──────────────────────
  // Six read-only tools that close the gaps verify_* couldn't reach:
  // probe_endpoint (HTTP), verify_mcp_server (MCP /health),
  // inspect_cloud_run (Cloud Run /v2), inspect_railway_service (Railway
  // domain + env-var names), list_system_secrets (SM inventory),
  // inspect_wif_provider (CEL condition).

  server.tool(
    'probe_endpoint',
    'HTTPS request to a factory-owned URL (or-infra.com / up.railway.app / run.app). Defaults to GET; pass method=POST + body to fire a webhook end-to-end (e.g. the Agent Router at /webhook/agent-router) and read the reply. Returns status, content-type, body (truncated 4 KB), and optional expect_status / expect_body_contains checks. Default 10 s timeout (raise timeout_ms up to 60000 for LLM-backed webhooks). Host allowlist always enforced.',
    {
      url: z.string().describe('https URL; host must end with an allowlisted suffix'),
      method: z.enum(['GET', 'POST']).optional().describe('HTTP method (default GET). POST to fire a webhook.'),
      body: z.string().optional().describe('Request body for POST, e.g. the JSON string {"text":"מה מצב השרתים?"}'),
      content_type: z.string().optional().describe('Content-Type for the body (default application/json)'),
      timeout_ms: z.number().int().optional().describe('Timeout in ms (default 10000, max 60000). Raise for LLM-backed webhooks like the Agent Router.'),
      expect_status: z.number().int().optional().describe('Optional: assert HTTP status equals this'),
      expect_body_contains: z.string().optional().describe('Optional: assert response body includes this substring'),
    },
    async ({ url, method, body, content_type, timeout_ms, expect_status, expect_body_contains }) => {
      try {
        const result: ProbeResult = await probe(url, expect_status, expect_body_contains, {
          method,
          body,
          contentType: content_type,
          timeoutMs: timeout_ms,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const err = e instanceof AllowlistError ? { error: 'allowlist_rejected', message: e.message } : { error: 'probe_failed', message: String(e).slice(0, 300) };
        return { content: [{ type: 'text' as const, text: JSON.stringify(err, null, 2) }] };
      }
    },
  );

  server.tool(
    'list_system_secrets',
    'List every GCP Secret Manager secret in the system\'s project, with name + createTime + enabled-version-count + labels. Values are never returned. Useful for catching orphaned secrets like mcp-server-railway-url that were created without a matching deploy.',
    systemNameSchema,
    async ({ systemName }) => {
      const m = await resolveSystem(systemName);
      if (!m.gcpProjectId) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_gcp_project', message: 'could not resolve GCP project from repo var GCP_PROJECT_ID' }, null, 2) }] };
      }
      const secrets = await gcpListSecretsWithMetadata(m.gcpProjectId);
      const result = {
        system: systemName,
        gcpProjectId: m.gcpProjectId,
        manifestSchemaVersion: m.manifestSchemaVersion,
        timestamp: new Date().toISOString(),
        secretCount: secrets.length,
        secrets,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_n8n_workflows',
    'List a system\'s n8n workflows via the n8n Public API (/api/v1/workflows): each workflow\'s id, name, ACTIVE flag, and trigger node types. The authoritative view of which workflows exist and which are active — webhook/schedule-triggered workflows are active; sub-workflows (Execute Workflow Trigger only) are correctly inactive. Needs n8n-api-key in the system SM (minted by deploy-railway-cloudflare.yml).',
    systemNameSchema,
    async ({ systemName }) => {
      try {
        const raw = await n8nApiGet(systemName, '/workflows?limit=200');
        const obj = raw as { data?: unknown };
        const items: unknown[] = Array.isArray(obj.data)
          ? (obj.data as unknown[])
          : (Array.isArray(raw) ? (raw as unknown[]) : []);
        const workflows = items.map((it) => {
          const w = it as { id?: unknown; name?: unknown; active?: unknown; nodes?: unknown };
          const nodes: Array<{ type?: unknown }> = Array.isArray(w.nodes) ? (w.nodes as Array<{ type?: unknown }>) : [];
          const triggerTypes = nodes
            .map((n) => (typeof n.type === 'string' ? n.type : ''))
            .filter((t) => /trigger|webhook/i.test(t));
          return { id: w.id ?? null, name: w.name ?? null, active: w.active === true, triggerTypes };
        });
        const result = {
          system: systemName,
          timestamp: new Date().toISOString(),
          count: workflows.length,
          activeCount: workflows.filter((w) => w.active).length,
          workflows,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const err = e instanceof N8nKeyMissingError
          ? { error: 'n8n_key_missing', message: e.message }
          : { error: 'n8n_api_failed', message: String(e).slice(0, 400) };
        return { content: [{ type: 'text' as const, text: JSON.stringify(err, null, 2) }] };
      }
    },
  );

  server.tool(
    'inspect_n8n_execution',
    'Inspect n8n executions on a system via the Public API. With no executionId, lists recent executions (optionally filtered by status/workflowId) and fetches detail for the most recent match; with executionId, fetches that one. Returns status and, on failure, the failing node + error message (parsed from data.resultData.lastNodeExecuted / .error). Replaces log-scraping for diagnosing router/sub-agent failures. Needs n8n-api-key in the system SM.',
    {
      systemName: z.string().min(1).describe('The system name (e.g. factory-test-52a)'),
      executionId: z.string().optional().describe('Specific execution id; if omitted, the most recent matching execution is used'),
      status: z.enum(['success', 'error', 'waiting', 'running', 'canceled']).optional().describe('Filter the list by status (use "error" to find the latest failure)'),
      workflowId: z.string().optional().describe('Filter the list by workflow id'),
    },
    async ({ systemName, executionId, status, workflowId }) => {
      try {
        let id = executionId;
        if (!id) {
          const params = new URLSearchParams({ limit: '1' });
          if (status) params.set('status', status);
          if (workflowId) params.set('workflowId', workflowId);
          const listRaw = await n8nApiGet(systemName, `/executions?${params.toString()}`);
          const list = listRaw as { data?: Array<{ id?: unknown }> };
          const first = Array.isArray(list.data) ? list.data[0] : undefined;
          id = first && first.id != null ? String(first.id) : undefined;
          if (!id) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ system: systemName, message: 'no matching execution found', filter: { status: status ?? null, workflowId: workflowId ?? null } }, null, 2) }] };
          }
        }
        const detailRaw = await n8nApiGet(systemName, `/executions/${encodeURIComponent(id)}?includeData=true`);
        const d = detailRaw as {
          id?: unknown; status?: unknown; finished?: unknown; startedAt?: unknown; stoppedAt?: unknown; workflowId?: unknown;
          data?: { resultData?: { lastNodeExecuted?: unknown; error?: { message?: unknown; name?: unknown } } };
        };
        const rd = d.data?.resultData;
        const result = {
          system: systemName,
          id: d.id ?? id,
          status: d.status ?? null,
          finished: d.finished ?? null,
          startedAt: d.startedAt ?? null,
          stoppedAt: d.stoppedAt ?? null,
          workflowId: d.workflowId ?? null,
          failingNode: rd?.lastNodeExecuted ?? null,
          errorName: rd?.error?.name ?? null,
          errorMessage: rd?.error?.message ?? null,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const err = e instanceof N8nKeyMissingError
          ? { error: 'n8n_key_missing', message: e.message }
          : { error: 'n8n_api_failed', message: String(e).slice(0, 400) };
        return { content: [{ type: 'text' as const, text: JSON.stringify(err, null, 2) }] };
      }
    },
  );

  registerVerifier(
    'verify_mcp_server',
    'Verify the system\'s MCP server is actually live: resolve URL from manifest or system SM, probe /health=200 and /.well-known/oauth-authorization-server=200.',
    'McpReady',
    'MCP',
    async (m) => {
      const checks: Check[] = [];
      // URL resolution priority: manifest.externalResources.mcp.endpointUrl
      // → SM mcp-server-railway-url → SM mcp-server-cloud-run-url.
      let baseUrl = m.externalResources?.mcp?.endpointUrl?.replace(/\/mcp\/?$/, '');
      if (!baseUrl && m.gcpProjectId) {
        // The SM access path is via existing helpers; we don't import secret-version-access here.
        // Probe via the manifest URL only — if missing, surface as fail.
        // Listing system secrets via list_system_secrets is the diagnostic for "why no URL".
      }
      if (!baseUrl) {
        checks.push({
          name: 'mcp-url-in-manifest',
          status: 'fail',
          evidence: 'no externalResources.mcp.endpointUrl in manifest — MCP service likely never deployed (run list_system_secrets to check mcp-server-railway-url presence)',
        });
        return checks;
      }
      checks.push({ name: 'mcp-url-in-manifest', status: 'pass', evidence: baseUrl });

      if (!isAllowedUrl(`${baseUrl}/health`)) {
        checks.push({
          name: 'mcp-url-in-allowlist',
          status: 'fail',
          evidence: `URL host not in probe allowlist (only or-infra.com / up.railway.app / run.app probable)`,
        });
        return checks;
      }

      const [health, oauthMeta] = await Promise.allSettled([
        probe(`${baseUrl}/health`, 200),
        probe(`${baseUrl}/.well-known/oauth-authorization-server`, 200),
      ]);
      checks.push(
        health.status === 'fulfilled'
          ? { name: 'mcp-health-200', status: health.value.checks.statusMatched ? 'pass' : 'fail', evidence: `HTTP ${health.value.status} in ${health.value.durationMs}ms` }
          : { name: 'mcp-health-200', status: 'fail', evidence: String(health.reason).slice(0, 200) },
      );
      checks.push(
        oauthMeta.status === 'fulfilled'
          ? { name: 'mcp-oauth-metadata-200', status: oauthMeta.value.checks.statusMatched ? 'pass' : 'fail', evidence: `HTTP ${oauthMeta.value.status} in ${oauthMeta.value.durationMs}ms` }
          : { name: 'mcp-oauth-metadata-200', status: 'fail', evidence: String(oauthMeta.reason).slice(0, 200) },
      );
      return checks;
    },
  );

  server.tool(
    'inspect_cloud_run',
    'Inspect a Cloud Run /v2 service: latest revision, image SHA, env-var names (values never returned), traffic split, conditions. Defaults to factory-actions-mcp on factory-control-9piybr (self-introspection).',
    {
      serviceName: z.string().describe('Cloud Run service name (e.g. factory-actions-mcp)'),
      project: z.string().optional().default('factory-control-9piybr').describe('GCP project ID (default: factory-control-9piybr)'),
      region: z.string().optional().default('me-west1').describe('Cloud Run region (default: me-west1)'),
    },
    async ({ serviceName, project, region }) => {
      try {
        const svc = await gcpGetCloudRunService(project, region, serviceName);
        const container = svc.template?.containers?.[0];
        const envNames = (container?.env ?? []).map((e) => e.name);
        const result = {
          serviceName,
          project,
          region,
          timestamp: new Date().toISOString(),
          latestReadyRevision: svc.latestReadyRevision,
          latestCreatedRevision: svc.latestCreatedRevision,
          uri: svc.uri,
          image: container?.image,
          envVarNames: envNames,
          envVarCount: envNames.length,
          traffic: svc.traffic,
          conditions: svc.conditions,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        if (e instanceof NotFoundError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', message: `Cloud Run service ${serviceName} not found in ${project}/${region}` }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'inspect_railway_service',
    'Inspect a Railway service in the system\'s project: latest deployment status and public domains (Railway-assigned + custom). Resolves the project live by name (== systemName) and the \'production\' environment.',
    {
      systemName: z.string().min(1).describe('The system name (e.g. or-test-N)'),
      serviceName: z.string().describe('Railway service name within the project (e.g. postgres, n8n, mcp-server)'),
    },
    async ({ systemName, serviceName }) => {
      const projSummary = (await railwayListProjects()).find((p) => p.name === systemName);
      if (!projSummary) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_project_not_found', message: `no Railway project named ${systemName}` }, null, 2) }] };
      }
      const proj = await railwayGetProject(projSummary.id);
      if (!proj) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_project_not_found', projectId: projSummary.id }, null, 2) }] };
      }
      const env =
        proj.environments.edges.find((e) => e.node.name === 'production') ??
        proj.environments.edges[0];
      if (!env) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_no_environment', projectId: projSummary.id }, null, 2) }] };
      }
      const svc = proj.services.edges.find((s) => s.node.name === serviceName);
      if (!svc) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_service_not_found', serviceName, projectId: projSummary.id, knownServices: proj.services.edges.map((s) => s.node.name) }, null, 2) }] };
      }
      const detail = await railwayGetServiceInstance(projSummary.id, env.node.id, svc.node.id);
      const result = {
        system: systemName,
        serviceName,
        timestamp: new Date().toISOString(),
        railwayProjectId: projSummary.id,
        railwayEnvironmentId: env.node.id,
        serviceId: svc.node.id,
        ...(detail ?? {}),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_railway_projects',
    'List ALL Railway projects accessible to the factory Railway API token, across every workspace (personal + team) the token belongs to. Returns id, name, createdAt, updatedAt, workspaceId, workspaceName for each. Read-only. Use to discover projects not yet registered in any factory manifest, for audit, or for troubleshooting. The token stays mounted on Cloud Run — never returned to the caller.',
    {},
    async () => {
      const projects = await railwayListProjects();
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        timestamp: new Date().toISOString(),
        count: projects.length,
        projects,
      }, null, 2) }] };
    },
  );

  server.tool(
    'get_railway_project',
    'Get a Railway project by ID directly (no manifest required). Returns id, name, environments[{id,name}], services[{id,name}]. Read-only. Use to inspect projects that are not registered in factory manifests.',
    { projectId: z.string().min(1).describe('Railway project ID (UUID)') },
    async ({ projectId }) => {
      const proj = await railwayGetProject(projectId);
      if (!proj) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_project_not_found', projectId }, null, 2) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        timestamp: new Date().toISOString(),
        project: {
          id: proj.id,
          name: proj.name,
          environments: proj.environments.edges.map((e) => e.node),
          services: proj.services.edges.map((e) => e.node),
        },
      }, null, 2) }] };
    },
  );

  server.tool(
    'inspect_railway_service_direct',
    'Inspect a Railway service by direct IDs (no manifest required): latest deployment status and public domains. Read-only. Use for projects not registered in factory manifests, or for ad-hoc inspection. For factory-managed systems prefer inspect_railway_service (which resolves IDs from the manifest).',
    {
      projectId: z.string().min(1).describe('Railway project ID'),
      environmentId: z.string().min(1).describe('Railway environment ID'),
      serviceName: z.string().min(1).describe('Service name within the project'),
    },
    async ({ projectId, environmentId, serviceName }) => {
      const proj = await railwayGetProject(projectId);
      if (!proj) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_project_not_found', projectId }, null, 2) }] };
      }
      const svc = proj.services.edges.find((s) => s.node.name === serviceName);
      if (!svc) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_service_not_found', serviceName, projectId, knownServices: proj.services.edges.map((s) => s.node.name) }, null, 2) }] };
      }
      const detail = await railwayGetServiceInstance(projectId, environmentId, svc.node.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        timestamp: new Date().toISOString(),
        projectId,
        environmentId,
        serviceId: svc.node.id,
        serviceName,
        ...(detail ?? {}),
      }, null, 2) }] };
    },
  );

  server.tool(
    'inspect_wif_provider',
    'Read the WIF provider\'s CEL attribute condition + mapping for a system. Pre-existing systems (created before ADR 161) return permission_denied — that is the documented expected behavior, not a defect.',
    {
      systemName: z.string().min(1).describe('The system name (e.g. or-test-N)'),
      poolId: z.string().optional().default('github-pool').describe('WIF pool ID (default: github-pool)'),
      providerId: z.string().optional().default('github-provider').describe('WIF provider ID (default: github-provider)'),
    },
    async ({ systemName, poolId, providerId }) => {
      const m = await resolveSystem(systemName);
      if (!m.gcpProjectId) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_gcp_project', message: 'could not resolve GCP project from repo var GCP_PROJECT_ID' }, null, 2) }] };
      }
      const projectNumber = await gcpGetProjectNumber(m.gcpProjectId);
      try {
        const provider = await gcpGetWifProviderDetails(projectNumber, poolId, providerId);
        const cel = provider.attributeCondition ?? '';
        const workflowRefs = Array.from(cel.matchAll(/assertion\.workflow_ref\s*==\s*'([^']+)'/g)).map((mm) => mm[1]);
        const result = {
          system: systemName,
          gcpProjectId: m.gcpProjectId,
          projectNumber,
          poolId,
          providerId,
          timestamp: new Date().toISOString(),
          state: provider.state,
          disabled: provider.disabled ?? false,
          oidcIssuerUri: provider.oidc?.issuerUri,
          attributeMapping: provider.attributeMapping,
          attributeCondition: cel,
          parsedWorkflowRefs: workflowRefs,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'systems created before ADR 161 lack roles/iam.workloadIdentityPoolViewer on their project; backfill manually if needed', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', poolId, providerId, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'tail_railway_deployment_logs',
    'Tail recent Railway deployment logs (stdout/stderr from the deployment process). Resolves the latest deployment for the (project, environment, service) tuple and returns up to `lines` log entries with timestamp, severity, and message. Read-only — no scope change over existing Railway tools.',
    {
      projectId: z.string().describe('Railway project ID (UUID)'),
      environmentId: z.string().describe('Railway environment ID'),
      serviceId: z.string().describe('Railway service ID (use list_railway_projects + get_railway_project to discover)'),
      lines: z.number().int().min(1).max(500).optional().default(100).describe('Max log entries to return (capped at 500)'),
      grep: z.string().optional().describe('Case-insensitive regex; return only entries whose serialized form matches'),
    },
    async ({ projectId, environmentId, serviceId, lines, grep }) => {
      const limit = lines ?? 100;
      const dep = await railwayGetDeployment(projectId, environmentId, serviceId);
      if (!dep) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_deployment', projectId, environmentId, serviceId }, null, 2) }] };
      }
      const logs = grepEntries(await railwayGetDeploymentLogs(dep.id, limit), grep);
      // 5 MB ceiling — bounds a pathological response without hiding content.
      let totalBytes = 0;
      const truncated: typeof logs = [];
      for (const log of logs) {
        const lineBytes = Buffer.byteLength(JSON.stringify(log), 'utf8');
        if (totalBytes + lineBytes > MAX_LOG_BYTES) break;
        truncated.push(log);
        totalBytes += lineBytes;
      }
      const result = {
        projectId,
        environmentId,
        serviceId,
        deploymentId: dep.id,
        deploymentStatus: dep.status,
        timestamp: new Date().toISOString(),
        requestedLines: limit,
        grep: grep ?? null,
        returnedLines: truncated.length,
        truncatedFromOriginalLines: logs.length - truncated.length,
        logs: truncated,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_railway_build_logs',
    'Fetch Railway build-phase logs (nixpacks/Dockerfile build output) for a specific deployment ID. Distinct from tail_railway_deployment_logs (which returns runtime stdout/stderr). Caller must resolve the deploymentId first via list_railway_projects / get_railway_project + the inspect_railway_service tool, or directly from a Railway dashboard URL. Read-only.',
    {
      deploymentId: z.string().min(1).describe('Railway deployment ID (UUID)'),
      lines: z.number().int().min(1).max(500).optional().default(100).describe('Max log entries to return (capped at 500)'),
      grep: z.string().optional().describe('Case-insensitive regex; return only entries whose serialized form matches'),
    },
    async ({ deploymentId, lines, grep }) => {
      const limit = lines ?? 100;
      const logs = grepEntries(await railwayGetBuildLogs(deploymentId, limit), grep);
      let totalBytes = 0;
      const truncated: typeof logs = [];
      for (const log of logs) {
        const lineBytes = Buffer.byteLength(JSON.stringify(log), 'utf8');
        if (totalBytes + lineBytes > MAX_LOG_BYTES) break;
        truncated.push(log);
        totalBytes += lineBytes;
      }
      const result = {
        deploymentId,
        timestamp: new Date().toISOString(),
        requestedLines: limit,
        grep: grep ?? null,
        returnedLines: truncated.length,
        truncatedFromOriginalLines: logs.length - truncated.length,
        logs: truncated,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ---------- Expanded Railway read visibility ----------
  // These tools close the gaps that left factory-test-19/20 diagnosis
  // dependent on the operator's Railway dashboard. Existing inspect_railway_*
  // tools now return customDomains automatically (railway-client.ts change);
  // the new tools below cover env-var names, volumes, deployment history,
  // and a raw read-only GraphQL passthrough.

  server.tool(
    'list_railway_service_variables',
    'List env-var NAMES on a Railway service instance, with values redacted by default. Pass reveal=true ONLY when actively debugging (values may contain secrets). Read-only.',
    {
      projectId: z.string().min(1).describe('Railway project ID (UUID)'),
      environmentId: z.string().min(1).describe('Railway environment ID'),
      serviceId: z.string().min(1).describe('Railway service ID'),
      reveal: z.boolean().optional().default(false).describe('Return actual values instead of "***" (default: false)'),
    },
    async ({ projectId, environmentId, serviceId, reveal }) => {
      const vars = await railwayListServiceVariables(projectId, environmentId, serviceId, reveal ?? false);
      const result = {
        projectId,
        environmentId,
        serviceId,
        timestamp: new Date().toISOString(),
        valuesRevealed: reveal ?? false,
        variableCount: vars.length,
        variables: vars,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_railway_service_volumes',
    'List volumes in a Railway project, including mountPath and sizeMB for each volume\'s first attached instance. Useful for confirming Postgres data volumes are attached at the expected path. Read-only.',
    {
      projectId: z.string().min(1).describe('Railway project ID (UUID)'),
    },
    async ({ projectId }) => {
      const volumes = await railwayListVolumes(projectId);
      const result = {
        projectId,
        timestamp: new Date().toISOString(),
        volumeCount: volumes.length,
        volumes,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_railway_deployments',
    'List the recent N deployments for a Railway service (history, not just latest). Each entry returns id, status, createdAt. Read-only.',
    {
      projectId: z.string().min(1).describe('Railway project ID (UUID)'),
      environmentId: z.string().min(1).describe('Railway environment ID'),
      serviceId: z.string().min(1).describe('Railway service ID'),
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Max deployments to return (capped at 50)'),
    },
    async ({ projectId, environmentId, serviceId, limit }) => {
      const deployments = await railwayListDeployments(projectId, environmentId, serviceId, limit ?? 10);
      const result = {
        projectId,
        environmentId,
        serviceId,
        timestamp: new Date().toISOString(),
        deploymentCount: deployments.length,
        deployments,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'railway_graphql_read',
    'Read-only passthrough to Railway\'s GraphQL endpoint. Pass any `query { ... }` document (and optional `variables`) — the response is forwarded verbatim. Mutations are rejected (the tool refuses any document containing a `mutation` operation outside string literals). Use this when no other inspect_railway_* tool covers the field you need; for routine inspection prefer the typed tools (inspect_railway_service_direct, list_railway_service_variables, etc.) so responses have stable shape.',
    {
      query: z.string().min(1).describe('GraphQL document. Must be a `query` operation; mutations are rejected.'),
      variables: z.record(z.string(), z.unknown()).optional().describe('Optional GraphQL variables (JSON object)'),
    },
    async ({ query, variables }) => {
      try {
        const data = await railwayRawGraphqlRead(query, variables ?? {});
        return { content: [{ type: 'text' as const, text: JSON.stringify({ timestamp: new Date().toISOString(), data }, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ timestamp: new Date().toISOString(), error: 'railway_graphql_read_failed', detail: msg.slice(0, 1000) }, null, 2) }] };
      }
    },
  );

  server.tool(
    'list_secret_metadata',
    'List GCP Secret Manager secrets in a project with extended metadata: createTime, enabledVersionCount, labels, expireTime, rotation policy, ttl, etag, topic count. Values are never returned. Direct project ID (no manifest); defaults to factory-control-9piybr. Useful for the secret-inventory-audit skill.',
    {
      project: z.string().optional().default('factory-control-9piybr').describe('GCP project ID (default: factory-control-9piybr)'),
    },
    async ({ project }) => {
      const secrets = await gcpListSecretsExtendedMetadata(project);
      const result = {
        project,
        timestamp: new Date().toISOString(),
        secretCount: secrets.length,
        secrets,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dns_resolve',
    'Resolve DNS records for a hostname using Node stdlib resolvers (no external auth). Hostname must end with one of the factory allowlist suffixes: .or-infra.com / .up.railway.app / .run.app. Supported types: A, AAAA, CNAME, TXT, MX, NS, SOA.',
    {
      hostname: z.string().min(1).describe('Hostname to resolve (must be in factory allowlist)'),
      type: z.enum(SUPPORTED_DNS_TYPES).optional().default('A').describe('DNS record type (default: A)'),
    },
    async ({ hostname, type }) => {
      try {
        const result = await dnsResolveRecord(hostname, type);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...result, timestamp: new Date().toISOString() }, null, 2) }] };
      } catch (e) {
        if (e instanceof DnsAllowlistError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'allowlist_violation', hostname, detail: e.message }, null, 2) }] };
        }
        const msg = String(e);
        if (/ENOTFOUND|ENODATA|NXDOMAIN/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', hostname, type, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'tls_cert_inspect',
    'Inspect the TLS certificate presented by a host:port without sending any application data. Returns subject, subjectAltName, issuer, validFrom/validTo, serialNumber, fingerprint256, and authorization status. Host must be in the factory allowlist (.or-infra.com / .up.railway.app / .run.app). 5s timeout. Read-only.',
    {
      host: z.string().min(1).describe('Hostname (must be in factory allowlist)'),
      port: z.number().int().min(1).max(65535).optional().default(443).describe('TCP port (default: 443)'),
    },
    async ({ host, port }) => {
      try {
        const info = await tlsInspectCert(host, port);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...info, timestamp: new Date().toISOString() }, null, 2) }] };
      } catch (e) {
        if (e instanceof TlsAllowlistError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'allowlist_violation', host, detail: e.message }, null, 2) }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'tls_connect_failed', host, port, detail: String(e).slice(0, 300) }, null, 2) }] };
      }
    },
  );

  server.tool(
    'tail_cloud_run_logs',
    'Tail recent Cloud Run logs for a service via Cloud Logging entries:list. Filters on resource.type="cloud_run_revision" + service_name. Returns entries in chronological order with timestamp, severity, textPayload, jsonPayload, resource labels, insertId. 5 MB byte ceiling; use grep to narrow. Read-only — requires roles/logging.viewer on the project (per-system roles/viewer covers it).',
    {
      serviceName: z.string().min(1).describe('Cloud Run service name (e.g. factory-master-actions-mcp)'),
      project: z.string().optional().default('or-factory-master-control').describe('GCP project ID (default: or-factory-master-control)'),
      lines: z.number().int().min(1).max(500).optional().default(100).describe('Max log entries to return (capped at 500)'),
      grep: z.string().optional().describe('Case-insensitive regex; return only entries whose serialized form matches'),
    },
    async ({ serviceName, project, lines, grep }) => {
      const limit = lines ?? 100;
      try {
        const entries = grepEntries(await gcpTailCloudRunLogs(project, serviceName, limit), grep);
        let totalBytes = 0;
        const truncated: typeof entries = [];
        for (const entry of entries) {
          const lineBytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
          if (totalBytes + lineBytes > MAX_LOG_BYTES) break;
          truncated.push(entry);
          totalBytes += lineBytes;
        }
        const result = {
          project,
          serviceName,
          timestamp: new Date().toISOString(),
          requestedLines: limit,
          grep: grep ?? null,
          returnedLines: truncated.length,
          truncatedFromOriginalLines: entries.length - truncated.length,
          entries: truncated,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'runtime SA needs roles/logging.viewer on the project; per-system projects have roles/viewer which includes it', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', project, serviceName, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_gcp_projects',
    'List ACTIVE GCP projects the runtime SA has resourcemanager.projects.get on. No org-level grant required — returns projects the SA was granted roles/viewer on (per-system grants via broker.sh Step 7b). Read-only. Use to discover factory-managed systems not yet registered in a manifest, or for audit.',
    {},
    async () => {
      const projects = await gcpListAllProjects();
      const result = {
        timestamp: new Date().toISOString(),
        projectCount: projects.length,
        projects,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_iam_bindings',
    'List the IAM bindings on a GCP project (role + members). Calls projects:getIamPolicy. Requires resourcemanager.projects.getIamPolicy (included in roles/viewer). Read-only.',
    {
      project: z.string().min(1).describe('GCP project ID'),
    },
    async ({ project }) => {
      try {
        const bindings = await gcpGetProjectIamPolicy(project);
        const result = {
          project,
          timestamp: new Date().toISOString(),
          bindingCount: bindings.length,
          bindings,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'runtime SA needs roles/viewer (or roles/iam.securityReviewer) on the project', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', project, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_workload_identity_pools',
    'List Workload Identity Federation pools (and the providers within each) in a GCP project. Requires iam.workloadIdentityPools.list — granted by roles/iam.workloadIdentityPoolViewer (ADR 161, per-system). Legacy systems pre-ADR-161 return permission_denied (expected). Read-only.',
    {
      project: z.string().min(1).describe('GCP project ID'),
    },
    async ({ project }) => {
      try {
        const projectNumber = await gcpGetProjectNumber(project);
        const pools = await gcpListWifPools(projectNumber);
        const poolsWithProviders = await Promise.all(
          pools.map(async (pool) => {
            try {
              const providers = await gcpListWifProviders(projectNumber, pool.poolId);
              return { ...pool, providers };
            } catch (innerE) {
              return { ...pool, providersError: String(innerE).slice(0, 200), providers: [] };
            }
          }),
        );
        const result = {
          project,
          projectNumber,
          timestamp: new Date().toISOString(),
          poolCount: pools.length,
          pools: poolsWithProviders,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'systems created before ADR 161 lack roles/iam.workloadIdentityPoolViewer on their project; backfill manually if needed', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', project, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_artifact_registry_images',
    'List docker images in an Artifact Registry repository. Two-step: first lists repos in (project, region), then fetches images from the specified repo. If `repository` is omitted, returns just the repo list. Read-only.',
    {
      project: z.string().min(1).describe('GCP project ID'),
      region: z.string().optional().default('me-west1').describe('AR region (default: me-west1)'),
      repository: z.string().optional().describe('Repository name (omit to list repos only)'),
      limit: z.number().int().min(1).max(200).optional().default(50).describe('Max images to return (when repository is given)'),
    },
    async ({ project, region, repository, limit }) => {
      try {
        const repos = await gcpListArRepos(project, region);
        if (!repository) {
          const result = {
            project,
            region,
            timestamp: new Date().toISOString(),
            repositoryCount: repos.length,
            repositories: repos,
          };
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }
        const repoShort = repository.split('/').pop() ?? repository;
        const images = await gcpListArImages(project, region, repoShort, limit ?? 50);
        const result = {
          project,
          region,
          repository: repoShort,
          timestamp: new Date().toISOString(),
          imageCount: images.length,
          images,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'runtime SA needs roles/artifactregistry.reader (or roles/viewer) on the project', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', project, region, repository, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_cloud_build_history',
    'List recent Cloud Build runs in a project (id, status, createTime, startTime, finishTime, logUrl, sourceRepoUrl, tags). Requires cloudbuild.builds.list (included in roles/viewer and roles/cloudbuild.builds.viewer). Read-only.',
    {
      project: z.string().min(1).describe('GCP project ID'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Max builds to return (default: 20)'),
    },
    async ({ project, limit }) => {
      try {
        const builds = await gcpListCloudBuilds(project, limit ?? 20);
        const result = {
          project,
          timestamp: new Date().toISOString(),
          buildCount: builds.length,
          builds,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const msg = String(e);
        if (/403|PERMISSION_DENIED/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'permission_denied', expected: 'runtime SA needs roles/cloudbuild.builds.viewer (or roles/viewer) on the project', detail: msg.slice(0, 300) }, null, 2) }] };
        }
        if (e instanceof NotFoundError || /404|NOT_FOUND/i.test(msg)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', project, detail: msg.slice(0, 300) }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_cloudflare_zones',
    'List all Cloudflare zones the account-level read token can see. Uses the long-lived `cloudflare-zones-read-token` (Zone:Read + DNS:Read) — separate from the existing `cloudflare-token-creator` to avoid disturbing the mint/revoke flow used by verify_cloudflare_system. Read-only.',
    {},
    async () => {
      try {
        const zones = await cfListZones();
        const result = {
          timestamp: new Date().toISOString(),
          zoneCount: zones.length,
          zones,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        if (e instanceof CfZonesTokenError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'token_not_configured', detail: e.message }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_dns_records',
    'List all DNS records in a Cloudflare zone. Accepts zone ID (32-char hex) OR zone name (e.g. or-infra.com); name-to-ID is resolved via list_cloudflare_zones. Uses the cloudflare-zones-read-token. Read-only.',
    {
      zoneIdOrName: z.string().min(1).describe('Cloudflare zone ID (hex) or zone name (e.g. or-infra.com)'),
    },
    async ({ zoneIdOrName }) => {
      try {
        const records = await cfListDnsRecords(zoneIdOrName);
        const result = {
          zoneIdOrName,
          timestamp: new Date().toISOString(),
          recordCount: records.length,
          records,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        if (e instanceof CfZonesTokenError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'token_not_configured', detail: e.message }, null, 2) }] };
        }
        if (e instanceof NotFoundError) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'not_found', zoneIdOrName, detail: e.message }, null, 2) }] };
        }
        throw e;
      }
    },
  );

  server.tool(
    'list_all_systems_inventory',
    'Cross-cloud inventory aggregator: pulls GCP projects + Railway projects + Cloudflare zones in parallel, scans factory/manifests/*.yml, and joins everything into a single table. Each resource is tagged inFactory:true/false. Manifests referencing cloud resources the SA cannot see are reported as "orphaned". If the cloudflare-zones-read-token is not configured, GCP+Railway portions still return; Cloudflare portion includes a token_not_configured error. Read-only.',
    {},
    async () => {
      const inventory = await buildInventory();
      return { content: [{ type: 'text' as const, text: JSON.stringify(inventory, null, 2) }] };
    },
  );

}
