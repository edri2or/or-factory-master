# Changelog fragment — ops-agent-file-read (2026-05-30)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## fix: ops-agent-file-read — SYSTEM-INFO capability card lists the live GitHub/Railway read sources (Stage 1)

| Type | Summary |
|---|---|
| fix | Stage 1 of the ops-agent-file-read follow-up. Live testing of the previous wave showed the bot, when asked generally ("what can you do?" / "read a file"), listing only the three old tools and **refusing** GitHub questions — even though it used `github_readonly` correctly when asked directly. Root cause: the `SYSTEM_INFO_JSON` injected into the ops/unknown agents' systemMessage by `configure-agent-router.yml` still advertised `capabilities.tools:["list_workflows","recent_errors","postgres_named_query"]`, and that block is framed as authoritative ("never invent"), so the stale card overrode the (correct) tool list in the prose. Replaced the per-agent-inaccurate `tools` array with a system-level `capabilities.live_read_sources` that names what the system can read live, read-only: n8n workflows + executions, the fixed Postgres query set, **GitHub for this repo (recent CI runs, commits, open PRs, and file contents via `read_file:<path>`)**, and **Railway (deploy status + recent logs)** — with a comment explaining the card must stay in sync because it is authoritative. Verified locally: `yamllint` clean, `shellcheck -S error` clean on the run script, and the `jq` builds valid JSON with `edri2or/<system>` interpolated and four `live_read_sources` entries. Template-only. |

## feat: ops-agent-file-read — read_file:<path> command on github_readonly (Stage 2)

| Type | Summary |
|---|---|
| feat | Stage 2 of ops-agent-file-read. Adds a `read_file:<path>` command to `templates/system/workflows/n8n/github-readonly.json` so the ops-agent can read the text contents of a file in the system's repo, read-only. `Normalize Input` detects `read_file:<path>` on any string source using plain string ops (no regex → no JSON-escaping pitfalls), stripping a leading `:`/spaces and leading `/` while preserving subdirectory slashes, and emits `{command:"read_file", path}`. `Route by Command` gains a fourth rule; a new `GH File Contents` HTTP node GETs `/repos/edri2or/<system>/contents/<path>` (path from `$('Normalize Input')`, Bearer token, `onError:continueRegularOutput`); `Format Output` base64-decodes the file via `Buffer.from(content,'base64').toString('utf8')` (Buffer is a Node global — no `NODE_FUNCTION_ALLOW_BUILTIN` needed), caps content at 16 000 chars with a `truncated` flag, lists entries for a directory path, and flips `ok:false` on a 404/error envelope. `ops-agent.json`'s `github_readonly` tool description now documents `read_file:<path>` (e.g. `read_file:AGENT.md`). Files >1 MB (which need the `.raw` media type) are out of scope for v1. Verified locally: `jq .` valid on both files, all five Code nodes pass `node --check`, and a functional simulation confirmed the parse (incl. subdirs + leading-slash strip, and that `ci_runs`/`open_prs` are not mis-captured), the base64 decode, the directory listing, and the 404 → `ok:false`. No secret in JSON; token kept opaque. Template-only. |

## docs: ops-agent-file-read — document read_file + tool-awareness in the system template (Stage 3)

| Type | Summary |
|---|---|
| docs | Stage 3 (final) of ops-agent-file-read. `templates/system/AGENTS.md.template` now documents `read_file:<path>` in both the github-readonly sub-workflow bullet and the System-aware tools section (commands, `{path,size,content,truncated,html_url}` shape, directory-listing + >1 MB caveats). `templates/system/CHANGELOG.md` gets a `feat` row, plus a convention fragment `templates/system/changelog.d/2026-05-30-ops-agent-file-read.md`. Closes the development; the only remaining step is live verification on a fresh test system (separate, user-triggered). `validate-templates.sh` renders both templates cleanly (no new `${...}` placeholder). Template-only. |
