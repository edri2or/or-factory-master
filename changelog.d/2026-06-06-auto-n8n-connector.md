## feat: auto-notify every new system how to connect Claude to its n8n

Every newly-provisioned system now tells Or, at the end of a successful
deploy, how to connect Claude to its own n8n via the factory's central MCP
gateway (`factory-master-actions-mcp`). The gateway already serves any system
once its `n8n-api-key` is in SM; the only gap was the human notification.
Connection is by URL + "Login with Google" (no token), consistent with the
or-tok preference of not putting secrets in Telegram.

**Changes:**
- `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: new
  `Telegram connector nudge (success)` step after `Emit deploy completed`
  (`if: success()` + `continue-on-error: true`). Reads `telegram-bot-token` /
  `telegram-chat-id` from the system's OWN SM, masks each immediately, skips on
  a missing secret, and POSTs a plain-Hebrew message carrying the per-system
  connector URL `<gateway>/n8n/<system>/mcp`. The gateway base is the stable
  Cloud Run Region URL, hardcoded from fixed values (control project number +
  region).
- `templates/system/AGENTS.md.template`: new "Claude n8n connector" bullet
  under "What was provisioned".
- `tests/golden/system/`: golden refreshed (`check-system-golden.sh --update`)
  to absorb both template changes.

**Propagation:** provision-only — only systems built after this change get it;
existing systems (incl. or-tok) are not back-filled. No new infra, no extra
recurring cost.
