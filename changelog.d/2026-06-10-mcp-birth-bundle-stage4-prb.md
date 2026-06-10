## לידה מחוברת (mcp-birth-bundle) — Stage 4 PR-B: Drive+Docs live on the Workspace gateway

Second half of the Drive+Docs expansion. The shared token was rotated to the
6-scope grant (consent → extract on or-adhd-agent via the narrow broker bridge
→ `copy-gmail-oauth-to-control rotate=true`; the previous 4-scope version stays
in control SM history as the rollback). This PR aligns the gateway to it and
triggers the redeploy.

**Changes:**
- `services/workspace-mcp/entrypoint.sh`: the credential file's `scopes` list
  is now env-driven (`WORKSPACE_MCP_SCOPES`, space-separated; default = the
  6-scope grant) — byte-equal to the grant, or google-auth fails refresh with
  "Scope has changed". Default tools now `calendar gmail drive docs`.
- `scripts/render-mcp-service-yaml.sh`: parametrized `WORKSPACE_MCP_TOOLS`
  (default `calendar gmail drive docs`) + new `WORKSPACE_MCP_SCOPES` env into
  the workspacemcp sidecar.
- `scripts/google-mcp-smoke.py`: extended 4→6 steps — Drive+Docs tools present
  in tools/list, and a REAL `search_drive_files` read (auth-prompt / "Scope has
  changed" = fail).
- `templates/system/workflows/n8n/ops-agent.json`: the GOOGLE WORKSPACE
  systemMessage paragraph now covers Drive/Docs reads (free) and routes
  Drive/Docs writes through `request_write_action`, like email/calendar.
  Golden refreshed.

**Rollback:** restore the previous `gmail-oauth-refresh-token` version in
control SM as latest + revert this PR (the entrypoint default falls back to 6,
so the SM version is the real switch — older 4-scope token + 6-scope default
would mismatch; full rollback = both).
