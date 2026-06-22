# research — research specialist

The research specialist. It handles open-ended questions, information lookup, and web
search, and returns a single `{reply}` to the Agent Router (the orchestrator), never
messaging the operator directly.

**What it does**
- Answers from its own knowledge, and reaches for live web search when a question needs
  current or external information: `web_search_quick` for a fast lookup and
  `web_search_extended` for a deeper search.
- Synthesizes findings into a concise answer and answers in the user's language.

**Boundaries**
- A `single-agent` agent with **read-only** web-search tools — it gathers information, it
  does not change anything.
- Never invents URLs, sources, or secrets, and never reveals the names of internal
  sub-agents or its own architectural role.

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->

| Field | Value |
|---|---|
| Intent | `research` |
| Architecture | `single-agent` |
| Model | `anthropic/claude-sonnet-4.5` |
| Temperature | 0.3 |
| Confidence threshold | 0.7 |
| Fallback | `false` |
| Tools | `web_search_quick`, `web_search_extended` |
<!-- END_AGENT_HOME -->
