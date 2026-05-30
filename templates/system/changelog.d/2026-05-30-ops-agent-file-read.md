## feat: ops-agent reads repo files + accurate tool-awareness

| Type | Summary |
|---|---|
| feat | `github_readonly` gains a `read_file:<path>` command (e.g. `read_file:AGENT.md`) that reads the text contents of a file in this repo via the GitHub Contents API (base64-decoded, capped at 16 000 chars; directory paths return a listing; files >1 MB are out of scope), read-only. Separately, the agent's authoritative SYSTEM-INFO capability card now lists the system's live read sources — n8n workflows, the fixed Postgres query set, GitHub (CI runs / commits / open PRs / file contents) and Railway (deploy status / logs) — so the bot describes those capabilities accurately instead of denying them when asked generally. No writes; no new secret. |
