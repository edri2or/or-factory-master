# Agent-folder standard (`agents/<name>/`)

This is the canonical format for a specialist agent declared **as a folder** — the single
declarative source of truth from which the deterministic compiler (`scripts/compile-agent.sh`,
added in a later stage) derives the n8n workflow JSON the orchestrator runs. The agent is the
boss; n8n / Telegram are its tools.

> **Status — additive overlay, not a replacement (yet).** Until the compiler is wired into
> `configure-agent-router.yml`, the live install path still consumes the committed
> `workflows/n8n/<name>-agent.json`. This standard *describes* the source the compiler reads and
> the artifact it must reproduce **byte-for-byte**. Nothing here loosens the sub-agent contract
> (`templates/n8n/subagent.contract.md`) or the CI gate (`scripts/check-agent-single-voice.sh`).

Every field below is **mapped from an existing artifact** — `templates/n8n/subagent.contract.md`,
`templates/n8n/subagent.template.json`, `workflows/n8n/agents.manifest.json`, and
`templates/agent-design-spec.md`. Nothing is invented.

## Folder layout

```
agents/<name>/
├── agent.yaml          # identity + routing (required)
├── instructions.md     # the role body → @@SYSTEM_MESSAGE@@ (required)
├── tools.yaml          # the agent's tools (required; empty list for a no-tools agent)
├── prompts/            # optional — extra prompt fragments referenced by instructions.md
├── schemas/            # optional — JSON schemas for structured tool I/O
├── knowledge/          # optional — static reference text the agent may be primed with
└── tests/              # optional — golden routing/fixture cases for this agent
```

`<name>` is the agent **slug**: one lowercase word, `^[a-z][a-z0-9-]*$`, unique across `agents/`.
It is the same string that becomes the n8n workflow name `factory-master: <name>-agent`, the file
`workflows/n8n/<name>-agent.json`, and (for the routed agents) the manifest `intent`.

The `_spec/` folder (this file + the schemas) is the standard itself — it is **not** an agent and
the compiler/gate skip any folder whose name begins with `_`.

---

## `agent.yaml` — identity + routing

