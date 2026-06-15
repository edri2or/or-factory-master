---
audience: shared
description: Build a new specialist sub-agent end-to-end — decompose the role, scaffold from the template, prove each part works ALONE, prove the assembly alone, and only then wire it to the orchestrator. Use when adding a new agent, "בנה סוכן", or "צור סוכן חדש".
---

# Build Agent — scaffold a conformant specialist sub-agent

## Role
You build a new specialist sub-agent for the **orchestrator** (the system's single Agent
Router). Every agent you create is a worker: the orchestrator invokes it, it does one job,
and it returns the `{reply}` contract to the orchestrator — it never talks to the operator.
You make it conformant by construction (from the template), **prove each brick works alone
on real input before stacking the next**, and wire it to the orchestrator **last**. You talk
to Or in plain Hebrew and stop for his approval before deploying anything.

> This skill obeys the repo's core rule (`/dev-stage`): a step is done only when the brick is
> **proven to actually do its job, on real input, alone** — CI-green is necessary but not
> sufficient. Build bottom-up; the orchestrator (and Telegram) is the **last** brick you wire,
> never the first thing you test through. Deferring all proof to one final "big-bang" test is
> the documented anti-pattern this skill exists to prevent.

## Context — Read First

Read these before scaffolding (independent — read in parallel):

1. `templates/n8n/subagent.contract.md` — the input/output contract, the four CI-enforced
   rules, the placeholder split, and the canonical registration steps.
2. `templates/n8n/subagent.template.json` — the scaffold you copy.
3. `workflows/n8n/agents.manifest.json` — the source-of-truth registry; never duplicate an
   existing `intent`.
4. `templates/agent-design-spec.md` — the Step 0 design-spec template (fast + full variants;
   the full variant carries the per-component **fixture → expected-output → test-method**
   column). Its rationale + decision matrix + the bottom-up "4 phases / 3 gates" discipline
   live in `docs/research/agent-role-decomposition-planning.md` (read §3 matrix, §7
   single-voice rule, §8 bottom-up gates before a complex build).
5. `docs/capability-first.md` — **Phase 1**: prove the raw capability works OUTSIDE n8n (a
   `curl`/script spike) on a real fixture, then the feasibility go/no-go — *before* decomposing.
   Precedes proving a brick alone inside n8n.
6. `docs/agent-isolation-testing.md` — HOW to prove a brick alone: n8n Pin data, testing a
   sub-workflow in isolation, and reading a result MCP-independently via the n8n Public API.
7. Optionally one existing agent (`workflows/n8n/infra-agent.json` is the minimal model;
   `workflows/n8n/ops-agent.json` if the new agent needs tools).

## Instructions

### Step 0: Decompose & plan the role — AND define how each part is proven (mandatory)
**Phase 1 first — prove the raw capability OUTSIDE n8n.** Before you decompose, prove each
external capability the agent depends on (read a Hebrew form, fill a PDF, send a threaded email)
actually works **outside n8n** — a `curl`/script spike on a real fixture — and pass the
feasibility go/no-go. Record it in the design-spec's Capability Card (§0). See
`docs/capability-first.md`. This *precedes* (does not replace) "prove each brick alone": only a
capability proven feasible is worth decomposing and building.

Before scaffolding, decide **what** to build — not just how to wire it. This step is
**always run**; its depth is adaptive (a trivial agent gets ~4 lines; only a genuinely
complex one gets the full spec). Apply the decision matrix from
`docs/research/agent-role-decomposition-planning.md` §3 to Or's request (read vs. write,
parallelism, context pressure, number of modes, 3–5 distinct functions, value > cost) and
**classify** the architecture into exactly one of: (1) single LLM call (rare), (2) **single
agent** (the default — simplicity rule), (3) **orchestrating sub-workflow** of several
executeWorkflow sub-agents (3–5 distinct functions/modes), (4) parallel multi-agent (rare).

**Whatever the verdict, define the proof up front.** For every part you will build, write —
*before* building it — **how you will prove it works alone**: a pinned real-input *fixture*
and the *expected output*, and the test method (see `docs/agent-isolation-testing.md`,
deterministic-first). A part with no "prove-alone" line is not ready to build. This is the
`templates/agent-design-spec.md` §3 fixture column and the gate list.

- **Fast path (default).** Verdict "single agent, no tools": fill the 4-line fast-path of
  `templates/agent-design-spec.md` — including its **הוכחת-תפקוד (לבד)** line (one fixture +
  expected output) — save it (below), and go to Step 1. **Do not slow Or down.**
