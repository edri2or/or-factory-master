## לידה מחוברת (mcp-birth-bundle) — Stage 1: tenant-locked factory telemetry MCP

The central gateway now exposes `/factory/<system>/mcp` — a per-system,
read-only telemetry surface over the factory's OWN tools, so every provisioned
system's agent can observe ITSELF (its n8n, its Railway services, its repo's
CI, its one public host) without any factory credential leaving the vault.

**Changes:**
- `services/mcp-server/src/factory-scope.ts` (new): an allowlist FACADE over
  `registerTools()` — only 8 tools are forwarded (`list_n8n_workflows`,
  `inspect_n8n_execution`, `inspect_railway_service`, `list_railway_deployments`,
  `tail_railway_deployment_logs`, `probe_endpoint`, `list_workflow_runs`,
  `get_run_jobs`); the tenant-identifying params (`systemName` / `owner`+`repo` /
  Railway `projectId`+`environmentId`) are REMOVED from the schemas and injected
  server-side from the signed bearer claim; `probe_endpoint` is host-locked to
  `n8n-<system>.or-infra.com` and the by-id Railway tools resolve + verify the
  system's own project (`tenant_blocked` otherwise). ENV kill-switch:
  `FACTORY_TOOLS_ALLOWED_SYSTEMS` ("*" default, CSV pin, empty = off).
- `services/mcp-server/src/bearer.ts` + `index.ts`: new system-scoped bearer
  kind `factory-runtime` (1y TTL, signed `system` claim), minted at
  `POST /factory/<system>/token` (X-Admin-Secret gate, like workspace); the new
  route serves a per-request in-process McpServer (same stateless pattern as
  `/mcp`). A shared `systemRouteAllows()` helper now enforces on ALL THREE
  system-scoped routes (`/n8n`, `/workspace`, `/factory`) that only that
  route's own bearer kind (bound to the path's system) or an operator-grade
  bearer passes — closing the cross-route leak where one surface's runtime
  token could drive another surface.
- `scripts/render-mcp-service-yaml.sh` + `.github/workflows/deploy-mcp-server.yml`:
  wire `FACTORY_TOOLS_ALLOWED_SYSTEMS` ("*") into the gateway container.
- `scripts/factory-mcp-smoke.py` + `.github/workflows/factory-mcp-smoke.yml`
  (new, manual): 7-step live tenant smoke — mint → initialize → EXACT 8-tool
  list → real `list_n8n_workflows` read → cross-tenant probe `tenant_blocked` →
  foreign-path 403 → no-token 401. Exempted in `monitoring/registry-exempt.txt`
  (manual smoke, no cadence).
- `services/mcp-server/test/factory-scope.test.mjs` (new): unit tests for the
  pure parts (exact tool set, schema stripping, probe host lock).

No org-read tools, no `dispatch_workflow`, no GCP/Cloudflare surface exists on
this route. Stage 2 wires a `factory_tools` MCP Client Tool node into each new
system's Ops Agent at provision time.
