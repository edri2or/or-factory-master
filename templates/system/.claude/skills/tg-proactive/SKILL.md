---
name: tg-proactive
description: >-
  The proactive-outreach worker — on a schedule it decides whether the bot should message the operator first (reminders, nudges). Load this skill to understand, run, develop, or reason about THIS
  system's "tg-proactive" n8n workflow — the scheduled proactive-message worker that lets the bot reach out first. It is a map, not a manual: it routes
  you to the live workflow via the n8n-live and factory MCP servers (.mcp.json)
  and AGENTS.md, never to hard-coded ids or secrets. Triggers on tg-proactive, proactive, reminder, nudge, scheduled.
---

# tg-proactive

This skill describes the **`tg-proactive`** n8n workflow shipped into this system by
`or-factory-master`. It is a **map, not a manual** — the live values (workflow id,
URL, secret values) live in **`AGENTS.md`** and the running n8n, never here.

## What it is

The proactive-outreach worker — on a schedule it decides whether the bot should message the operator first (reminders, nudges). Trigger: a schedule (cron).

## Read its live state first (read-only)

- **`factory` MCP** (`.mcp.json`) — `list_n8n_workflows`, `inspect_n8n_execution`,
  and this system's `/mcp/system-tools` named queries — see how `tg-proactive` actually ran
  before you touch anything.
- **`AGENTS.md`** (repo root) — the system's live tables, secret **names** (never
  values), and the agent roster.

## Run / develop it

- **`n8n-live` MCP** (`.mcp.json`) — run and develop `tg-proactive` against this system's
  OWN live n8n. Live writes are **scratch-only** (`dev-*` names); git stays the
  source of truth.
- Change `tg-proactive` in git and re-import it via the system's `configure-agent-router.yml`; never hand-edit the published workflow in the n8n UI.

## The invariants — never break these

- **Writes are human-gated (HITL).** Any state change is *proposed*, then a human ✅
  approves via `request_write_action` / `pending-actions-executor`. Never self-approve.
- **Secrets are names only.** Never echo, print, or log a Secret Manager value or any
  minted token.
- **`main` is protected.** Workflow JSON changes land via PR + green CI, never a
  direct push.

## See also

`operate-this-system` (the system-wide map) and `AGENTS.md` (this system's live values).
