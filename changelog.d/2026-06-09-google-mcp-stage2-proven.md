## Google MCP for systems — Stage 2 proven live (close-out)

The Google-Workspace-MCP-for-every-system development is proven end to end on a
live throwaway test system (`factory-test-045`): a factory-built n8n agent
autonomously called the `google_workspace` MCP Client Tool node → the central
gateway `/workspace/<system>/mcp` → the shared Google identity, and returned
**real Gmail data** (38 labels of the shared account, including the Hebrew label
"כספים"). The ops-agent execution (id 11) finished `success`; the native n8n
1.121 `mcpClientTool` connected over streamable-http (no SSE-transport bug).

Since Stage 1 is already on `main`, every system provisioned from now on is born
with this tool wired into its Ops Agent.

**This change:** documentation only — `devplans/google-mcp-systems.md` marked
through Stage 2 completed + Stage 3 (close-out) in progress.

**Open follow-up (before real systems rely on Google writes):** a hard write-gate
— restrict the tools the MCP node exposes, or mint a read-only-scoped shared
token. Today the node exposes all Google tools with a prompt-level instruction
to route writes through the system's `request_write_action` HITL.

**Infra notes surfaced during the live proof (none in the feature):** reuse-mode
test system names must start `factory-test-` (the shared WIF CEL rejects others);
Railway's edge can transiently drop a verified custom domain (a redeploy
re-registers it); OpenRouter is prepaid — a per-key spend *limit* is not account
*credit*, so an empty account balance 402s every agent.
