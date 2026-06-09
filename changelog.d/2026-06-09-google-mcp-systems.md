## Google MCP for systems — Stage 0b: host the Google Workspace MCP centrally

Adds a third Cloud Run sidecar to the factory MCP gateway: a self-hosted
Google Workspace MCP (`taylorwilsdon/google_workspace_mcp`, pinned `1.21.1`)
that serves the ONE shared Google identity (the existing `gmail-oauth-*`
secrets) to every system over MCP. First brick of the reusable
MCP-consumer platform (`devplans/google-mcp-systems.md`). Stage 0a proved the
headless single-user "mode-C" mechanism in isolation before this wiring.

**Changes:**
- `services/workspace-mcp/` (new): `Dockerfile` (python + workspace-mcp) +
  `entrypoint.sh` boot shim that pre-seeds the single-user credential from the
  shared `gmail-oauth-*` env, then launches `workspace-mcp --single-user
  --transport streamable-http --tools calendar gmail --read-only` on
  localhost:3002. Read-only by default (v1 blast-radius); token never logged.
- `services/mcp-server/src/workspace-mcp-proxy.ts` (new): thin, bearer-gated
  pass-through to the sidecar (no per-tenant injection — the identity is shared).
- `services/mcp-server/src/index.ts`: `/workspace/<system>/token` (admin-gated,
  mints a long-lived system-scoped bearer) + `/workspace/<system>/mcp` (verifies
  the bearer, hard system-mismatch 403, proxies). `bearer.ts`: new
  `workspace-runtime` bearer kind.
- `scripts/render-mcp-service-yaml.sh`: renders the third `workspacemcp`
  container + the gateway's `WORKSPACE_MCP_URL` / `WORKSPACE_ALLOWED_SYSTEMS`.
- `.github/workflows/deploy-mcp-server.yml`: builds+pushes the sidecar image,
  passes it (and the new env) to the render; trigger paths cover
  `services/workspace-mcp/**` + the render script.
- `.github/workflows/google-mcp-smoke.yml` + `scripts/google-mcp-smoke.py`
  (new): manual live proof — mint bearer → handshake → `list_calendars` returns
  real data for the shared account. Registered in `monitoring/registry-exempt.txt`.

**Security:** the shared Google refresh token stays in control Secret Manager and
is mounted only into the central sidecar — never copied into any system's n8n.
The sidecar is portless (localhost-only); the public boundary is the per-system
`workspace-runtime` bearer + the route's system-mismatch guard. No
`templates/system/**` change yet (that is Stage 1) → golden untouched.
