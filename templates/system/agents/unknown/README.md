# unknown — general chat + fallback

The general-conversation agent and the system's **fallback**: the default the Agent Router
dispatches when no other intent matches. It carries system awareness and the full read-only
system toolset, and returns a single `{reply}` to the Agent Router (the orchestrator), never
messaging the operator directly.

**What it does**
- Handles open chat and any unclassified request, with memory of the conversation
  (`memory: postgres`).
- Answers questions about the live system through **read-only** tools: `list_workflows` +
  `recent_errors` (live n8n state), `postgres_named_query` (whitelisted read-only SELECTs),
  `github_readonly` (CI runs / commits / open PRs / `read_file:<path>`), and
  `railway_readonly` (deploy status / logs) — so general chat can answer GitHub / file /
  Railway questions in any phrasing.
- Looks things up on the web with `web_search_quick` / `web_search_extended`.
- Routes every **state-changing** request through the HITL `request_write_action` gate —
  the operator approves with a ✅ tap before anything runs. It never performs a write directly.

**Boundaries**
- Read-first: every inspection tool is read-only; the only path to a side effect is the
  human-in-the-loop approval gate.
- It never invents file paths, URLs, or system facts, and never reveals the names of
  internal sub-agents or its own architectural role.

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->

| Field | Value |
|---|---|
| Intent | `unknown` |
| Architecture | `single-agent` |
| Model | `openrouter/auto` |
| Temperature | 0.3 |
| Confidence threshold | 0.0 |
| Fallback | `true` |
| Tools | `list_workflows`, `recent_errors`, `postgres_named_query`, `github_readonly`, `railway_readonly`, `request_write_action`, `web_search_quick`, `web_search_extended` |
<!-- END_AGENT_HOME -->
