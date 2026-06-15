---
name: research-agent
description: >-
  The research specialist — answers research / lookup questions and can hand a heavy job to deep-research, returning {reply} to the orchestrator. Load this skill to understand, run, develop, or reason about THIS
  system's "research-agent" n8n workflow — the research specialist the Agent Router dispatches for research questions. It is a map, not a manual: it routes
  you to the live workflow via the n8n-live and factory MCP servers (.mcp.json)
  and AGENTS.md, never to hard-coded ids or secrets. Triggers on research-agent, research, lookup, web search.
---

# research-agent

This skill describes the **`research-agent`** n8n workflow shipped into this system by
`or-factory-master`. It is a **map, not a manual** — the live values (workflow id,
URL, secret values) live in **`AGENTS.md`** and the running n8n, never here.

## What it is

The research specialist — answers research / lookup questions and can hand a heavy job to deep-research, returning {reply} to the orchestrator. Trigger: invoked by the Agent Router (returns the {reply} contract).

## Read its live state first (read-only)

- **`factory` MCP** (`.mcp.json`) — `list_n8n_workflows`, `inspect_n8n_execution`,
  and this system's `/mcp/system-tools` named queries — see how `research-agent` actually ran
  before you touch anything.
- **`AGENTS.md`** (repo root) — the system's live tables, secret **names** (never
  values), and the agent roster.

## Run / develop it

- **`n8n-live` MCP** (`.mcp.json`) — run and develop `research-agent` against this system's
  OWN live n8n. Live writes are **scratch-only** (`dev-*` names); git stays the
  source of truth.
- It is invoked by the **Agent Router** (never by the operator directly) and returns the fixed `{reply}` contract — see the `agent-router` skill and `templates/n8n/subagent.contract.md`. Change its prompt/tools in git and re-import via `configure-agent-router.yml`; do not hand-edit the published workflow.

## The invariants — never break these

- **Writes are human-gated (HITL).** Any state change is *proposed*, then a human ✅
  approves via `request_write_action` / `pending-actions-executor`. Never self-approve.
- **Secrets are names only.** Never echo, print, or log a Secret Manager value or any
  minted token.
- **`main` is protected.** Workflow JSON changes land via PR + green CI, never a
  direct push.

## See also

`operate-this-system` (the system-wide map) and `AGENTS.md` (this system's live values).
