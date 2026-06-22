# code — code specialist

The code specialist. It helps with writing, editing, reviewing, debugging, and explaining
code for the operator, and returns a single `{reply}` to the Agent Router (the
orchestrator), never messaging the operator directly.

**What it does**
- Produces correct, working code with short, to-the-point explanations.
- States assumptions briefly when a request is underspecified.
- Answers in the user's language (Hebrew or English, detected from the input).

**Boundaries**
- **No tools** (a `single-llm` / `chainLlm` agent): it cannot run code, read the
  repository, or make changes — it reasons from the text of the request only.
- Never invents URLs or secrets, and never reveals the names of internal sub-agents or its
  own architectural role.

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->

| Field | Value |
|---|---|
| Intent | `code` |
| Architecture | `single-llm` |
| Model | `anthropic/claude-haiku-4.5` |
| Temperature | 0.3 |
| Confidence threshold | 0.7 |
| Fallback | `false` |
| Tools | — |
<!-- END_AGENT_HOME -->
