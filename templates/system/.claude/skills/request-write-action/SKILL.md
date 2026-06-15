---
name: request-write-action
description: >-
  The human-in-the-loop write-request gate — turns a proposed state change into a Telegram approval card; the operator's tap then routes to pending-actions-executor. Load this skill to understand, run, develop, or reason about THIS
  system's "request-write-action" n8n workflow — the HITL write-request gate (propose -> approve -> execute). It is a map, not a manual: it routes
  you to the live workflow via the n8n-live and factory MCP servers (.mcp.json)
  and AGENTS.md, never to hard-coded ids or secrets. Triggers on request-write-action, hitl, write action, approval, pending actions.
---

# request-write-action

This skill describes the **`request-write-action`** n8n workflow shipped into this system by
`or-factory-master`. It is a **map, not a manual** — the live values (workflow id,
URL, secret values) live in **`AGENTS.md`** and the running n8n, never here.

## What it is

The human-in-the-loop write-request gate — turns a proposed state change into a Telegram approval card; the operator's tap then routes to pending-actions-executor. Trigger: invoked as a sub-workflow; pairs with pending-actions-executor.

## Read its live state first (read-only)

- **`factory` MCP** (`.mcp.json`) — `list_n8n_workflows`, `inspect_n8n_execution`,
  and this system's `/mcp/system-tools` named queries — see how `request-write-action` actually ran
  before you touch anything.
- **`AGENTS.md`** (repo root) — the system's live tables, secret **names** (never
  values), and the agent roster.

## Run / develop it

- **`n8n-live` MCP** (`.mcp.json`) — run and develop `request-write-action` against this system's
  OWN live n8n. Live writes are **scratch-only** (`dev-*` names); git stays the
  source of truth.
- Change `request-write-action` in git and re-import it via the system's `configure-agent-router.yml`; never hand-edit the published workflow in the n8n UI.

## The invariants — never break these

- **Writes are human-gated (HITL).** Any state change is *proposed*, then a human ✅
  approves via `request_write_action` / `pending-actions-executor`. Never self-approve.
- **Secrets are names only.** Never echo, print, or log a Secret Manager value or any
  minted token.
- **`main` is protected.** Workflow JSON changes land via PR + green CI, never a
  direct push.

## See also

`operate-this-system` (the system-wide map) and `AGENTS.md` (this system's live values).
