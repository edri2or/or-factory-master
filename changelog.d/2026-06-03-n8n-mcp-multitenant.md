## feat: n8n-mcp gateway multi-tenant — serve any system, each isolated

| Type | Summary |
|---|---|
| feat | Generalize the live-write gateway from the single-system hardwire to **all systems**. `N8N_DEV_ALLOWED_SYSTEMS` now supports `"*"` = any syntactically-valid system name (`^[a-z][a-z0-9-]{4,28}[a-z0-9]$`); the deploy sets `"*"`. Per-request isolation is unchanged and already correct — each `/n8n/<system>/mcp` call injects only that system's `n8n-api-key` (via `resolveN8nTarget`), an unknown/unprovisioned system fails cleanly (resolve → 404/502), and a system-scoped `n8n-dev` bearer stays hard-bound to its own system. The only interactive caller is the Google-authed operator, who may reach any of his own systems. CSV pinning still supported. Unit-tested (`test/n8n-mcp-proxy-wildcard.test.mjs`); full suite green. |
