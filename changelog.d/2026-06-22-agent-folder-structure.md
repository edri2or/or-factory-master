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
- **Agent-as-a-folder standard — Change 4 of 8 (`agent-folder-structure`).** Added the fail-closed CI gate
  `scripts/check-agent-folder.sh` (+ its teeth-proving test `scripts/tests/check-agent-folder.bats`, 8
  tests) and wired it into the **Changelog gates** job (the required, merge-blocking context) of
  `.github/workflows/changelog-check.yml`. The gate enforces two invariants over `templates/system/agents/`:
  (1) **schema** — every `agents/<name>/` folder has the 3 required files and its `agent.yaml`/`tools.yaml`
  validate against `agents/_spec/*.schema.json` (required keys, types, enums, patterns,
  `additionalProperties:false`), via a pure `python3`+`pyyaml` draft-07 subset checker (no `jsonschema`
  dep); and (2) **generated-in-sync** — for every foldered agent that also has a committed
  `workflows/n8n/<name>-agent.json`, the deterministic compiler must reproduce it semantically (normalized
  diff = empty, reusing the Change-3 normalizer), locking the folder and the JSON together through the
  transition (skipped for tool-carrying agents until the compiler grows tool injection). It is a **no-op
  clean PASS** when there is no `agents/` dir, so it is safe anywhere. The step adds a `pyyaml` guard
  mirroring the compiler's YAML→JSON bridge. **Scope refinement (consistent with Change 3):** wired into
  the **factory** workflow only — the system-side `templates/system/.github/workflows/changelog-check.yml`
  wiring (and shipping `check-agent-folder.sh` + the compiler into systems via `provision-system.yml`) is
  deferred to **Change 7**, when agent-folders actually ship into systems; until then a system has no
  `agents/` dir to gate. So Change 4 touches no `templates/system/**` file and needs no golden refresh.
- **Agent-as-a-folder standard — Change 5 of 8 (`agent-folder-structure`): wire the compiler into the
  assembly engine.** Relocated the compiler to `templates/system/scripts/compile-agent.sh` (single source
  of truth — its default paths resolve relative to its parent dir, so the same file works unflagged in the
  factory checkout AND inside a provisioned system repo) and taught the system's
  `configure-agent-router.yml` to **regenerate each agent's n8n JSON from its canonical `agents/<slug>/`
  folder** (via the compiler) before the existing install-time `sed` pass. The wiring is **purely additive
  and soft-fail**: it regenerates only agents that have a compilable folder (no-tools, compiler v1) and
  **falls back to the committed `workflows/n8n/<name>.json`** for any agent not yet foldered or carrying
  tools, so the install path can never regress. Today only `code` is foldered, so only `code` is folder-
  driven; the other four still come from their committed JSON until Change 7. Verified by simulating the
  in-system invocation: the compiler runs with defaults, leaves the install-time `@@…@@` tokens intact,
  and the regenerated `code` JSON is **normalized-identical** to the committed `code-agent.json` (live
  behavior provably unchanged). Refreshed the system golden. **Live proof (required before merge):** this
  change touches `configure-agent-router.yml`, a behavior-bearing surface, so the `e2e-surfaces.json` E2E
  gate requires a fresh proof from the standing proving system **or-edri-4** — applied + proven live there
  (`e2e-verify.yml`, `target_ref=<branch>`) before this lands on `main`. **Scope:** shipping the compiler
  + agent-folders into NEW systems via `provision-system.yml` (and the system-side gate wiring) is deferred
  to Change 7; until then new systems gracefully fall back to committed JSON.
