import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiGetRepo, fetchJobLogs } from './github-client.js';
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
import { loadManifest, condition, summarize, NotFoundError, type Check, type VerifyResult } from './manifest-helper.js';
import { probe, isAllowedUrl, AllowlistError, type ProbeResult } from './probe.js';
import { resolveRecord as dnsResolveRecord, SUPPORTED_DNS_TYPES, DnsAllowlistError } from './dns-helper.js';
import { inspectCert as tlsInspectCert, TlsAllowlistError } from './tls-helper.js';

export function registerTools(server: McpServer): void {
  server.tool(
    'list_workflow_runs',
    'List recent GitHub Actions workflow runs for edri2or/factory',
    {
      workflow_id: z.string().optional().describe('Workflow file name, e.g. factory-orchestrator.yml'),
      branch: z.string().optional().describe('Filter by branch name'),
      status: z
        .enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending'])
        .optional()
        .describe('Filter by run status'),
      limit: z.number().int().min(1).max(20).optional().default(10).describe('Number of runs to return'),
    },
    async ({ workflow_id, branch, status, limit }) => {
      const params = new URLSearchParams();
      if (branch) params.set('branch', branch);
      if (status) params.set('status', status);
      params.set('per_page', String(limit ?? 10));

      const path = workflow_id
        ? `/actions/workflows/${encodeURIComponent(workflow_id)}/runs?${params}`
        : `/actions/runs?${params}`;

      const data = (await apiGet(path)) as { workflow_runs: unknown[] };
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
    { run_id: z.string().describe('The numeric workflow run ID') },
    async ({ run_id }) => {
      const run = (await apiGet(`/actions/runs/${run_id}`)) as Record<string, unknown>;
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
      run_id: z.string().describe('The numeric workflow run ID'),
      fetch_logs_for_job_id: z
        .string()
        .optional()
        .describe('If provided, also fetch plain-text logs for this specific job ID (max 50 KB)'),
    },
    async ({ run_id, fetch_logs_for_job_id }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/jobs`)) as { jobs: unknown[] };
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
          logs = await fetchJobLogs(fetch_logs_for_job_id);
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
    'list_workflows',
    'List all workflows defined in edri2or/factory (returns name, file path, state).',
    { limit: z.number().int().min(1).max(100).optional().default(30) },
    async ({ limit }) => {
      const data = (await apiGet(`/actions/workflows?per_page=${limit ?? 30}`)) as { workflows: unknown[] };
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
    { run_id: z.string().describe('The numeric workflow run ID') },
    async ({ run_id }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/artifacts`)) as { artifacts: unknown[] };
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
    { run_id: z.string().describe('The numeric workflow run ID') },
    async ({ run_id }) => {
      const data = (await apiGet(`/actions/runs/${run_id}/pending_deployments`)) as unknown[];
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
    { run_id: z.string().describe('The numeric workflow run ID') },
    async ({ run_id }) => {
      const data = await apiGet(`/actions/runs/${run_id}/timing`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ─── Direct Verification tools (ADR 137 / PR 2b) ───────────────────────
  // Each verify_* tool reads the system's manifest, calls the relevant
  // provider's read-only API, and returns a Kubernetes-style result.

  const systemNameSchema = {
    systemName: z.string().min(1).describe('The system name (e.g. or-test-N or svc-foo)'),
  };

  function registerVerifier(
    toolName: string,
    description: string,
    conditionType: string,
    planeName: string,
    runChecks: (m: Awaited<ReturnType<typeof loadManifest>>) => Promise<Check[]>,
  ): void {
    server.tool(toolName, description, systemNameSchema, async ({ systemName }) => {
      const m = await loadManifest(systemName);
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
        return [{ name: 'manifest-has-gcpProjectId', status: 'fail', evidence: 'missing gcpProjectId' }];
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
          status: p.parent?.type === 'folder' && p.parent?.id === '293382608212' ? 'pass' : 'fail',
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
    'Verify the generated system\'s Railway project: project + environment exist, services (postgres/n8n/mcp) accessible, latest deployment SUCCESS.',
    'RailwayReady',
    'Railway',
    async (m) => {
      const r = m.externalResources?.railway;
      if (!r?.projectId) {
        return [{ name: 'manifest-has-railway-projectId', status: 'skip', evidence: 'pre-Phase-A system (no externalResources.railway)' }];
      }
      const checks: Check[] = [];
      let proj;
      try {
        proj = await railwayGetProject(r.projectId);
      } catch (e) {
        return [{ name: 'project-exists', status: 'fail', evidence: String(e).slice(0, 200) }];
      }
      checks.push({ name: 'project-exists', status: proj ? 'pass' : 'fail', evidence: proj ? `name=${proj.name}` : 'project-not-found' });
      if (!proj || !r.environmentId) return checks;
      const env = proj.environments.edges.find((e) => e.node.id === r.environmentId);
      checks.push({ name: 'environment-exists', status: env ? 'pass' : 'fail', evidence: env ? `name=${env.node.name}` : 'not found in project' });
      // Parallel: per-service existence + deployment fetch.
      const services: Array<readonly [string, string | undefined]> = [
        ['postgres', r.services?.postgres],
        ['n8n', r.services?.n8n],
        ['mcp', m.externalResources?.mcp?.railwayServiceId],
      ];
      const serviceResults = await Promise.all(
        services.map(async ([label, svcId]) => {
          if (!svcId) return [{ name: `service-${label}-id-in-manifest`, status: 'skip' as const }] as Check[];
          const found = proj.services.edges.find((s) => s.node.id === svcId);
          const out: Check[] = [
            { name: `service-${label}-exists`, status: found ? 'pass' : 'fail', evidence: found ? `name=${found.node.name}` : 'svcId not found' },
          ];
          if (found && env && r.environmentId) {
            try {
              const dep = await railwayGetDeployment(r.projectId!, r.environmentId, svcId);
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
          name: 'manifest-has-cloudflare-records',
          status: 'skip',
          evidence: zoneId ? 'no records in manifest' : 'no zoneId in manifest or CLOUDFLARE_ZONE_ID env',
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
    'HTTPS GET on a factory-owned URL (or-infra.com / up.railway.app / run.app). Returns status, content-type, body (truncated 4 KB), and optional expect_status / expect_body_contains checks. 10 s timeout.',
    {
      url: z.string().describe('https URL; host must end with an allowlisted suffix'),
      expect_status: z.number().int().optional().describe('Optional: assert HTTP status equals this'),
      expect_body_contains: z.string().optional().describe('Optional: assert response body includes this substring'),
    },
    async ({ url, expect_status, expect_body_contains }) => {
      try {
        const result: ProbeResult = await probe(url, expect_status, expect_body_contains);
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
      const m = await loadManifest(systemName);
      if (!m.gcpProjectId) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_gcp_project', message: 'manifest has no gcpProjectId' }, null, 2) }] };
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
    'Inspect a Railway service in the system\'s project: latest deployment status and public domains (Railway-assigned + custom). Resolves projectId / environmentId from manifest.externalResources.railway.',
    {
      systemName: z.string().min(1).describe('The system name (e.g. or-test-N)'),
      serviceName: z.string().describe('Railway service name within the project (e.g. postgres, n8n, mcp-server)'),
    },
    async ({ systemName, serviceName }) => {
      const m = await loadManifest(systemName);
      const r = m.externalResources?.railway;
      if (!r?.projectId || !r?.environmentId) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_railway_in_manifest', message: 'manifest has no externalResources.railway.{projectId, environmentId}' }, null, 2) }] };
      }
      const proj = await railwayGetProject(r.projectId);
      if (!proj) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_project_not_found', projectId: r.projectId }, null, 2) }] };
      }
      const svc = proj.services.edges.find((s) => s.node.name === serviceName);
      if (!svc) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'railway_service_not_found', serviceName, projectId: r.projectId, knownServices: proj.services.edges.map((s) => s.node.name) }, null, 2) }] };
      }
      const detail = await railwayGetServiceInstance(r.projectId, r.environmentId, svc.node.id);
      const result = {
        system: systemName,
        serviceName,
        timestamp: new Date().toISOString(),
        railwayProjectId: r.projectId,
        railwayEnvironmentId: r.environmentId,
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
      const m = await loadManifest(systemName);
      if (!m.gcpProjectId) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_gcp_project', message: 'manifest has no gcpProjectId' }, null, 2) }] };
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
    },
    async ({ projectId, environmentId, serviceId, lines }) => {
      const limit = lines ?? 100;
      const dep = await railwayGetDeployment(projectId, environmentId, serviceId);
      if (!dep) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'no_deployment', projectId, environmentId, serviceId }, null, 2) }] };
      }
      const logs = await railwayGetDeploymentLogs(dep.id, limit);
      // 50 KB truncation to match github-client.fetchJobLogs pattern. Keeps
      // tool responses bounded even when log lines are huge.
      const MAX_BYTES = 50 * 1024;
      let totalBytes = 0;
      const truncated: typeof logs = [];
      for (const log of logs) {
        const lineBytes = Buffer.byteLength(JSON.stringify(log), 'utf8');
        if (totalBytes + lineBytes > MAX_BYTES) break;
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
    },
    async ({ deploymentId, lines }) => {
      const limit = lines ?? 100;
      const logs = await railwayGetBuildLogs(deploymentId, limit);
      const MAX_BYTES = 50 * 1024;
      let totalBytes = 0;
      const truncated: typeof logs = [];
      for (const log of logs) {
        const lineBytes = Buffer.byteLength(JSON.stringify(log), 'utf8');
        if (totalBytes + lineBytes > MAX_BYTES) break;
        truncated.push(log);
        totalBytes += lineBytes;
      }
      const result = {
        deploymentId,
        timestamp: new Date().toISOString(),
        requestedLines: limit,
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
    'Tail recent Cloud Run logs for a service via Cloud Logging entries:list. Filters on resource.type="cloud_run_revision" + service_name. Returns entries in chronological order with timestamp, severity, textPayload, jsonPayload, resource labels, insertId. 50 KB byte cap on response. Read-only — requires roles/logging.viewer on the project (per-system roles/viewer covers it; factory-control gets logging.viewer via bootstrap-mcp-runtime-sa.sh best-effort grant).',
    {
      serviceName: z.string().min(1).describe('Cloud Run service name (e.g. factory-actions-mcp, mcp-server)'),
      project: z.string().optional().default('factory-control-9piybr').describe('GCP project ID (default: factory-control-9piybr)'),
      lines: z.number().int().min(1).max(500).optional().default(100).describe('Max log entries to return (capped at 500)'),
    },
    async ({ serviceName, project, lines }) => {
      const limit = lines ?? 100;
      try {
        const entries = await gcpTailCloudRunLogs(project, serviceName, limit);
        const MAX_BYTES = 50 * 1024;
        let totalBytes = 0;
        const truncated: typeof entries = [];
        for (const entry of entries) {
          const lineBytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
          if (totalBytes + lineBytes > MAX_BYTES) break;
          truncated.push(entry);
          totalBytes += lineBytes;
        }
        const result = {
          project,
          serviceName,
          timestamp: new Date().toISOString(),
          requestedLines: limit,
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
