# Changelog fragment — ops-agent-file-read (2026-05-30)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## fix: ops-agent-file-read — SYSTEM-INFO capability card lists the live GitHub/Railway read sources (Stage 1)

| Type | Summary |
|---|---|
| fix | Stage 1 of the ops-agent-file-read follow-up. Live testing of the previous wave showed the bot, when asked generally ("what can you do?" / "read a file"), listing only the three old tools and **refusing** GitHub questions — even though it used `github_readonly` correctly when asked directly. Root cause: the `SYSTEM_INFO_JSON` injected into the ops/unknown agents' systemMessage by `configure-agent-router.yml` still advertised `capabilities.tools:["list_workflows","recent_errors","postgres_named_query"]`, and that block is framed as authoritative ("never invent"), so the stale card overrode the (correct) tool list in the prose. Replaced the per-agent-inaccurate `tools` array with a system-level `capabilities.live_read_sources` that names what the system can read live, read-only: n8n workflows + executions, the fixed Postgres query set, **GitHub for this repo (recent CI runs, commits, open PRs, and file contents via `read_file:<path>`)**, and **Railway (deploy status + recent logs)** — with a comment explaining the card must stay in sync because it is authoritative. Verified locally: `yamllint` clean, `shellcheck -S error` clean on the run script, and the `jq` builds valid JSON with `edri2or/<system>` interpolated and four `live_read_sources` entries. Template-only. |
