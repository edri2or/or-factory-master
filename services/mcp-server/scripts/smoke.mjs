#!/usr/bin/env node
// Post-deploy smoke for the six PR B observability tools (ADR 161).
// Called from deploy-mcp-server-cloud-run.yml after /health=200.
//
// Args from env:
//   MCP_URL        — Cloud Run service URL (no trailing /)
//   ADMIN_SECRET   — value of mcp-server-admin-secret from GCP SM
//
// Target system: or-test-50 — the perpetual test substrate (ADR 185).
// All five system-scoped checks (list_system_secrets, verify_mcp_server,
// inspect_railway_service n8n, inspect_wif_provider, verify_cloudflare_system)
// resolve against or-test-50's live manifest + external resources. or-test-50
// is post-ADR-161, so inspect_wif_provider returns real CEL data (not the
// historical permission_denied that or-test-38 surfaced).

const MCP_URL = process.env.MCP_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!MCP_URL || !ADMIN_SECRET) {
  console.error('::error::MCP_URL or ADMIN_SECRET missing');
  process.exit(1);
}

const SMOKE_TARGET_SYSTEM = 'or-test-50';

async function exchangeAdminForBearer() {
  const resp = await fetch(`${MCP_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw new Error(`POST /token → ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('no access_token in /token response');
  return data.access_token;
}

async function callTool(bearer, toolName, args) {
  const resp = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });
  const text = await resp.text();
  // Parse JSON-RPC OR first SSE `data:` line (StreamableHTTP transport).
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const sseMatch = text.match(/^data: (.+)$/m);
    if (!sseMatch) throw new Error(`unparseable response: ${text.slice(0, 300)}`);
    payload = JSON.parse(sseMatch[1]);
  }
  if (payload.error) throw new Error(`JSON-RPC error: ${JSON.stringify(payload.error)}`);
  const content = payload.result?.content?.[0]?.text;
  if (!content) throw new Error(`no content in result: ${JSON.stringify(payload).slice(0, 300)}`);
  return JSON.parse(content);
}

const results = [];
function record(name, pass, evidence) {
  results.push({ name, pass, evidence });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name} — ${evidence}`);
}

async function main() {
  const bearer = await exchangeAdminForBearer();
  console.log(`Admin bearer minted; running 8 smoke checks against ${SMOKE_TARGET_SYSTEM} + self...`);

  // 1. list_system_secrets — expect github-app-id present
  try {
    const r = await callTool(bearer, 'list_system_secrets', { systemName: SMOKE_TARGET_SYSTEM });
    const names = (r.secrets ?? []).map((s) => s.name);
    record(
      'list_system_secrets',
      names.includes('github-app-id'),
      `secretCount=${r.secretCount} includes github-app-id=${names.includes('github-app-id')}`,
    );
  } catch (e) {
    record('list_system_secrets', false, String(e).slice(0, 200));
  }

  // 2. verify_mcp_server — target has a populated endpointUrl per manifest.externalResources.mcp
  try {
    const r = await callTool(bearer, 'verify_mcp_server', { systemName: SMOKE_TARGET_SYSTEM });
    record(
      'verify_mcp_server',
      r.summary === 'all-pass' || r.summary === 'degraded',
      `summary=${r.summary} checks=${r.checks.length}`,
    );
  } catch (e) {
    record('verify_mcp_server', false, String(e).slice(0, 200));
  }

  // 3. probe_endpoint — self /health
  try {
    const r = await callTool(bearer, 'probe_endpoint', { url: `${MCP_URL}/health`, expect_status: 200 });
    record('probe_endpoint self /health', r.checks?.statusMatched === true, `status=${r.status}`);
  } catch (e) {
    record('probe_endpoint self /health', false, String(e).slice(0, 200));
  }

  // 4. probe_endpoint — disallowed host (assert allowlist works)
  try {
    const r = await callTool(bearer, 'probe_endpoint', { url: 'https://example.com' });
    record(
      'probe_endpoint allowlist enforced',
      r.error === 'allowlist_rejected',
      r.error ?? `unexpected: probe returned status ${r.status}`,
    );
  } catch (e) {
    record('probe_endpoint allowlist enforced', false, String(e).slice(0, 200));
  }

  // 5. inspect_cloud_run — self-introspection
  try {
    const r = await callTool(bearer, 'inspect_cloud_run', {
      serviceName: 'factory-actions-mcp',
      project: 'factory-control-9piybr',
      region: 'me-west1',
    });
    record(
      'inspect_cloud_run self',
      typeof r.latestReadyRevision === 'string' && typeof r.image === 'string',
      `revision=${r.latestReadyRevision} envVarCount=${r.envVarCount}`,
    );
  } catch (e) {
    record('inspect_cloud_run self', false, String(e).slice(0, 200));
  }

  // 6. inspect_railway_service — or-test-38 n8n
  try {
    const r = await callTool(bearer, 'inspect_railway_service', {
      systemName: SMOKE_TARGET_SYSTEM,
      serviceName: 'n8n',
    });
    const ok = !r.error && Array.isArray(r.domains);
    record(
      'inspect_railway_service n8n',
      ok,
      ok ? `domains=${r.domains.length} deployStatus=${r.latestDeployment?.status ?? 'none'}` : (r.error ?? 'unknown'),
    );
  } catch (e) {
    record('inspect_railway_service n8n', false, String(e).slice(0, 200));
  }

  // 7. inspect_wif_provider — or-test-50 is post-ADR-161, so runtime SA has
  // workloadIdentityPoolViewer; tool returns real CEL data. permission_denied
  // is still accepted as a legacy-system PASS for back-compat.
  try {
    const r = await callTool(bearer, 'inspect_wif_provider', { systemName: SMOKE_TARGET_SYSTEM });
    if (r.attributeCondition) {
      record('inspect_wif_provider', true, `CEL length=${r.attributeCondition.length}`);
    } else if (r.error === 'permission_denied') {
      record('inspect_wif_provider (legacy permission_denied)', true, 'pre-ADR-161 backfill-pending behavior');
    } else {
      record('inspect_wif_provider', false, `unexpected shape: ${JSON.stringify(r).slice(0, 200)}`);
    }
  } catch (e) {
    record('inspect_wif_provider', false, String(e).slice(0, 200));
  }

  // 8. verify_cloudflare_system — DNS read-path with scoped token (PR-E bake-in).
  // or-test-45's verify_cloudflare_system run (factory run 26101528445)
  // surfaced a 401 Authentication error on one record while the other
  // succeeded — CF edge-propagation lag. PR-E added retry-on-401 in
  // cloudflare-client.ts:getDnsRecord + a 1s settle in tools.ts; this
  // smoke catches any future regression on the read path.
  try {
    const r = await callTool(bearer, 'verify_cloudflare_system', { systemName: SMOKE_TARGET_SYSTEM });
    const checks = r.checks ?? [];
    const failedChecks = checks.filter((c) => c.status === 'fail');
    if (failedChecks.length > 0) {
      record(
        'verify_cloudflare_system',
        false,
        `${failedChecks.length} fails: ${failedChecks.map((c) => `${c.name}:${c.evidence}`).join('; ').slice(0, 250)}`,
      );
    } else {
      record('verify_cloudflare_system', true, `checks=${checks.length} (no fails)`);
    }
  } catch (e) {
    record('verify_cloudflare_system', false, String(e).slice(0, 200));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- smoke summary: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length > 0) {
    console.error('::error::Smoke failed: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('::error::Smoke crashed:', e);
  process.exit(1);
});
