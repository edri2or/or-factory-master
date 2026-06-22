- **Agent-as-a-folder standard — Change 1 of 8 (`agent-folder-structure`).** Introduced the canonical
  `agents/<name>/` folder format as the future single source of truth for a specialist agent: a new
  `templates/system/agents/_spec/agent-folder.spec.md` plus JSON schemas `_spec/agent.schema.json` and
  `_spec/tools.schema.json`. The standard defines the three required files — `agent.yaml` (identity +
  routing), `instructions.md` (the `@@SYSTEM_MESSAGE@@` role body), `tools.yaml` (the known tool set) —
  with **every field mapped to its existing source of truth** (`templates/n8n/subagent.contract.md`,
  `subagent.template.json`, `workflows/n8n/agents.manifest.json`, `templates/agent-design-spec.md`),
  nothing invented. It restates the inviolable sub-agent contract (executeWorkflowTrigger in, `{reply}`
  out, no Telegram node — still enforced by `check-agent-single-voice.sh`) and the two-phase placeholder
  rule (scaffold-time `@@AGENT_SLUG@@`/`@@SYSTEM_MESSAGE@@`/`@@MODEL@@` vs install-time `@@CRED_*@@` etc.),
  so the deterministic compiler authored in a later stage cannot drift and the downstream
  `configure-agent-router.yml` install path stays byte-compatible. This is an **additive overlay,
  documentation-only** — it touches no live workflow JSON and changes nothing a freshly-provisioned
  system runs today. Documented one verified wrinkle for the compiler stage: the committed
  `code-agent.json` omits the template's "You return your answer to the orchestrator…" sentence, so the
  guaranteed fixed prompt tail is defined to begin at " Answer in the user's language…". Refreshed the
  system golden (`tests/golden/system/`).
- **Agent-as-a-folder standard — Change 2 of 8 (`agent-folder-structure`).** Authored the first real
  agent-folder, `templates/system/agents/code/` (`agent.yaml` + `instructions.md` + `tools.yaml`),
  faithfully representing today's committed `workflows/n8n/code-agent.json` — the round-trip proof
  target for the deterministic compiler (Change 3). Every value is extracted verbatim from the existing
  artifacts: `model`/`temperature` from the `OpenRouter Chat Model` node, `description`/`intent`/
  `confidence_threshold` from the `code` row of `agents.manifest.json`, and `instructions.md` is the
  `Code Reply` chainLlm system-message body **minus** the compiler's fixed tail and style-profile clause
  (confirmed byte-exact against the committed prompt). `code` is a no-tools `single-llm` agent, so
  `tools.yaml` is `tools: []`. Both YAML files validate against the Change-1 schemas
  (`_spec/agent.schema.json` / `_spec/tools.schema.json`). This is **doc/content-only** — it adds no
  compiler and changes nothing a freshly-provisioned system runs today (the live install path still
  consumes the committed JSON). Refreshed the system golden (`tests/golden/system/`).