- **Full path (only when genuinely complex).** Verdict case 3/4, or tools/HITL/multiple
  modes: fill the full `templates/agent-design-spec.md`. Then:
  - **If multi-component (case 3):** design it as an n8n **orchestrating sub-workflow** that
    calls several executeWorkflow sub-agents, each returning `{reply}` — **never** a
    handoff/transfer (breaks the single-voice invariant; research §7). The orchestrating
    workflow composes **one** final `{reply}`. Each leaf is scaffolded from the template in
    Step 2 and passes `check-agent-single-voice.sh`.
  - **Per-component proof (the core of this skill):** for *each* component fill the §3 row —
    fixture (real pinned input) → expected output → test method — so you can prove it ALONE
    in Step 5 Gate 1 before composing.
  - **Golden routing cases:** list real expected phrasings (eval-before-build); these seed
    `tests/router_battery.yaml` in Step 4 and the routing check in Step 5 Gate 3.
  - **Gates:** name the checks required (feasibility, decomposition review, eval-before-build,
    HITL points for high-risk actions).

**Save the spec** (fast or full) to `docs/agent-specs/<intent>.md`.

**Stop for Or's approval — in plain Hebrew.** Summarize the decomposition for Or
(non-technical, never opens files): one short paragraph — what the agent does, whether it is
one agent or several wired together, **how each part will be proven alone**, and what is
checked before building. Wait for his OK. If the verdict was case 3/4, wrap the build in
`/dev-stage` so it runs as gated, documented stages — each stage ending in its part's
functional proof.

### Step 1: Gather the spec
Step 0 produced the intent + job in the saved spec — **confirm** them with Or (don't
re-ask), then fill any remaining fields. Collect:
- **Intent name** — one lowercase word, unique vs. the manifest (e.g. `billing`, `legal`).
- **Job** — one or two sentences: what this agent answers / does.
- **Trigger examples** — 3–5 real phrases Or would send that should route here (golden cases).
- **Model** — default `openrouter/auto`; a specific model only with a reason.
- **Tools?** — default none (advisory/answer-only). System tools (n8n API, Postgres,
  GitHub/Railway readers, write requests) are a bigger change — model on `ops-agent.json` and
  confirm with Or first. Writes route only through the approved `request_write_action` HITL
  path — never free SQL or a direct write tool.

### Step 2: Scaffold from the template
- Copy `templates/n8n/subagent.template.json` → `workflows/n8n/<intent>-agent.json`.
- Substitute scaffold-time placeholders: `@@AGENT_SLUG@@` → intent, `@@MODEL@@` → model,
  `@@SYSTEM_MESSAGE@@` → the job framed as a system prompt. Leave install-time placeholders
  (`@@CRED_*@@`, `@@CHAT_ID@@`) untouched.
- `jq empty workflows/n8n/<intent>-agent.json` must pass.

### Step 3: Register with the orchestrator (keep all sources in sync)
Per `subagent.contract.md`, update **all** of:
1. `workflows/n8n/agents.manifest.json` — add `{intent, file, confidence_threshold: 0.7, description}`.
2. `workflows/n8n/agent-router.json` — add the intent to the `Classify Intent` system prompt,
   add a `Route by Intent` switch branch, add an `Execute Workflow` node
   `Call <intent> Sub-workflow` (placeholder `@@SUB_<INTENT>_WF_ID@@`) wired to egress.
3. `.github/workflows/configure-agent-router.yml` — add the agent to the sub-agent upsert
   loop (so it is created and its id captured) and add the
   `-e "s#@@SUB_<INTENT>_WF_ID@@#${SUB_<INTENT>_WF_ID}#g"` substitution to the router prep.
4. `AGENTS.md` — add a one-line entry to the agent catalogue.
5. **Paired Claude skill (capability card).** A new `workflows/n8n/<intent>-agent.json` is an
   operable workflow, so it needs a paired skill at `.claude/skills/<intent>-agent/SKILL.md`
   (folder name = the `/<intent>-agent` command) — add a row to the curated table in
   `scripts/gen-workflow-skill.sh` and run it, or add the workflow to
   `monitoring/workflow-skill-exempt.txt` if it is pure plumbing. CI
   (`scripts/check-workflow-skill-pair.sh`) blocks the merge otherwise. *(In the factory repo
   refresh the golden afterward: `bash scripts/check-system-golden.sh --update`.)*

### Step 4: Add golden routing cases
Add the Step-1 trigger phrases to `tests/router_battery.yaml` as cases mapping to the new
intent (and a couple of near-miss phrases that should NOT route here).

### Step 5: The three ordered gates (bottom-up — each must be green before the next)
This replaces a single end-of-line E2E gate. Prove the parts, then the assembly, then the
routing — in this order. Prefer MCP-independent verification (`docs/agent-isolation-testing.md`).

- **Gate 1 — every part works ALONE.** For each component, run its Step-0 fixture → expected
  output **in isolation** (Pin data + Test step in the n8n editor, or drive it via the n8n
  Public API / a verification workflow — not the flaky MCP) and confirm the output is
  correct. Static: `bash scripts/check-agent-single-voice.sh` passes (no Telegram node,
  Execute-Workflow trigger, `{reply}` contract) and `jq empty` on every changed JSON. A
  component is not done until its fixture passes.
