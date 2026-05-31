---
audience: shared
description: Deploys Stage 6 multi-agent layer — Agent Router + ops/code/research sub-agents + infra stub — on N8N with Macro-F1 ≥ 0.85 gate, wires [your-telegram] free-form Hebrew routing. Use after Stages 1–5 complete or to re-deploy the router.
synthesis-required: false
adapted-by: skill-adapter
adapted-on: 2026-05-24
---

# Stage 6 — Multi-Agent Orchestration Layer

## Role
You are a Workflow Orchestration Engineer who deploys an N8N-hosted multi-agent
system: one Router classifies a free-form Hebrew operator message into an intent
(`ops` / `code` / `research` / `infra` / `unknown`) and HTTP-dispatches it to the
matching sub-agent. All deployment is via GitHub Actions + N8N REST API — never
the N8N UI.

## Context — Read First

Before starting, read in parallel:
- `CLAUDE.md` — confirm Hard Rule #10 and Stage 6 status.
- `state.json` — confirm Stages 1–5 are `completed` and Stage 6 is `in_progress`.
- `docs/adr/` — architectural envelope ADR for multi-agent orchestration.
- `docs/adr/` — routing decisions + sub-agent catalogue ADR.
- `docs/adr/` — [your-openrouter] classifier model, Macro-F1 gate, SKILL.md DoD, OWASP LLM01 (Prompt Injection), LLM02 (Sensitive Information Disclosure), and LLM05 (Improper Output Handling) sanitisation rules ADR (LLM06:2025 Excessive Agency is handled via HITL gating in a later Stage).
- `docs/adr/` — split-file N8N workflow layout ADR (why workflow JSONs live under `workflows/n8n/` instead of being inlined in the YAML).
- `workflows/n8n/*.json` — the 5 shipped workflows + `test-battery.json`.
- `.github/workflows/configure-subagents.yml` — deployment + Macro-F1 gate workflow.
- `.github/workflows/configure-telegram-n8n.yml` — [your-telegram] Operator Interface; look for the `Is Slash Command?` + `Forward to Router` nodes.

## Architecture (one-glance)

```
Telegram message
      │
      ▼
Telegram Operator Interface (N8N)
      │  Is Slash Command? ── true ──▶ existing /status /agent-session handler
      │                └── false ─────▶ Forward to Router (HTTP POST)
      ▼
Agent Router (webhook /agent-router)
  Sanitise → Classify (OpenRouter openai/gpt-5-nano, pinned — JSON mode)
        → Extract Intent (confidence < 0.7 ≡ unknown — OWASP LLM01)
        → If is_test  ─────▶ Respond { ok, intent }
        → If unknown ─────▶ Telegram clarification → Respond
        → Execute Sub-workflow  ▶  <intent>-agent  ─▶ Respond
      ▼
Sub-agent (ops | code | research | infra)
  Extract Context → domain HTTP call → Build Reply
    → If is_test   ─────▶ Respond (skip Telegram)
    → Telegram send      ─▶ Respond
```

> **Sub-agent dispatch (Stage 51):** the Router invokes sub-agents via n8n
> `Execute Sub-workflow` nodes — **not** `@n8n/n8n-nodes-langchain.agentTool`,
> which n8n issue #22489 breaks with GPT-5 / Responses-API models (open as of
> May 2026).
>
> **Sub-agent status (Stage 51b):** all five sub-agents (`ops`, `code`,
> `research`, `infra`, `unknown`) are now implemented and wired into the router's
> Switch (4 intent rules at confidence ≥ 0.7 + `unknown` fallback).
> `code`/`research`/`infra` are tool-less this increment (`chainLlm` + `Set`,
> mirroring `unknown-agent`; code/research on `anthropic/claude-haiku-4.5`, infra
> on `openai/gpt-5-mini`) — Stage 51b's checkpoint is routing correctness (4/4
> smoke probe), not per-agent tools. Per-agent domain tools (research
> `web_search`; infra read-only Railway/Cloudflare) are a focused follow-up;
> infra **write** capability needs HITL and is deferred.

