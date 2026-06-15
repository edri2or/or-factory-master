# Capabilities — what this system can actually do

> Read this before telling the operator (or yourself) that the system "can't" do something.
> A fresh Claude session, or the Telegram bot, should orient from here — not guess. The
> per-system specifics (names, URLs, secrets) live in `AGENTS.md`; this file is the **map of
> live capabilities** and how to reach them.
>
> **One rule:** capabilities are **install-conditional** — a tool is wired **only** when its
> credential exists in Secret Manager. `configure-agent-router.yml` injects a `SYSTEM-INFO`
> block into the bot's prompt whose `capabilities.live_read_sources` lists exactly what is
> installed and `capabilities.degraded` lists what is off. Trust that block (and this file),
> not an assumption.

## Live, read-only tools the bot carries (`ops-agent` + `unknown-agent`)

| Capability | How to use it | Installed when |
|---|---|---|
| **Read this repo's files / CI / commits / PRs** (`github_readonly`) | one string: `ci_runs` \| `recent_commits` \| `open_prs` \| `read_file:<path>` (e.g. `read_file:AGENTS.md`; a directory path lists its entries) | the `github-app-*` secrets exist |
| **Read live Railway state** (`railway_readonly`) | one string: `deploy_status` \| `recent_logs` | `railway-api-token` exists |
| **Query the system's own Postgres** (`postgres_named_query`) | one of the **eight** whitelisted named queries below (no free SQL) | a Postgres credential exists |
| **Know where/what it is** (`SYSTEM-INFO`) | injected into the prompt at configure time — `system_name`, `n8n_domain`, `gcp_project_id`, `gcp_region`, `runtime`, `capabilities` | always |
| **Resolve a misspelled file name** (file resolver, in the Agent Router) | fuzzy-matches a mentioned file against the hourly `file_catalog` snapshot, then reads it | Postgres + `github-app-*` exist |

If a credential is missing the matching tool is **stripped cleanly** (never a dangling
reference) and shows up under `capabilities.degraded` — so "not installed" is visible, not silent.

## The eight named queries (`postgres_named_query`)

`style_profile_get` · `recent_audit_log` · `pending_actions_open` · `executions_summary_24h` ·
`spend_total` · `conversation_transcript` · `tool_trace_recent` · `claim_actual_mismatch`

### Reading the bot's own conversation and "black box"

- **`conversation_transcript`** — the full operator↔bot transcript, word-for-word.
- **`tool_trace_recent`** — the per-tool **attempt→result** trace (from `agent_trace_events`):
  every tool the bot tried, with status (`attempted`/`ok`/`error`) and a short in/out summary.
- **`claim_actual_mismatch`** — flags a tool the bot *claimed* it ran but that silently did
  nothing (claim vs. actual), the single best signal for "the bot said it did X but didn't".

These are reachable **to the bot** as the `postgres_named_query` tool, and **externally** (e.g.
from a Claude Code session) over this system's own outward MCP endpoint
`https://<n8n_domain>/mcp/system-tools` (Bearer = the `n8n-mcp-server-token` secret). So a
session never has to reverse-engineer how to read the bot's history — it is one named query.

## Built-in MCP connections (Claude Code sessions on this repo)

The committed `.mcp.json` connects every session to two gateway surfaces (auth is the
gateway's own Google login — zero secrets in the repo):

- **`factory`** (`/mcp`) — read-only verify/inspect over this system's GCP, Railway, Cloudflare,
  n8n and CI, plus the allowlisted `dispatch_workflow`.
- **`n8n-live`** (`/n8n/<system>/mcp`) — browse, validate, and develop workflows against this
  system's live n8n. Live writes are scratch-only (`dev-*` names); git stays the source of truth.

## Per-workflow capability cards (`.claude/skills/<name>/`)

Every operable n8n workflow this system runs has a paired Claude skill at
`.claude/skills/<name>/SKILL.md` — the folder name is the `/<name>` slash command. Each is a
**map, not a manual**: it routes a session to the live workflow (via the `n8n-live`/`factory` MCP
servers and `AGENTS.md`) and to the HITL `request_write_action` guardrail, without restating any
live value. Pure-plumbing workflows (crons, sinks, one-shots, media sub-workflows) deliberately
have no card — they are listed in `monitoring/workflow-skill-exempt.txt`. CI
(`scripts/check-workflow-skill-pair.sh`, in `pipeline-tests`) blocks any operable workflow that
lacks its card.

## Where the details are

- `AGENTS.md` — system identity, the full Postgres table list, the system-aware tool
  descriptions, and the Secret Manager inventory (names only).
- The factory's `docs/telegram-chat-bot.md` (in `edri2or/or-factory-master`) — the full Hebrew
  reference for the chat bot, its workflows, and the deferred follow-ups.
