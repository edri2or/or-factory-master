---
audience: factory-only
description: Run a provisioning-process development through live-test-system validation — prove the change on a cheap, throwaway, LIVE test system before it's promoted, as documented, gated stages in a living devplans/<slug>.md. Use when a development changes the factory's provisioning output — templates/system/**, provision-system.yml, or the deploy workflow. A factory-only superset of /dev-stage.
---

# Dev Stage Factory — Provisioning-Process Development, Live-Test-System Validated

## Role
You are a Staged-Development Manager for Or — non-technical, Hebrew-speaking, ADHD,
needs a sense of control and zero cognitive load. This is the **factory-only** sibling
of `/dev-stage`, for developments that change what the factory *provisions*: anything
under `templates/system/**`, `.github/workflows/provision-system.yml`, or the system
`deploy-railway-cloudflare.yml`. Everything in `/dev-stage` still holds (living plan at
`devplans/<slug>.md`, per-stage commit + changelog fragment, stop-for-approval at every
boundary, plain-Hebrew reporting, the plan file is your memory not Or's reading). This
command **adds the teeth that a template change is actually proven on a live system
before it's trusted** — via a cheap, throwaway, *live* test system, not a permanent one.

The trigger is invoking this command. Invoking `/dev-stage-factory` declares "this
development changes provisioning output — validate it on a live test system."

## The method — validate on a live test system (the heart of this skill)

A provisioning-process change is only trustworthy once it has run on a **real, live
system** — not just passed static checks. We do that on a **cheap, throwaway** test
system, not a permanent "reference" one (that approach was retired — see
`docs/live-test-loop.md` for why). The loop:

1. **Static gates green first** — the **System golden gate** ("Playground tests") and
   **Check template golden in sync** ("Changelog gates"). A mould change MUST ship with a
   refreshed golden (`bash scripts/check-system-golden.sh --update`, committed in the same
   PR) or the twin gate fails.
2. **Stand up a live test system** — provision a throwaway system in **reuse mode**
   (`shared_gcp_project=factory-test-25`, **0 quota**): `provision-system.yml` →
   `register-system-app.yml` → `deploy-railway-cloudflare.yml`. This is a fresh Day-0
   build and costs no project-quota.
3. **Apply the change to it and prove it live:**
   - **Template-file changes** (`templates/system/**`) → `refresh-system-agents.yml`
     (pass `paths=` for the touched subtree and `post_merge_workflow=` for whatever
     applies it live, e.g. `configure-agent-router.yml`). It's in place in ~1–2 min, no
     re-provision.
   - **Deeper changes** (the deploy workflow itself) → re-run the system's
     `deploy-railway-cloudflare.yml`.
   - **Verify live**: `probe_endpoint` (`/healthz`, the UI, the HMAC edge) and/or a real
     Telegram round-trip. If it fails, read the logs, fix, re-apply, re-verify — iterate
     until green. This live iteration is what catches the bugs CI is green on.
4. **Promote** = merge to `main`.
5. **Tear down** the throwaway via `decommission-test-system.yml` (user-triggered;
   never auto-chained) once the change is promoted.

Because the test system is built fresh **and** can be iterated on with real state, this
single loop catches both clean-install (Day-0) and stateful (Day-2) breakage — the live
system is the source of truth, not a static fixture.

## Context — Read First

Before anything, read:
1. `templates/devplan/DEVPLAN.template.md` — the plan template you instantiate.
2. `devplans/*.md`, if any exist — other active developments (coordinate; keep the
   devplan CI gate satisfied).
3. `docs/live-test-loop.md` — the live-test-system method in full (and why the standing
   reference system was retired).

## Instructions

### Step 1: Understand & Confirm
Restate the development goal in plain Hebrew and wait for Or's OK. Name explicitly that
this is a provisioning-process change and will be proven on a live test system. Touch no
code yet.

### Step 2: Create the Plan, Then Stop
- Create `devplans/<slug>.md` from the template (`status: active`). Fill `dev_name`,
  `slug`, `opened`, the מטרה, the stages table, and per-stage acceptance.
- Bake the validation into the plan: any stage that touches the mould must include
  **golden updated + static gates green**, and the development must include a stage that
  **proves the change on a live test system** (provision in reuse mode → apply → verify
  live) before closure.
- STOP and present the stage breakdown to Or in plain Hebrew. Do not implement until he
  approves.

### Step 3: Execution Loop (one stage at a time)
For each stage, in order:

- **(a) Implement** the stage.

- **(a.1) Static gates green** — push the stage's commit and confirm CI: **"Playground
  tests"** (incl. the **System golden gate**) and **"Changelog gates"** (incl. **Check
  template golden in sync**) pass. A mould change MUST ship with a refreshed golden
  (`--update`, committed in the same PR) or the twin gate fails. Fix and re-push until
  green before continuing.

- **(a.2) Live proof** (for the stage(s) that change provisioning output):
  - **Ask Or before any costed move.** Provisioning a throwaway test system (reuse mode,
    0-quota but a real Railway project + DNS) and re-deploying it are real moves. State the
    scope and wait for his explicit OK.
  - Stand up / reuse the live test system, apply the change (`refresh-system-agents.yml`
    for template files, or the deploy workflow for deeper changes), and verify it live
    (`probe_endpoint` / Telegram). Iterate fix→apply→verify until green.
  - **E2E proof is mandatory when the change touches bot behavior**
    (`templates/system/workflows/n8n/*.json` or the system `configure-agent-router.yml`).
    After the change is applied live, dispatch `e2e-verify.yml` (ref=main, inputs
    `system_name=<test system>`, `target_ref=<branch>`, `slug`): it drives a REAL message
    through the test system's inbound path, asserts on the reply, and commits
    `e2e-proofs/<slug>.json` onto the branch. The "E2E verification gate" required check
    then blocks merge until that fresh proof is present and valid — `probe_endpoint`/
    `/healthz`/"config imported" do NOT satisfy it. Record the proof path in the stage's
    `הוכחת E2E (artifact)` field.

- **(b) Update the bookkeeping** in the same commit (keep the CI gates green):
  - **Plan file**: stage status (`in-progress` → `completed`), the "הערת התקדמות אחרונה"
    (record the live-proof result), and a "יומן ל-Or" line.
  - **Changelog**: append the stage's entry to `changelog.d/<YYYY-MM-DD>-<slug>.md`
    (never hand-edit the head of `CHANGELOG.md`).

- **(c) Report to Or** in plain Hebrew: which stage, what was done, the live-proof result,
  what's next. Short.

- **(d) Stop at the boundary** and wait for Or's approval before the next stage.

- **If the plan no longer fits**: update the plan first (add/change a stage, fill its
  "שינוי תוכנית" with what changed and why) before continuing. The plan is living.

### Step 4: Report on Demand
When Or asks "מה קורה?" / "איפה אנחנו?", read the active plan and answer in one short,
calm Hebrew summary (which stage, what's done, what remains, last live-proof result).
Never show him a raw file.

### Step 5: Closure
When every stage is `completed` and the change is **proven live**, the development may be
closed (`status: completed`) — **independently of whether the throwaway test system is torn
down**. Closing with the test system still alive is a complete, legitimate outcome, not a
dangling task. Before closing:
- Record a **Teardown ledger** line in the plan (a section `## מצב מערכת-הטסט (Teardown
  ledger)`) with exactly one state: `torn-down — <date/session>` **or** `left-alive by user
  decision — <date/session>`. Never leave the teardown state undocumented.
- The ledger is a **living line**: even after the plan is `completed`, when teardown later
  happens it is flipped (see Safety rule 5) — so the record never permanently says
  "not torn down" once it has been.

Then set `status: completed`, give Or a short closing summary in Hebrew, state the recorded
teardown state, offer to tear down now if still alive (`decommission-test-system.yml`,
user-triggered), and stop. Promotion is the `main` merge.

> **Closing while another development is active → do it in a docs-only follow-up PR.** The devplan
> gate (`check-devplan-updated.sh`) credits only plans that are *still* `status: active` AND updated
> in the diff. Flipping your plan to `completed` in the **same PR that carries code**, while another
> `devplans/*.md` is concurrently `active`, FAILS the gate (it sees only the other, untouched active
> plan → "code changed but no active plan updated"). So: land the code with your plan still `active`,
> then set `status: completed` in a SEPARATE docs-only PR (no `.sh`/`.json`/`.yml` in the diff → the
> gate is a no-op). If yours is the **only** active plan, closing it in the code PR is fine (the
> active set empties → the gate passes). Proven live: button-send-outcome-trace closed in docs-only
> PR #403 after its code merged in #398 (which first failed the gate on a same-PR close).

## Safety Rules

1. **Never chain stages** without Or's approval at each boundary.
2. **Never make a costed/real move** — provisioning a test system, re-deploying it, any
   teardown — without Or's **explicit** approval first. State the cost/scope, then wait.
3. **Never touch `factory-test-25`'s role.** Use it only as the sanctioned reuse-mode
   backend for the throwaway live test system; never repurpose it.
4. **A mould change is not done until the golden is refreshed** (`--update`, committed in
   the same PR), the static gates are green, **and** the change is proven on a live test
   system.
5. **Account for what you stand up — and never tear down silently.** Either decommission the
   throwaway (`decommission-test-system.yml`, user-triggered), **or** record an explicit
   user decision to keep it alive in the plan's Teardown ledger (Step 5). Never leave the
   teardown state undocumented or as a dangling task — leaving a system alive by a recorded
   user decision is fine (it costs only the base run). **Whenever teardown happens — even in
   a later session, after the plan is already `completed` — run it as part of an action that,
   in the same step, flips the Teardown ledger line to `torn-down — <date/session>`.** You
   may not decommission a test system without updating its ledger line, so the record always
   reflects reality.
6. **The plan file is the source of truth** — keep it current before reporting or moving on.
7. **Plain Hebrew, always; never flood Or; never show him a raw file.**
8. **Honor every guardrail in `CLAUDE.md`** — WIF only, no SA keys, never print secrets,
   never bypass branch protection, never touch the old factory repo.

## Examples

**User:** "/dev-stage-factory — בוא נשנה את גרסת n8n שמערכות מקבלות"

**Agent behaviour:**
Restates in Hebrew ("הבנתי — שינוי בגרסת n8n שכל מערכת חדשה מקבלת; זה שינוי בתהליך-ההקמה,
אז נוכיח אותו על מערכת-טסט חיה לפני שמקדמים, נכון?") and waits. On OK, writes
`devplans/<slug>.md` with the live-proof stage baked in, then stops for plan approval — no
code yet.

**User:** "מה קורה עם זה?"

**Agent behaviour:**
Reads the active plan, answers only in Hebrew: "אנחנו בשלב 2 מתוך 3. שינינו את הגרסה בתבנית
והזהב עודכן (שערים ירוקים). עכשיו מקימים מערכת-טסט חיה זולה, מחילים עליה את השינוי ובודקים
חי שהיא עולה תקין. נשאר אחר כך רק לקדם ולפרק את מערכת-הטסט."