`is_test` sentinel: sub-agents skip [your-telegram] sends when `chat_id == 'test'`
so the Macro-F1 probes exercise the full Router → dispatch path without spamming
the operator (a prior decision locks 0.85 as the industry-standard Macro-F1 floor).

## Prerequisites

| Prerequisite | Why | How to verify |
|---|---|---|
| Stages 1–5 complete | [your-railway], DNS, N8N, Secret Manager, [your-openrouter], [your-telegram] all live | `state.json` `build_stages[0..5].status == "completed"` |
| GCP secret `GITHUB_PAT_ACTIONS_WRITE` populated | Sub-agent credential injected into N8N | `gcloud secrets versions list GITHUB_PAT_ACTIONS_WRITE` (operator) |
| N8N credentials `[your-telegram] Bot` + `[your-openrouter]` exist | Reused — Stage 4/5 created them | `configure-subagents.yml` step *Resolve existing credential IDs* fails fast if missing |
| `CLAUDE.md` Hard Rule #10 in force | Stops any PR that flips a stage to `completed` without a SKILL.md | `grep -n "Hard Rule #10" CLAUDE.md` |
| `policy/skill.rego` + `check_skill()` wired | CI teeth for the DoD gate | `grep -n "check_skill" scripts/check_policies.py` |

## Instructions

### Step 1: Verify repository artifacts are in place

Check all five workflow JSONs + the test battery + both CI workflows + the
macro-F1 helper exist and are valid:

```bash
for f in workflows/n8n/agent-router.json \
         workflows/n8n/ops-agent.json \
         workflows/n8n/code-agent.json \
         workflows/n8n/research-agent.json \
         workflows/n8n/infra-agent.json \
         workflows/n8n/test-battery.json; do
  jq empty "$f" || { echo "::error::Invalid JSON: $f"; exit 1; }
done
test -f .github/workflows/configure-subagents.yml   || exit 1
test -f .github/workflows/configure-telegram-n8n.yml || exit 1
test -f scripts/eval_router.py                       || exit 1
test -f tests/router_battery.yaml                    || exit 1
test -f .github/workflows/eval-agent-router.yml                          || exit 1
```

If any artifact is missing, do **not** hand-write it here — the canonical copies
live on `main`. Restore via `git checkout main -- <path>` or rebase onto main.

### Step 2: Ensure placeholder tokens are present in JSONs

Every workflow JSON ships with sed-replaceable placeholders that the CI resolves
at deploy time. Do **not** pre-resolve them in the repo.

| Placeholder | Resolved from |
|---|---|
| `@@CRED_TELEGRAM_ID@@` | N8N credentials lookup — name `[your-telegram] Bot` |
| `@@CRED_OPENROUTER_ID@@` | N8N credentials lookup — name `[your-openrouter]` |
| `@@CRED_GITHUB_PAT_ID@@` | N8N credentials upsert — name `GitHub PAT Actions Write` |
| `@@N8N_DOMAIN@@` | [your-railway] GraphQL for the `n8n` service |

Quick check:

```bash
grep -c '@@' workflows/n8n/*.json   # every file should report >= 1 match
```

### Steps 3–5: Hand off to operator

`workflow_dispatch` and [your-telegram] sends are operator-gated — hand off each step
with the Hebrew instruction and acceptance criterion below. Wait for operator
confirmation of each before proceeding to the next.

| # | Action | Operator hand-off (Hebrew) | Acceptance |
|---|---|---|---|
| 3 | Dispatch `eval-agent-router.yml` (Macro-F1 gate) | הפעל ב-GitHub Actions את `eval-agent-router.yml` על `main`. תעקוב אחרי השורה `Macro-F1: X.XXX (threshold 0.85)` ודווח לי את הערך. | Run exits 0 **and** Macro-F1 ≥ 0.85 |
| 4 | Re-dispatch `configure-telegram-n8n.yml` | הפעל שוב ב-GitHub Actions את `configure-telegram-n8n.yml` על `main`. | Run exits 0; 9 nodes in the resulting N8N workflow |
| 5 | Live [your-telegram] free-form probe | שלח לבוט הודעה חופשית בעברית (למשל: `מה מצב השירותים?`). ודווח לי את התשובה. | Non-empty Hebrew reply **not** equal to the `/status` or `/agent-session` text — confirms the Router path fired, not the slash-command path |

