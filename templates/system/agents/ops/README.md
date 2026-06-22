# ops — operations specialist

The operations specialist for this self-hosted automation system. It answers operability
and telemetry questions — deployment status, service health, logs, CI runs, commits, pull
requests, and execution history — and returns a single `{reply}` to the Agent Router (the
orchestrator), never messaging the operator directly.

**What it does**
- Inspects the live system through **read-only** tools: the n8n API (workflow list +
  active/inactive state), `postgres_named_query` (a fixed whitelist of read-only SELECTs),
  `github_readonly` (CI runs / commits / open PRs / `read_file:<path>`), `railway_readonly`
  (deploy status / logs), and `factory_tools` (deeper read-only telemetry — execution
  failures, deployment history, job logs, endpoint probes).
- Reads Gmail / Calendar / Drive / Docs through `google_workspace` (read-only by default).
- Routes every **state-changing** request — running / activating / stopping an n8n
  workflow, triggering a GitHub Actions run, or any Google write — through the HITL
  `request_write_action` gate, so the operator approves with a ✅ tap before anything runs.
  It never performs a write directly.

**Boundaries**
- Read-first: all inspection tools are read-only; the only path to a side effect is the
  human-in-the-loop approval gate.
- It never invents file paths, URLs, or system facts, and never reveals the names of
  internal sub-agents or its own architectural role.

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->

| Field | Value |
|---|---|
| Intent | `ops` |
| Architecture | `single-agent` |
| Model | `anthropic/claude-sonnet-4.5` |
| Temperature | 0.3 |
| Confidence threshold | 0.7 |
| Fallback | `false` |
| Tools | `n8n_api`, `postgres_named_query`, `github_readonly`, `railway_readonly`, `request_write_action`, `google_workspace`, `factory_tools` |
<!-- END_AGENT_HOME -->
