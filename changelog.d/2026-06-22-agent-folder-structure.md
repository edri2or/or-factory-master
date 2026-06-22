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
- **Agent-as-a-folder standard — Change 3 of 8 (`agent-folder-structure`).** Added the deterministic,
  non-AI agent-folder compiler `scripts/compile-agent.sh` (bash + `jq` + a one-line Python YAML→JSON
  bridge — the repo deliberately avoids `yq`, whose build is environment-dependent) plus its round-trip
  brick-proof `scripts/tests/compile-agent.bats` (6 tests, run in the **Playground tests** BATS job).
  The compiler reads a canonical `agents/<name>/` folder and emits the n8n workflow JSON to STDOUT:
  it fills the scaffold-time tier (`@@AGENT_SLUG@@` → workflow + node name, the built system message,
  `@@MODEL@@` + temperature) and **leaves the install-time `@@…@@` tokens intact** so the downstream
  `configure-agent-router.yml` `sed` pass stays byte-compatible. The system message is **built**
  (`"=" + instructions.md body + the fixed tail + the style-profile clause`), not substituted into the
  template's message string — the base scaffold hard-codes a "You return your answer to the orchestrator…"
  sentence the committed agents omit. **v1 = no-tools agents only** (refuses a tool-carrying agent with a
  clear message; tool-node injection is a later sub-step). The proof asserts `compile-agent.sh code`
  reproduces the committed `code-agent.json` **semantically exactly** via a normalized diff that reuses
  `scripts/lib/normalize-n8n.sh` extended to strip every nested `.id` — so the byte-exact question is
  settled by normalizing ids away rather than a `node_id_prefix`. **Two scope refinements (both
  risk/cost-reducing):** the live or-edri-4 proof is deferred to Change 5 (in Change 3 the compiler is
  wired into nothing live, so there is no live path to prove), and the shipped system copy
  (`templates/system/scripts/compile-agent.sh`) is deferred to Change 5 too (ships with the wiring that
  uses it, avoiding dead code) — so Change 3 touches no `templates/system/**` file and needs no golden
  refresh. Factory-side only; nothing a provisioned system runs changes.
