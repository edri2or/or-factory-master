# Changelog fragment — spend-total-named-query (2026-05-30)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: spend_total read-only named query (bot can answer "how much have I spent")

| Type | Summary |
|---|---|
| feat | Ports a change first proven by hand on a live system (factory-test-028) into the factory template so every new system inherits it: the bot can now answer cost questions via a fifth whitelisted read-only query, with no free SQL and no write path. `templates/system/workflows/n8n/postgres-named-queries.json` gains a `spend_total` branch — `Normalize Input` accepts the name, `Route by Query Name` gets a 5th rule (`outputKey: spend_total`; the `unknown_query` fallback shifts to the last output), and a new `Q: spend_total` Postgres node (`onError: continueRegularOutput`, `alwaysOutputData: true`) runs `SELECT … last_cum_usd … FROM spend_track_state` (authoritative cumulative USD) plus a `spend_log` cross-check (`logged_usd`, `log_rows`); connections + the `Unknown Query` error list updated to match. `ops-agent.json` + `unknown-agent.json`: the `postgres_named_query` tool description now lists `spend_total` (5 names), explains the returned fields (`total_usd`, `as_of`, `logged_usd`, `log_rows`), and when to call it — without it the tool exists but the model won't know to use it. Reuses the existing hourly `spend-track` workflow's data; read-only, inside the existing whitelist; no schema change, no new secret. |
