## feat: ops-agent live read-only GitHub + Railway telemetry

| Type | Summary |
|---|---|
| feat | The `ops-agent` ships with two live read-only tools alongside `postgres_named_query`: `github_readonly` (recent CI runs / commits / open PRs for this repo, as the system's own GitHub App — a short-lived installation token is minted inside n8n with the built-in JWT node and cached) and `railway_readonly` (latest deploy status / recent deployment logs). Both are `toolWorkflow` sub-workflows wired by `configure-agent-router.yml`, each gated on its secrets (`github-app-*` / `railway-api-token`) and `jq`-stripped from `ops-agent` when absent. Direct `github.com` / `railway.app` / `railway.com` links pass the router's egress allow-list. Read-only — no writes or mutations. |