- **Agent-as-a-folder standard — Change 7 (7a+7b) of 8 (`agent-folder-structure`): compiler v2 + migrate
  all 5 agents (offline).** Generalized `compile-agent.sh` to **v2**: a **uniform system-message model**
  (the compiler appends ONLY the style-profile clause; `instructions.md` carries the full prompt body, so
  the v1 `FIXED_TAIL` is gone and `agents/code/instructions.md` now includes its own tail), an
  **architecture switch** (`single-llm`→`chainLlm`; `single-agent`→`@n8n/n8n-nodes-langchain.agent` v2.2
  with the prompt in `options.systemMessage`), **tool-node injection** from a per-tool **snippet library**
  `agents/_spec/tools/<tool>.json` (with per-agent description **overrides** at `agents/<name>/tools/<tool>.json`),
  optional Postgres chat **memory** (`memory: postgres` → the `Conversation Memory` node), and optional
  `reply_node_name` / `reply_expression` fields. Authored `agents/{infra,research,ops,unknown}/` (instructions
  + tool snippets **extracted byte-exact** from the committed JSONs) so **all 5 agents now round-trip
  empty** (normalized) against their committed `workflows/n8n/*-agent.json` — `code`, `infra` (no-tools),
  `research` (2 web tools), `ops` (7 tools), `unknown` (8 tools + memory). Expanded `tools.schema.json`'s
  enum to the real union (`n8n_api`/`list_workflows`/`recent_errors`/`web_search_quick`/`web_search_extended`
  + the sub-workflow/MCP tools), added the new `agent.schema.json` optional keys, updated
  `agent-folder.spec.md` to the v2 model, extended the round-trip normalizer to also `sort_by(.name)` the
  nodes array (emission order is cosmetic), and grew `check-agent-folder.sh` + `compile-agent.bats` (15
  tests) to round-trip **all** foldered agents. Offline only — no `workflows/n8n/*.json` changed, behavior
  unchanged. Still pending in Change 7: ship the compiler + folders into NEW systems via
  `provision-system.yml` + the system-side gate (7c), and the live or-edri-4 proof (7d). **Proven live on or-edri-4
  (the merge-blocking E2E proof):** applied to or-edri-4 via `refresh-system-agents.yml`
  (`source_ref=<branch>`, `paths=.github/workflows/configure-agent-router.yml,scripts/compile-agent.sh,agents`)
  → PR #45 merged + `configure-agent-router.yml` re-imported the router live; then `e2e-verify.yml`
  (`target_ref=<branch>`, `system_name=or-edri-4`) drove a real inbound message and the live bot replied,
  committing a fresh signed `e2e-proofs/agent-folder-structure.json` (`result: pass`) that satisfies the
  `e2e-surfaces.json` `proof_systems` pin to or-edri-4. (Journey note: the first refresh clone hit a
  transient "Repository not found"; a re-run succeeded cleanly — the broker has standing clone+push access
  to or-edri-4.)
- **Agent-as-a-folder standard — Change 6 of 8 (`agent-folder-structure`): `/build-agent` writes a
  folder.** Updated `.claude/commands/build-agent.md` (and its byte-identical system mirror via
  `scripts/sync-skills-mirror.sh`) so the scaffold step authors **one folder** `agents/<intent>/`
  (`agent.yaml`+`instructions.md`+`tools.yaml`, per `agents/_spec/agent-folder.spec.md`) and renders the
  n8n JSON with `scripts/compile-agent.sh` — instead of hand-copying `subagent.template.json`. Step 3
  collapsed from a 5-place hand-sync to "wire only the parts the compiler does NOT derive" (the
  orchestrator router branch / configure upsert entry / AGENTS catalogue / paired skill); the agent's
  identity + routing keys now live in `agent.yaml` as the source of truth, kept identical to the manifest
  row. Added `agent-folder.spec.md` to the Context reading, updated Safety-rule 1 and the worked example,
  and honestly flagged the **compiler v1 = no-tools** limit (a tool-carrying agent still authors its tool
  nodes by hand until the compiler grows tool injection in Change 7). The bottom-up capability-first
  discipline and the three ordered proof gates are unchanged. Doc-only; `check-skills-mirror.sh` green,
  golden refreshed.
