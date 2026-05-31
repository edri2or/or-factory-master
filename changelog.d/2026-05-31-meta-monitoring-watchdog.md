## feat: שומר-העל — שלב 1 (יסוד + workflows מתוזמנים + שער-CI + dead-man's-switch)

| Type | Summary |
|---|---|
| feat | Meta-monitoring watchdog stage 1: `monitoring/watchdog-registry.json` source-of-truth catalog + `scripts/run-watchdog.sh` (gh-run-freshness proof, 2-consecutive-failures rule, Hebrew Telegram report with direct evidence links) + `meta-monitoring-watchdog.yml` (daily 05:00 UTC) proving the 4 scheduled factory workflows ran + emitting `factory.watchdog.{ok,degraded}`. |
| feat | CI registry gate `scripts/check-watchdog-registry-updated.sh` (twin of `check-devplan-updated.sh`, wired into the `Changelog gates` job) blocks adding/removing a workflow/n8n/hook surface without updating the registry; `monitoring/registry-exempt.txt` allowlists deliberately-unmonitored one-shots. |
| feat | External dead-man's-switch `scripts/create-watchdog-heartbeat.sh` (Better Stack heartbeat, idempotent, URL stored in SM `watchdog-heartbeat-url`); the watchdog pings it every run so its own silent death is caught externally. |
| feat | Allowlisted `meta-monitoring-watchdog.yml` on the MCP `dispatch_workflow` tool (`services/mcp-server/src/tools.ts`) so the agent can run the one-time `setup_heartbeat=true` heartbeat setup + ad-hoc watchdog runs autonomously (no operator click). Cron operation is unchanged; the only write the dispatch enables is the guarded one-time SM `watchdog-heartbeat-url` write. |
