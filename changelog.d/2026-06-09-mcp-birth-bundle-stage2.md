## לידה מחוברת (mcp-birth-bundle) — Stage 2: `factory_tools` on every new system's Ops Agent

Every newly-provisioned system's n8n "Ops Agent" now gains a `factory_tools`
MCP Client Tool node pointing at the central gateway's tenant-locked
`/factory/<system>/mcp` (HTTP Streamable, Bearer) — deep, read-only telemetry
over ITSELF: n8n execution diagnosis, Railway deployment history + runtime
logs, GitHub Actions runs + job logs, and a probe of its own public host.
Exact mirror of the proven `google_workspace` chain.

**Changes:**
- `templates/system/workflows/n8n/ops-agent.json`: add the `factory_tools` MCP
  Client Tool node (`@@CRED_FACTORY_MCP_ID@@` / `/factory/@@SYSTEM_NAME@@/mcp`)
  + its `ai_tool` connection; append a FACTORY TELEMETRY `systemMessage`
  paragraph (read-only, already system-scoped server-side, prefer it for
  depth — history / job logs / failing-node diagnosis / live endpoint checks).
- `templates/system/.github/workflows/configure-agent-router.yml`: create an
  `httpBearerAuth` credential "Factory MCP" from the system's
  `factory-mcp-bearer` SM secret; resolve `@@CRED_FACTORY_MCP_ID@@`; strip the
  node (graceful degradation) when the bearer is absent — same pattern as the
  google_workspace strip.
- `.github/workflows/provision-system.yml`: add the `factory-mcp-bearer`
  runtime secret shell + a twin broker mint step in the same block as the
  workspace mint (read `mcp-server-admin-secret` from CONTROL SM →
  `POST <gateway>/factory/<system>/token` → store only the per-system JWT in
  the system's SM; WARN-soft on any miss).
- `tests/golden/system/MANIFEST.sha256`: refreshed for the two template changes.

**Proof plan (live, this stage):** provision a throwaway reuse-mode test system
from `main` after merge (0 GCP quota) → full chain (deploy → configure) → ask
the agent a question only `factory_tools` can answer (last-5 Railway deploy
history) → verify via `inspect_n8n_execution` + a live cross-tenant negative
(probe to another system ⇒ `tenant_blocked`). Provision-side code can only run
from `main` (broker WIF CEL), so the landing is merge-static-gates-first, then
prove-on-fresh-provision — the same path the google_workspace chain used;
`prove-on-test-system.yml` stays the loop for any template fix iterations.
