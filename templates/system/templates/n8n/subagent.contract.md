# Sub-agent contract

Every specialist agent the orchestrator (the Agent Router) dispatches to
(`workflows/n8n/<slug>-agent.json`) is a worker: it is invoked by the orchestrator, does
one job, and returns a fixed result to the orchestrator. It never addresses the operator.
This contract is what makes a new agent safe to plug in, and it is enforced in CI by
`scripts/check-agent-single-voice.sh`.

Scaffold a new agent from `templates/n8n/subagent.template.json` via the `/build-agent`
skill — it is conformant by construction. `/build-agent` begins with a mandatory **Step 0**
that decomposes the requested role (single agent vs. orchestrating sub-workflow vs.
multi-agent) and saves a design-spec to `docs/agent-specs/<intent>.md` before any
scaffolding (template: `templates/agent-design-spec.md`).

## Input (orchestrator → agent)

The router (`agent-router.json`) calls the agent through an Execute-Workflow node with
`inputSource: passthrough`. The first node (`When Executed by Another Workflow`,
`executeWorkflowTrigger`) receives:

| Field | Type | Meaning |
|---|---|---|
| `sanitized` | string | the operator's message, control-stripped and capped (≤2000) |
| `intent` | string | the class the router assigned (e.g. `ops`, `code`, your new intent) |
| `confidence` | number | classifier confidence 0.0–1.0 |
| `entity_mention` | string \| null | a file/entity the router resolved, if any |
| `source` | string | optional channel slug for memory isolation (`""` = the operator's direct Telegram thread; e.g. `email`, `whatsapp`). Sanitized to `[a-z0-9_-]`, ≤32 chars. |

Read the user text with `{{ $('When Executed by Another Workflow').first().json.sanitized }}`.

## Conversation memory & session keys

Most agents are **stateless** (no memory node) — keep it that way unless the agent genuinely
needs to remember across turns. Only `unknown-agent` carries conversation memory today.

If an agent needs memory, it must follow the **per-source session-key convention** so that
different trigger sources never bleed context into each other (and never into the operator's
direct thread):

- **Base thread** (the operator's direct Telegram chat): `tg:<chat_id>` — used when `source` is empty.
- **Per-source thread** (any other trigger, e.g. an email or WhatsApp automation): `tg:<chat_id>:<source>`.

A new automation that funnels into the orchestrator only needs to POST `{ text, source: "whatsapp" }`
to the router to get its own isolated thread — the field rides through `Sanitize Input` →
`Build Dispatch` → `Resolve Entity` → the agent automatically.

The canonical memory node (add it verbatim; `@@CHAT_ID@@` is resolved at install time):

```json
{
  "parameters": {
    "sessionIdType": "customKey",
    "sessionKey": "=tg:@@CHAT_ID@@{{ ($('When Executed by Another Workflow').first().json.source) ? ':' + $('When Executed by Another Workflow').first().json.source : '' }}",
    "tableName": "n8n_chat_histories",
    "contextWindowLength": 20
  },
  "name": "Conversation Memory",
  "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
  "typeVersion": 1.3,
  "credentials": { "postgres": { "id": "@@CRED_POSTGRES_ID@@", "name": "Postgres (n8n)" } }
}
```

The `sessionKey` MUST start with `=tg:@@CHAT_ID@@` (the operator's base key) — this is enforced
in CI by `scripts/check-agent-single-voice.sh`, so a divergent or hardcoded key cannot ship.

## Output (agent → orchestrator)

The **last** node must emit exactly one field:

| Field | Type | Meaning |
|---|---|---|
| `reply` | string | the answer text the orchestrator will relay to the operator |

Use a Set node named `Format Reply` assigning `reply` (the template does this). The
orchestrator's `Egress Validation` node consumes `{reply}`, sanitizes it, and `Send Reply`
in `tg-inbound.json` is the single node that delivers it to the operator.

## Composite agents (when one "agent" is really several)

Step 0 of `/build-agent` may decide that a requested capability is too big for one agent
(3–5 distinct functions / modes). The conformant shape is an n8n **orchestrating
sub-workflow** that calls several executeWorkflow sub-agents — **each** still obeys this
contract (executeWorkflowTrigger in, a single `{reply}` out) — and the orchestrating
workflow composes **one** final `{reply}` back to the orchestrator. This is *not* a
handoff/transfer: no leaf ever becomes the active speaker or owns a Telegram node. Each leaf
passes `check-agent-single-voice.sh` individually, so the existing gate already covers
composites with no change. (Rationale: `docs/research/agent-role-decomposition-planning.md` §7.)

## The four hard rules (enforced by CI)

1. **No Telegram node.** A specialist agent must contain no `n8n-nodes-base.telegram`
   node — it never messages the operator.
2. **Execute-Workflow trigger only.** It must start with an `executeWorkflowTrigger` and
   expose no user-facing trigger (`webhook` / `telegramTrigger`). The orchestrator is the
   only entry.
3. **`{reply}` contract.** It must expose a node assigning a `reply` field.
4. **Valid JSON.**

## Placeholders

Two substitution phases — keep them straight:

- **Scaffold-time** (filled by `/build-agent` when copying the template into
  `workflows/n8n/`): `@@AGENT_SLUG@@`, `@@SYSTEM_MESSAGE@@`, `@@MODEL@@`. The committed
  agent file has these already resolved.
- **Install-time** (filled by `configure-agent-router.yml` on deploy): `@@CRED_OPENROUTER_ID@@`,
  `@@CRED_POSTGRES_ID@@`, `@@CHAT_ID@@`, and (for tool-carrying agents) the various
  `@@CRED_*@@` / `@@WF_*_ID@@` placeholders. These stay in the committed file and are
  resolved per-system at deploy.

## Registration

A scaffolded file is not yet "known" to the orchestrator. To register it, the `/build-agent`
skill adds the agent to **all** of:

1. `workflows/n8n/agents.manifest.json` — the source-of-truth registry (intent → file).
2. `agent-router.json` — the `Classify Intent` prompt (new intent) and the
   `Route by Intent` switch + an `Execute Workflow` node calling the new agent.
3. `.github/workflows/configure-agent-router.yml` — the sub-agent upsert loop and the
   router's `@@SUB_<INTENT>_WF_ID@@` substitution.
4. `AGENTS.md` — the agent catalogue.
5. `tests/router_battery.yaml` — golden routing cases for the new intent (the eval gate).