Step 3 log markers to spot (from `eval-agent-router.yml` → `scripts/eval_router.py`):
`Macro-F1: X.XXX (threshold 0.85)` followed by the per-class P/R/F1 lines, with
`report.json` uploaded as a build artifact.

### Step 6: Flip Stage 6 to `completed` in `state.json`

Only after Steps 3–5 are all acknowledged green. Edit `state.json`:

```json
{
  "number": 6,
  "name": "Multi-Agent Orchestration Layer",
  "status": "completed"
}
```

Also update:
- `updated_at` to the current UTC timestamp.
- `last_session` to the current branch + summary.
- `next_actions` — remove the three operator dispatch items + the agent
  SKILL.md-writing item; promote Stage 7 items.

### Step 7: Append a `[your-journey-file]` entry

One entry covering: dispatch results (with run IDs), Macro-F1 numeric value,
[your-telegram] probe text + reply, any sub-agent that returned an unexpected intent,
and the decision to flip Stage 6 to `completed`.

Template:

```markdown
## [YYYY-MM-DD] feat — Stage 6 closeout: Macro-F1 gate green + Telegram E2E + Stage flip

**Operator**: <model> (autonomous agent, branch `claude/stage6-closeout-...`)
**Scope**: `.claude/plugins/engineering-std/skills/stage6-multi-agent/SKILL.md`, `state.json`, `JOURNEY.md`
**Objective**: Close Stage 6 after operator-dispatched CI gates turned green.

### Actions taken
- `configure-subagents.yml` dispatched (run <id>): 5/5 workflows upserted + activated; Macro-F1 = <value> (threshold 0.85). PASS.
- `configure-telegram-n8n.yml` re-dispatched (run <id>): 9 nodes deployed; `Is Slash Command?` + `Forward to Router` live.
- Telegram probe: operator sent "<hebrew-text>" → received "<hebrew-reply>" from <intent>-agent. PASS.
- SKILL.md written for `stage6-multi-agent` (pre-written before the gate to keep the same PR self-validating).
- `state.json` Stage 6 `in_progress → completed`. This PR is the first live firing of `check_skill()` in CI.

### Decisions made
- ...

### Open items / follow-ups
- [ ] Stage 7 (Full System E2E + Autonomy Proof) — roadmap in `docs/system/BUILD-STAGES.md`.
- [ ] `infra-agent` stub → real implementation (Iter 6) once the Level-3 `RAILWAY_TOKEN` policy is resolved.
```

### Step 8: Commit + push + open PR

```bash
git add .claude/plugins/engineering-std/skills/stage6-multi-agent/SKILL.md \
        state.json JOURNEY.md
git commit -m "feat(stage6): closeout — SKILL.md + flip Stage 6 to completed"
git push -u origin claude/stage6-closeout-validation-<hash>
```

Open the PR. Expected CI result:
- `documentation-enforcement` status check runs `check_policies.py`.
- `check_skill()` fires (because `state.json` changed and stage 6 became
  `completed`). It walks `.claude/plugins/engineering-std/skills/` and finds
  `stage6-multi-agent/SKILL.md` → passes.
- If the SKILL.md were missing, `check_skill()` would fail here — this PR is
  the first live self-validation of the enforcer.

## Known Failures and Fixes

