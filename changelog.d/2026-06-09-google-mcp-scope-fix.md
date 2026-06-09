## Google MCP — Stage 0b scope fix: full mode for the write-scoped shared token

Follow-up to the Stage 0b deploy. The gateway plumbing proved end-to-end
(bearer → handshake → 11 Google tools), but the live read failed: the shared
Google token is write-scoped (`gmail.modify` + `calendar.events` +
`gmail.settings.*`), and `--read-only` mode demands `calendar.readonly`, which the
token lacks → Google refused.

**Changes:**
- `services/workspace-mcp/entrypoint.sh`: default to full mode
  (`WORKSPACE_MCP_READ_ONLY=0`); the seeded credential's `scopes` are set to
  EXACTLY the 4 consented scopes (a superset triggers google-auth's "scope
  changed" refresh error).
- `scripts/render-mcp-service-yaml.sh`: `WORKSPACE_MCP_READ_ONLY "0"`.
- `scripts/google-mcp-smoke.py`: read `list_gmail_labels` (covered by
  `gmail.modify`) instead of `list_calendars` (needs `calendar.readonly`).

**Security:** the MCP is now read+write capable on the shared Google account;
no system writes without Or's per-action HITL ✅ (added in Stage 1). The token
stays central. Follow-up: a readonly-scoped shared token re-enables true
`--read-only`.