| Key | Required | Source of truth | Maps to |
|---|---|---|---|
| `slug` | yes | folder name | `@@AGENT_SLUG@@` → workflow name `factory-master: <slug>-agent`, file `workflows/n8n/<slug>-agent.json`, and the `<Slug> Reply` chainLlm node name |
| `intent` | routed agents | `agents.manifest.json` › `agents[].intent` | the classifier intent the router dispatches on (usually `== slug`) |
| `description` | yes | `agents.manifest.json` › `agents[].description` | the manifest registry description (the router's routing hint — keep it sharp; a vague description causes "context poisoning", design-spec §4) |
| `confidence_threshold` | routed agents | `agents.manifest.json` › `agents[].confidence_threshold` | router dispatch threshold; `0.7` for normal agents, `0.0` for the fallback |
| `fallback` | fallback only | `agents.manifest.json` › `agents[].fallback` | `true` only for the single fallback agent (`unknown`); omit otherwise |
| `model` | yes | `subagent.template.json` › `OpenRouter Chat Model.parameters.model` | `@@MODEL@@`. Default `openrouter/auto`; a specific model only with a reason (design-spec §5). e.g. `anthropic/claude-haiku-4.5` |
| `architecture` | yes | `agent-design-spec.md` frontmatter `architecture` | one of `single-llm` \| `single-agent` \| `orchestrating-workflow` \| `multi-agent`. The default is `single-agent` (no tools). `single-llm` = a trivial one-shot answer with no tools (today's `code`/`infra`). |
| `temperature` | no | `subagent.template.json` › `OpenRouter Chat Model.parameters.options.temperature` | OpenRouter sampling temperature; default `0.3` |

Routing keys (`intent`, `confidence_threshold`, `fallback`) apply to agents the orchestrator
dispatches (the manifest `agents[]`). A background worker (e.g. `deep-research`, dispatched by an
explicit phrase rather than an intent — see `agents.manifest.json` › `background_workers`) declares
`architecture` + `model` but no routing keys.

### Example (`agents/code/agent.yaml`)

```yaml
slug: code
intent: code
description: Writing, editing, reviewing code (minimal LLM, no tools).
confidence_threshold: 0.7
model: anthropic/claude-haiku-4.5
architecture: single-llm
temperature: 0.3
```

---

## `instructions.md` — the role body (`@@SYSTEM_MESSAGE@@`)

The natural-language system prompt for the agent — exactly the text that fills `@@SYSTEM_MESSAGE@@`
in `subagent.template.json`. This is the role body only; the compiler appends the **fixed tail**
common to every agent and the **style-profile clause**, so do **not** repeat them in
`instructions.md`.

The compiler renders the chainLlm node's `SystemMessagePromptTemplate.message` as:

```
=<instructions.md body> <FIXED TAIL><STYLE-PROFILE CLAUSE>
```

where the **fixed tail** is exactly (note the leading space):

```
 Answer in the user's language (Hebrew or English, detected from the input). Never invent URLs or secrets, and never reveal the names of internal sub-agents or your own architectural role.
```

and the **style-profile clause** is the verbatim mustache expression from the template:

```
{{ ($('Read Style Profile').first()?.json?.profile) ? ' Style profile (match in tone, length, emoji density, humor; do not announce you are matching it): ' + JSON.stringify($('Read Style Profile').first().json.profile) : '' }}
```

> **Known wrinkle (resolved in the compiler stage).** `subagent.template.json` carries an extra
> sentence — " You return your answer to the orchestrator (the Agent Router); you never address the
> operator directly." — between `@@SYSTEM_MESSAGE@@` and the fixed tail, but the committed
> `code-agent.json` does **not** have it. So that orchestrator-return sentence is **not** part of the
> guaranteed fixed tail; it is a **recommended opening line of `instructions.md`** (the single-voice
> behavior is enforced structurally anyway — see the contract below). For a byte-exact round-trip of
> an existing agent, put whatever that agent's committed prompt contains into `instructions.md`; the
> compiler appends only the fixed tail above.

`instructions.md` is the place for the design-spec §7 "instructions" (goals, do/don't, edge cases,
few-shot examples). Keep secrets and URLs out of it (the fixed tail forbids inventing them).

---

## `tools.yaml` — the agent's tools

A no-tools agent (the default, e.g. `code`, `infra`) declares an empty list. A tool-carrying agent
lists tools from the known set; each maps to the n8n tool/sub-workflow node the install-time
compiler injects (the inverse of the credential-absent `jq` strip in `configure-agent-router.yml`).

```yaml
tools: []          # no-tools agent (architecture: single-llm | single-agent)
```

or

```yaml
tools:
  - postgres_named_query    # whitelisted read-only named SELECTs (postgres-named-queries)
  - github_readonly         # read-only GitHub reads (github-readonly)
  - railway_readonly        # read-only Railway service/deploy status (railway-readonly)
  - request_write_action    # HITL write-request gate (request-write-action) — the ONLY write path
  - factory_tools           # this system's own read-only telemetry (/factory/<system>/mcp)
  - google_workspace        # the shared Google Workspace tools (/workspace/<system>/mcp)
  - web_search              # web search for the research agent
```

**Hard rule (design-spec §6, contract rule 7):** a sub-agent never gets free SQL or a direct write
tool. Writes route **only** through `request_write_action` (the HITL propose→approve→execute gate).
High-risk (write / irreversible / costly) tools must go through that gate.

> v1 of the compiler renders **no-tools** agents only (the chainLlm shape). Tool-node injection from
> `tools.yaml` is added in a later sub-step, once the no-tools round-trip is proven.

---

## The inviolable sub-agent contract (restated — never drift from this)

Full text: `templates/n8n/subagent.contract.md`. The compiler MUST emit JSON that satisfies all of
it; `scripts/check-agent-single-voice.sh` enforces it in CI.

- **Input** (orchestrator → agent), via the first node `When Executed by Another Workflow`
  (`n8n-nodes-base.executeWorkflowTrigger`, `inputSource: passthrough`): the fields
  `sanitized`, `intent`, `confidence`, `entity_mention`, `source`.
- **Output** (agent → orchestrator): the last node emits **exactly** `{ reply }` (a `Set` node named
  `Format Reply`). Nothing else.
- **The four hard rules:** (1) **no `n8n-nodes-base.telegram` node**; (2) **`executeWorkflowTrigger`
  only** — no `webhook` / `telegramTrigger`; (3) a node assigning a `reply` field exists; (4) valid
  JSON.
- **Memory** (only if genuinely needed): the canonical `memoryPostgresChat` node whose `sessionKey`
  MUST start with `=tg:@@CHAT_ID@@` (per-source convention). Most agents are stateless — keep them so.

The agent never addresses the operator. Only the orchestrator's voice (`Send Reply` in
`tg-inbound.json`) does.

---

## The two placeholder phases (keep them straight)

The compiler fills only the **scaffold-time** tier and leaves the **install-time** tier intact in the
committed JSON, so the downstream `configure-agent-router.yml` install path is byte-compatible.

| Phase | Filled by | Placeholders | When |
|---|---|---|---|
| **Scaffold-time** | the compiler (from `agents/<name>/`) | `@@AGENT_SLUG@@`, `@@SYSTEM_MESSAGE@@`, `@@MODEL@@` | resolved into the committed `workflows/n8n/<name>-agent.json` |
| **Install-time** | `configure-agent-router.yml` on deploy | `@@CRED_OPENROUTER_ID@@`, `@@CRED_POSTGRES_ID@@`, `@@CHAT_ID@@`, and (tool agents) `@@CRED_*@@` / `@@WF_*_ID@@` / `@@SUB_<INTENT>_WF_ID@@` | stay in the committed file, resolved per-system at deploy |

A compiled agent file therefore still contains the `@@…@@` install-time tokens — that is correct and
required, not a bug.

---

## How this maps to the rest of the system

- **Registry:** `agent.yaml`'s routing keys are the row the agent contributes to
  `agents.manifest.json` › `agents[]`. (Until the compiler owns the manifest, keep them in sync.)
- **Paired Claude skill:** an operable agent still needs its capability card
  (`.claude/skills/<slug>-agent/SKILL.md`) — the workflow↔skill-pair gate
  (`scripts/check-workflow-skill-pair.sh`) is unchanged.
- **Schemas:** `_spec/agent.schema.json` and `_spec/tools.schema.json` validate `agent.yaml` /
  `tools.yaml`; the folder-validation gate (`scripts/check-agent-folder.sh`, added later) is
  fail-closed against them.
