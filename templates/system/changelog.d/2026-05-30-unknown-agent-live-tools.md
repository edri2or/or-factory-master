## feat: general chat agent also gets the live GitHub/Railway readers

| Type | Summary |
|---|---|
| feat | `unknown-agent` (the general chat agent) now carries the same read-only `github_readonly` (CI runs / commits / open PRs / `read_file:<path>`) and `railway_readonly` (deploy status / logs) tools as `ops-agent`, wired to its `Chat Agent` with the systemMessage updated to describe them. This closes a routing gap: general-phrasing questions ("what can you do?", "what's in AGENT.md?") are classified to the general chat agent, which previously lacked these tools and therefore denied the capability. Both tools remain secret-gated and are `jq`-stripped from the agent when their secrets are absent. Read-only; no new secret. |
