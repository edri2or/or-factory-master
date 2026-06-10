## לידה מחוברת (mcp-birth-bundle) — close-out

The development is complete: **every system the factory builds is now born
MCP-connected.** Four delivered surfaces (1 armed-dormant):

1. **`/factory/<system>/mcp`** — tenant-locked, read-only 8-tool factory
   telemetry over the system ITSELF, wired into every new ops-agent as
   `factory_tools`. Proven live twice (or-adhd-agent 7/7 smoke;
   factory-test-046 agent round byte-identical to ground truth).
2. **Google Drive + Docs** on the shared Workspace sidecar (6-scope rotated
   token, env-driven scopes, 6-step smoke incl. real `search_drive_files`;
   live agent round returned the shared account's real files).
3. **Committed `.mcp.json`** in every new repo — Claude Code sessions born
   connected to `factory` (`/mcp`) + `n8n-live` (`/n8n/<system>/mcp`), zero
   secrets (byte-exact render proven on factory-test-047).
4. **Armed-dormant:** the n8n `mcp-server` workflow (outward read-only MCP at
   `/mcp/system-tools`) — n8n 1.121 registers no mcpTrigger routes (proven
   conclusively at runtime AND boot, 4 documented iterations); configure
   self-verifies every run, so it lights up automatically once the n8n
   upgrade (follow-up dev) ships.

**This change (docs only):** CLAUDE.md gains the new gateway surfaces +
3 workflow rows + the provision mint note; both active devplans closed
(`mcp-birth-bundle` 6/6; `consolidate-to-master` — all stages were long
completed, formally closed now), releasing the devplan CI gate (unblocks the
stalled OIL PR flow). Teardown ledger final: factory-test-046/047/048 all
decommissioned with Or's approval.

**Recorded follow-ups (9):** n8n version upgrade (lights stage 5 + revisit
built-in MCP); factory_tools v2 (build logs / verify_*); read-only-scoped
Google token as a hard write gate; router/unknown-agent reply quality;
template bootstrap fallback-link session flaw; move the shared Google
client's redirect URI off or-adhd-agent before its decommission; gcp-action
double-gcloud prefix hardening; devplan-gate × OIL-PR interaction (consider
exempting oil-autofix/* branches); broker `secrets:read`+`administration:read`
verification.
