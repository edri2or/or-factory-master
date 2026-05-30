## docs: explicit polling protocol in CLAUDE.md "How to work" step 4

| Type | Summary |
|---|---|
| docs | The "Watch the run" step now carries a concrete polling protocol — call `get_workflow_run` (factory MCP) every ~30s, up to 40 iterations (~20 min), wait while `in_progress`/`queued`, verify on `success`, read failed logs via `get_run_jobs` on `failure`/`cancelled`, and never advance without a confirmed terminal status. It also names the structural limit (the browser session can't listen for events between messages) and points at the in-run provision Telegram nudge as the out-of-band wake-up. Replaces the vague "Poll the workflow run." line so a session no longer "waits" indefinitely. |

## feat: in-run Telegram session nudge on provision success

| Type | Summary |
|---|---|
| feat | `provision-system.yml` now sends Or a Hebrew Telegram nudge (`✅ provision-system הסתיים בהצלחה — חזור לסשן` + system name + run URL) from a final `if: success()` step **inside its own run**, so he can return to an idle browser Claude Code session the moment provisioning finishes. Reuses the job's already-authenticated WIF to read `telegram-bot-token`/`telegram-chat-id` from Secret Manager (masked via `::add-mask::` on read); `continue-on-error`, so it can never break a provision. Success only — the failure path already pings Telegram via the existing `Emit provision failed` step. This replaces an earlier `workflow_run`-triggered listener (`notify-workflow-complete.yml`, now removed): GitHub does not emit `workflow_run` for the broker-App/bot-dispatched runs the factory uses, so an external listener never fired — verified by two clean test provisions that produced zero listener runs. An in-run step fires reliably regardless of who dispatched the workflow. |
