# <name> — <one-line role>

<!--
Scaffold for a new agent-folder README. Copy this file to agents/<name>/README.md, then:
  1. Replace the heading + prose below with a short, human description of THIS agent —
     what it does and its boundaries (see the existing agents/*/README.md for the shape).
  2. Run:  bash scripts/build-agent-readme.sh <name>
     to fill the managed block from agent.yaml + tools.yaml.
The CI gate scripts/check-agent-readme.sh then keeps the two in sync.
The prose is yours; the block between the markers is machine-generated — never edit it by hand.
-->

A one-paragraph, human-readable description of the agent's role: what it answers, and that
it returns a single `{reply}` to the Agent Router (the orchestrator), never messaging the
operator directly.

**What it does**
- …

**Boundaries**
- …

> The block below is generated from `agent.yaml` + `tools.yaml` by `scripts/build-agent-readme.sh`.
> Edit the YAML (not this block); the README drift gate keeps the two in sync.

<!-- BEGIN_AGENT_HOME -->
<!-- END_AGENT_HOME -->
