## feat: bot can answer "how much have I spent"

| Type | Summary |
|---|---|
| feat | New read-only `spend_total` query in the `postgres_named_query` whitelist lets the bot report the system's cumulative AI/LLM spend in USD (from the existing hourly spend tracker) when you ask "how much have I spent" / "how much did the bot cost". No free SQL, no write path, no new secret — just a fifth pre-approved question the bot now knows about. |