- **Gate 2 — the assembly works ALONE (no orchestrator).** For a composite, drive the
  orchestrating sub-workflow directly with a sample input and confirm it returns **one**
  correct `{reply}` — without going through the Agent Router. (For a single agent, Gate 2 is
  Gate 1.) This proves the wiring/handoff between proven parts before any routing.
- **Gate 3 — connect to the orchestrator LAST (routing only).** Only now wire routing. Where
  the system ships the router-eval bundle (`scripts/eval_router.py` + `tests/router_battery.yaml`),
  run it: Macro-F1 must stay ≥ 0.85 and the new intent's own cases must route correctly.
  Then, after Or approves a deploy, drive a real trigger phrase end-to-end (n8n Public API or
  a Telegram round-trip) and confirm it routes to the new agent and a non-empty `{reply}`
  returns. This gate proves **routing/handoff** — the inner behavior was already proven in
  Gates 1–2; the orchestrator/Telegram is the last thing wired, never the first test.

### Step 6: Bookkeeping + stop
If run inside a `/dev-stage` development, update the plan + changelog fragment as usual.
Commit, push, wait for CI green, then report to Or in plain Hebrew (what the agent does, that
each part was proven alone, that it's wired to the orchestrator and passed the gates) and
**stop** for his approval before dispatching `configure-agent-router.yml` to deploy.

## Safety Rules

1. **Always scaffold from `templates/n8n/subagent.template.json`** — never hand-roll an agent.
2. **Never add a Telegram node** (or any `webhook` / `telegramTrigger`) to a sub-agent — only
   the orchestrator (tg-inbound) speaks to the operator. Must pass `check-agent-single-voice.sh`.
3. **Never report a gate done while it is red, or skip a gate's functional proof.** CI-green
   alone is not "proven" — a part is done only when its fixture produces the expected output.
4. **Never reuse an existing `intent`** — check `agents.manifest.json` first.
5. **Never connect the orchestrator (or Telegram) first.** Prove every part alone (Gate 1) and
   the assembly alone (Gate 2) before wiring routing (Gate 3). No big-bang.
6. **Never deploy (dispatch `configure-agent-router.yml`) without Or's explicit approval.**
7. **Never give a sub-agent free SQL or a direct write tool** — writes route only through the
   approved `request_write_action` HITL path.
8. **Never skip Step 0.** Even a trivial agent gets the 4-line fast-path spec (incl. its
   prove-alone fixture line) saved to `docs/agent-specs/<intent>.md`. A multi-component agent
   must be an **orchestrating sub-workflow** of `{reply}`-returning sub-agents — never a
   handoff/transfer.

## Examples

**User:** "בנה סוכן שעונה על שאלות חשבוניות ותשלומים"

**Agent behaviour:**
Verdict: single agent. Confirms the intent (`billing`), asks for 3–5 example phrases, and in
the fast-path spec writes a **prove-alone fixture** (one real billing question → the expected
answer shape). Copies the template to `workflows/n8n/billing-agent.json`, fills
slug/model/system-message, registers it (manifest + router + configure + AGENTS), adds the
phrases to `tests/router_battery.yaml`. Gate 1: runs the agent alone on the fixture (Pin data
+ Test step) and confirms the answer; `check-agent-single-voice.sh` passes. Gate 3: routing
check, then reports to Or in Hebrew and waits for approval to deploy — never letting the agent
send Telegram.

**User:** "בנה סוכן שמטפל בטפסים מתוך מיילים — מזהה מייל רלוונטי, מושך את הטופס, ממלא מה שידוע עליי, ומשאיר לי מה שחסר"

**Agent behaviour (Step 0 full path):**
Runs the matrix and sees several distinct functions/modes (identify → fetch → extract → fill
→ mark-missing → hand back), so the verdict is **orchestrating-workflow**, not one agent.
Fills the full `templates/agent-design-spec.md`: each component as its own sub-agent with a
single responsibility, each returning `{reply}`, **and for each a §3 fixture → expected-output
row** (e.g. the form-reader: a sample form PDF → the expected fields JSON). States that an n8n
orchestrating sub-workflow composes one final `{reply}` (no transfer). Saves it to
`docs/agent-specs/forms.md`, summarizes for Or in one plain-Hebrew paragraph (what it does,
that it's several components wired under the orchestrator, **how each part will be proven
alone**, what gets checked), and — because it's a composite — proposes wrapping the build in
`/dev-stage`. Builds bottom-up: each component passes **Gate 1** on its own fixture before the
next; then **Gate 2** proves the assembly returns one correct `{reply}` without the router;
then **Gate 3** wires routing last. Only after Or's OK does it deploy.

**User:** "תוסיף סוכן שישלח לי ישירות הודעות סטטוס"

**Agent behaviour:**
Pushes back in plain Hebrew: a specialist agent never messages the operator directly — it
breaks the single-voice invariant and the CI gate would block it. Offers the conformant
alternative: the agent returns its status as `{reply}` to the orchestrator, who relays it; or,
for unsolicited pushes, a separate notification workflow (like `tg-proactive`), not a routed
agent.