| Failure | Symptom | Root Cause | Fix |
|---------|---------|-----------|-----|
| `N8N service not found` | Domain resolution step exits 1 | [your-railway] `n8n` service renamed or environment mismatch | Verify `RAILWAY_PROJECT_ID` + env; N8N service must be named `n8n` |
| N8N credential not found (`[your-telegram] Bot`, `[your-openrouter]`) | *Resolve existing credential IDs* step exits 1 | Upstream stage never ran or credential renamed | Re-run the upstream stage's `configure-*.yml` (Stage 4 for `[your-openrouter]`, Stage 5 for `[your-telegram] Bot`) |
| Macro-F1 < 0.85 | Gate step exits 1 with `FAIL — Macro-F1 below threshold` | Classifier drift, prompt regression, `unknown` confusing `ops` | Inspect probe lines for the misclassified prompts, tighten system prompt in `agent-router.json` *Classify* node, re-run |
| URL allowlist bypass | E.g. `https://evil.com/github.com/x` slips past Sanitise | Substring regex on raw URL instead of `URL().hostname` | `agent-router.json` *Sanitise* must use `new URL(u).hostname` + `host === h \|\| host.endsWith('.' + h)` against an allow-list |
| Missing `confidence` treated as high-confidence | `unknown` prompts route to the wrong agent | Guard `if (confidence > 0 && confidence < 0.7)` lets zero-confidence through | Guard must be `if (confidence < 0.7 && intent !== 'unknown')` — no `> 0` clause (OWASP LLM01 bounded refusal) |
| [your-telegram] workflow deploys but webhook returns empty 200 | Post-deploy `/status` E2E probe fails with `Unexpected webhook response: ` | Bash single-quote heredoc consumed inner `''` in an N8N expression → stored as `|| }}` → n8n's expression engine throws `SyntaxError` → IF node halts silently → `Respond to Webhook` never fires | Inside the jq template's outer `'...'`, use `\"\"` for empty-string literals, never `''` |
| Bash `local` leakage in `upsert_one` | Function overwrites caller-scoped variables | Missing `local` declarations | Declare every variable the function writes: `local name processed WFS WF_ID PUT_RESP CREATE WF_REST VER ACTIVE ACT OK` |
| `check_skill()` fails locally before SKILL.md exists | CI red on SKILL.md-less PR | **Expected** — Hard Rule #10 self-validation | Write the SKILL.md; do not bypass the check |

## Safety Rules

1. **NEVER** flip Stage 6 to `completed` in `state.json` before the Macro-F1 gate has
   actually passed green. Hard Rule #7 forbids skipping E2E gates.
2. **NEVER** hand-edit `workflows/n8n/*.json` in the N8N UI — the next CI
   dispatch will overwrite your change. All edits go through the repo.
3. **NEVER** print or log `GITHUB_PAT_ACTIONS_WRITE`, `N8N_OWNER_PASSWORD`,
   `OPENROUTER_API_KEY`, or `TELEGRAM_BOT_TOKEN` values.
4. **NEVER** reduce the Macro-F1 threshold to 0.80 or lower. A prior decision
   locks 0.85 as the industry-standard floor. Raising it is fine; lowering
   requires a new ADR.
5. **NEVER** deploy a sub-agent without the `is_test` sentinel — the gate
   probes would otherwise fire live [your-telegram] messages.
6. **NEVER** sanitise-strip the raw operator text before `Extract Intent` runs
   (emoji + punctuation carry routing signal).
7. **NEVER** merge the closeout PR if `check_skill()` is red — the enforcer is
   the point of Hard Rule #10.

## Examples

**User:** `/stage6-multi-agent` (Stages 1–5 complete, artifacts on `main`, closeout branch checked out)

**Agent behaviour:**
Reads `state.json` — Stage 6 `in_progress`. Reads ADRs 0024/0033/0034/0035.
Verifies the 6 JSONs and both workflows exist + parse. Writes SKILL.md on the
closeout branch, pushes. Hands off to operator for dispatches (Steps 3–5).
Waits for operator to report Macro-F1 value + [your-telegram] E2E reply. Then flips
Stage 6 to `completed`, appends JOURNEY entry, pushes, opens PR.

**User:** `/stage6-multi-agent` (operator reports Macro-F1 = 0.72)

**Agent behaviour:**
Does **not** flip Stage 6. Retrieves the probe lines from the run log (via
operator or GitHub UI), identifies which class(es) are failing, proposes a
`Classify` system-prompt tightening, asks operator to confirm + re-dispatch.
No state flip until the gate is green.

**User:** `/stage6-multi-agent` (operator reports [your-telegram] probe returned the `/status` response, not a sub-agent reply)

**Agent behaviour:**
The `Is Slash Command?` node is routing free-form text to the wrong branch.
Inspects `configure-telegram-n8n.yml` for the `startsWith '/'` operator,
verifies the If node's `true`/`false` wiring, asks operator to re-dispatch
the workflow. Does not flip Stage 6.
