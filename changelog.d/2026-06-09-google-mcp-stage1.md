## Google MCP for systems — Stage 1: wire the agent to the Google Workspace MCP

Every newly-provisioned system's n8n "Ops Agent" now gains a `google_workspace`
tool — a native **MCP Client Tool** node (`@n8n/n8n-nodes-langchain.mcpClientTool`,
present in n8n 1.121.0) pointing at the central gateway's
`/workspace/<system>/mcp` (HTTP Streamable, Bearer). The shared Google identity
stays central; each system carries only a long-lived, system-scoped bearer.

**Changes:**
- `templates/system/workflows/n8n/ops-agent.json`: add the `google_workspace` MCP
  Client Tool node + its `ai_tool` connection; append a `systemMessage` instruction
  to pass `user_google_email=shared-google@or-infra.com` on every call and to route
  Gmail send / Calendar writes through `request_write_action` for the operator's ✅.
- `templates/system/.github/workflows/configure-agent-router.yml`: create an
  `httpBearerAuth` credential "Google Workspace MCP" from the system's
  `workspace-mcp-bearer` SM secret; resolve `@@CRED_GOOGLE_MCP_ID@@`; strip the node
  (graceful degradation) when the bearer is absent — same pattern as the existing
  Railway/Tavily/GitHub tool strips.
- `.github/workflows/provision-system.yml`: add the `workspace-mcp-bearer` runtime
  secret shell + a broker mint step (read `mcp-server-admin-secret` from CONTROL SM →
  `POST <gateway>/workspace/<system>/token` → store only the per-system JWT in the
  system's SM). The control admin secret never leaves control.
- `tests/golden/system/MANIFEST.sha256`: refreshed for the two template changes.

**Boundary:** the exact MCP node JSON (typeVersion/transport/auth) is validated live
in Stage 2 (import into a throwaway test system). v1 exposes all Google tools with a
prompt-level write gate; a hard write-gate (tool restriction or a read-only-scoped
shared token) is a pre-promote decision.
