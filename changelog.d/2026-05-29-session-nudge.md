## docs: explicit polling protocol in CLAUDE.md "How to work" step 4

| Type | Summary |
|---|---|
| docs | The "Watch the run" step now carries a concrete polling protocol — call `get_workflow_run` (factory MCP) every ~30s, up to 40 iterations (~20 min), wait while `in_progress`/`queued`, verify on `success`, read failed logs via `get_run_jobs` on `failure`/`cancelled`, and never advance without a confirmed terminal status. It also names the structural limit (the browser session can't listen for events between messages) and points at the new `workflow_run` Telegram nudge as the out-of-band wake-up. Replaces the vague "Poll the workflow run." line so a session no longer "waits" indefinitely. |

## feat: workflow_run Telegram nudge — notify-workflow-complete.yml

| Type | Summary |
|---|---|
| feat | New `.github/workflows/notify-workflow-complete.yml`: a `workflow_run: completed` listener over the four key factory workflows (`Provision System …`, `Deploy MCP Server …`, `Register System App …`, `Decommission Test System …`) that sends Or a Hebrew Telegram nudge (`✅ … הסתיים — חזור לסשן` / `❌ … לטיפול` + run URL) the moment a run finishes, so the interactive browser session stops being the agent's "alarm clock". Reuses only existing infra — WIF → Secret Manager (`telegram-bot-token`/`telegram-chat-id`) via the same auth pattern + SHA-pinned actions as `factory-health-audit.yml`; **no new GitHub secret, no AI, no token cost**. Secrets are `::add-mask::`-masked the instant they're read. It also emits one `factory.session_nudge.ready` event at `info` severity via `scripts/emit-event.sh` (info ⇒ Axiom only — never Telegram/Linear, so no duplicate ping, no stray Linear ticket). Every step is `continue-on-error`, so a notification can never break a run. Limitation: `workflow_run` is in-repo, so the per-system `deploy-railway-cloudflare.yml` (runs in a system repo) is not covered. |
