## לידה מחוברת (mcp-birth-bundle) — Stage 5: every system's n8n is also an MCP SERVER

Every newly-provisioned system now exposes a read-only MCP endpoint outward:
`https://n8n-<system>.or-infra.com/mcp/system-tools` (Bearer-guarded), serving
the three existing READ subworkflows — `postgres_named_query`,
`github_readonly`, `railway_readonly` — as MCP tools for external agents.
`request_write_action` is deliberately OUT (read-only surface; writes stay
behind the system's own HITL flow).

**Changes:**
- `templates/system/workflows/n8n/mcp-server.json` (new): `mcpTrigger`
  (typeVersion 2, path `system-tools`, bearerAuth via the new
  `@@CRED_N8N_MCP_SERVER_ID@@` credential) + the three toolWorkflow nodes
  wired `ai_tool` to the trigger.
- `.github/workflows/provision-system.yml`: `n8n-mcp-server-token` runtime
  shell + a local mint-if-empty (openssl rand; no gateway involved).
- `templates/system/.github/workflows/configure-agent-router.yml`: builds the
  "n8n MCP Server" httpBearerAuth credential from the token, seds the
  credential + the three subworkflow ids, strips tools whose subworkflow is
  missing, installs + ACTIVATES the workflow, then runs a **built-in
  self-verification** on every system: no-bearer ⇒ 401/403; initialize +
  tools/list with the bearer; one REAL `postgres_named_query` MCP call (the
  argument key is discovered from the tool's own inputSchema). All soft-fail —
  never blocks the router.
- `templates/system/AGENTS.md.template`: documents the endpoint; deliberately
  NOT in `.mcp.json` (committed file; this endpoint needs its secret).
- `monitoring/registry-exempt.txt` + golden refreshed (120 files).

**Deferred (recorded):** n8n's built-in instance-level MCP access (beta,
requires manual UI enablement) — revisit when GA or headless-enable exists.

**Proof plan (live, after merge):** fresh reuse provision (factory-test-048 —
the provision-side mint can only run from `main`, same successor pattern as
stages 2-3) → deploy → configure → the self-verification PASS lines in the
configure log are the acceptance evidence; independent 401 probe via
`probe_endpoint`. Note: the devplan's original acceptance named a real
`github_readonly` call — on register-app-less test systems that tool has no
App credentials, so the always-available `postgres_named_query` proves the
identical toolWorkflow path; `github_readonly` exercises automatically on
real systems (where the App is registered).

**Fix (found live on factory-test-048):** n8n 1.121 rejected the workflow
POST with HTTP 500 — `null value in column "active" ... violates not-null
constraint`. Every other template carries a top-level `"active": false` and
the new mcp-server.json didn't; added. (Caught by the live loop exactly as
designed: the install failed soft, the router still configured.)

**Iteration 2 (found live on factory-test-048):** after the active-field fix
the workflow installed and the API showed `active: true` — but
`/mcp/system-tools` stayed 404 ("webhook not registered"): the shared
helper's silent PATCH fallback can set the DB flag without runtime trigger
registration. The mcp-server install now activates EXPLICITLY (response
always surfaced; one deactivate→activate retry cycle on failure) and the
self-verification waits out registration lag (up to ~60s of 404) before
asserting.

**Iteration 3 (found live on factory-test-048):** the explicit activation
surfaced the real mechanism — `POST /rest/workflows/:id/activate` does NOT
exist in n8n 1.121 (404 + the SPA's HTML), and `PATCH {"active":true}` only
flips the DB flag without registering the mcpTrigger runtime route. The
supported programmatic activation is the PUBLIC API: the block now does the
Public-API deactivate→activate pair with `X-N8N-API-KEY` (this system's own
`n8n-api-key`, minted at deploy), deactivate-first so re-runs re-register
cleanly. (This also explains why regular-webhook workflows never hit this:
their PATCH path registers `webhook` triggers; mcpTrigger needs the full
activation service.)

**Iteration 4 (Or chose to keep investigating):** even the Public API's 200
left `/mcp/system-tools` 404 — on n8n 1.121 NO runtime activation path
registers an mcpTrigger route (plain webhooks do register; boot-time is the
remaining mechanism). The self-verification moved to the END of the
configure step (a restart mid-step would break the /rest installs that
follow) and now, when the endpoint still 404s after activation, forces ONE
clean n8n restart via Railway `serviceInstanceRedeploy` (token + project +
n8n-service ids from the system's own SM), waits for `/healthz`, re-checks
registration, then runs the full verification.
