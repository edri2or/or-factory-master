# Changelog fragment — style-refresh-daily (2026-05-30)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: style-refresh runs daily instead of weekly

| Type | Summary |
|---|---|
| feat | The per-system `style-refresh` workflow now re-learns the operator's chat style **daily** instead of weekly, so the bot adapts within a day rather than up to a week. `templates/system/workflows/n8n/style-refresh.json`: cron `0 3 * * 0` → `0 3 * * *` and the trigger node renamed `Weekly Sun 03:00` → `Daily 03:00` (node + its `connections` key, kept consistent). `configure-agent-router.yml` install log/summary updated (weekly → daily), and `AGENTS.md.template` documents the daily cadence. Template-only; read-only style extraction (one extra cheap Haiku call/day); no schema change, no new secret. |
