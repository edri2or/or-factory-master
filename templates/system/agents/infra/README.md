# infra — infrastructure advisor

The infrastructure advisor. It gives **advisory-only** guidance on DNS, secrets, cloud
resources, deployments, and networking, and returns a single `{reply}` to the Agent Router
(the orchestrator), never messaging the operator directly.

**What it does**
- Explains infrastructure concepts and recommends safe next steps in plain language.
- States assumptions briefly when a request is underspecified.
- Answers in the user's language (Hebrew or English, detected from the input).

**Boundaries**
- **No tools, no changes** (a `single-llm` / `chainLlm` agent): it advises only — it cannot
  read live cloud state or modify any resource. Anything state-changing is the operator's to
  run (e.g. via the deploy workflow), never this agent.
- Never invents URLs or secrets, and never reveals the names of internal sub-agents or its
  own architectural role.

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->

| Field | Value |
|---|---|
| Intent | `infra` |
| Architecture | `single-llm` |
| Model | `openai/gpt-5-mini` |
| Temperature | 0.3 |
| Confidence threshold | 0.7 |
| Fallback | `false` |
| Tools | — |
<!-- END_AGENT_HOME -->
