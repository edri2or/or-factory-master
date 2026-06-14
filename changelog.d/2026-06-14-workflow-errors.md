# Changelog fragment — fix recurring n8n SQL errors (2026-06-14)

## fix(templates): repair style-refresh + tg-proactive Postgres queries

| Type | Summary |
|---|---|
| fix | `templates/system/workflows/n8n/style-refresh.json` and `tg-proactive.json` failed on **every** cron run (03:00 + 08:00 UTC) on every provisioned system. Both inlined the chat id with the unquoted n8n-expression form `{{ '@@CHAT_ID@@' }}`, which the n8n 2.x Postgres SQL editor renders into a broken token — `tg-proactive` › "Aggregate Stats" → `column "<id>" does not exist`; `style-refresh` › "Upsert Style Profile" → `Syntax error … near "language_primary"` (lost JSON quoting). Switched both to the proven-working pattern already used by `postgres-named-queries.json` / `ops-agent.json`: `chat_id = @@CHAT_ID@@` (bare numeric, `chat_id` is `BIGINT`), `session_id = 'tg:' \|\| '@@CHAT_ID@@'` (single-quoted), and for the profile a SQL-escaped `profile_sql` minted in the "Validate JSON" Code node and inserted as `'{{ … }}'::jsonb`. Proven live on `or-edri-4` first, then locked into the template. Golden refreshed. |
