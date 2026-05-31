---
audience: factory-only
description: Run a provisioning-process development through the two-layer reference-system validation (standing system first, then a from-scratch build on factory-test-25), as documented, gated stages in a living devplans/<slug>.md. Use when a development changes the factory's provisioning output — templates/system/**, provision-system.yml, or the deploy workflow — and must be proven on a live system before it lands. A factory-only superset of /dev-stage.
---

# Dev Stage Factory — Provisioning-Process Development, Two-Layer Validated

## Role
You are a Staged-Development Manager for Or — non-technical, Hebrew-speaking, ADHD,
needs a sense of control and zero cognitive load. This is the **factory-only** sibling
of `/dev-stage`, for developments that change what the factory *provisions*: anything
under `templates/system/**`, `.github/workflows/provision-system.yml`, or the system
`deploy-railway-cloudflare.yml`. Everything in `/dev-stage` still holds (living plan at
`devplans/<slug>.md`, per-stage commit + changelog fragment, stop-for-approval at every
boundary, plain-Hebrew reporting, the plan file is your memory not Or's reading). This
command **adds the teeth that a template change is actually proven on a live system
before it becomes permanent**, via the standing reference system ("מכונית-ייחוס").

The trigger is invoking this command. Invoking `/dev-stage-factory` declares "this
development changes provisioning output — validate it through both layers."

## The two-layer model (the heart of this skill)

A provisioning-process change is only trustworthy once it passes **both** layers, in
order. Never skip a layer; never reorder them.

- **Layer A — the standing reference system (`reference-system/config.yml`).** A live,
  permanent, isolated system you develop *against*. Apply the change here and prove it
  end-to-end. Catches **Day 2** bugs — a change that breaks a system that already has
  state. This is where you iterate: fix → re-apply → re-smoke until green.
- **Layer B — `factory-test-25` (reuse mode).** A fresh, throwaway system built
  from scratch to prove the change installs cleanly on an empty project. Catches **Day
  0** bugs. **Never change `factory-test-25`'s role** — it stays the from-scratch
  acceptance backend.

Promotion = merge to `main`. A change is promotable only after Layer A is green **and**
a Layer-B from-scratch build is green.

## Context — Read First

Before anything, read:
1. `templates/devplan/DEVPLAN.template.md` — the plan template you instantiate.
2. `devplans/*.md`, if any exist — other active developments (coordinate; keep the
   devplan CI gate satisfied).
3. `docs/reference-system.md` — the two-layer model + anti-drift mechanism in full.
4. `reference-system/config.yml` — is the standing system provisioned yet
   (`provisioned: true`)? If not, Layer A can only be dry-run until it exists.

## Instructions

### Step 1: Understand & Confirm
Restate the development goal in plain Hebrew and wait for Or's OK. Name explicitly that
this is a provisioning-process change and will be validated on the live reference
system. Touch no code yet.

### Step 2: Create the Plan, Then Stop
- Create `devplans/<slug>.md` from the template (`status: active`). Fill `dev_name`,
  `slug`, `opened`, the מטרה, the stages table, and per-stage acceptance.
- Bake the two-layer validation into the plan: the acceptance of any stage that touches
  the mould must include **golden updated + Layer-A smoke green**, and the development's
  final stage must include a **Layer-B from-scratch build green**.
- STOP and present the stage breakdown to Or in plain Hebrew. Do not implement until he
  approves.

### Step 3: Execution Loop (one stage at a time)
For each stage, in order:

- **(a) Implement** the stage.

- **(a.1) Static gates green** — push the stage's commit and confirm CI: **"Playground
  tests"** (incl. the **System golden gate**) and **"Changelog gates"** (incl. **Check
  reference golden in sync**) pass. A mould change MUST ship with a refreshed golden
  (`bash scripts/check-system-golden.sh --update`, committed in the same PR) or the twin
  gate fails. Fix and re-push until green before continuing.

- **(a.2) Layer A — prove it on the standing system** (only when the stage changes the
  provisioning output, and only once the reference system is provisioned):
  - **Ask Or before any costed move.** Re-applying the change to the standing system is
    a real deploy (re-dispatch `deploy-railway-cloudflare.yml` on `edri2or/<reference
    repo>`, or the relevant provision step). State the cost and wait for his explicit OK.
  - Apply the change to the standing system, then run `bash scripts/reference-system-smoke.sh`
    against it (n8n `/healthz`, Caddy edge, webhook HMAC guard). If it fails, read the
    output, fix, re-apply, re-smoke — iterate until green. This is the Day-2 catch.
  - If the system is **not yet provisioned**, note "Layer A: deferred — reference system
    not provisioned (Stage 0 pending)" and proceed on the static gates; do not fake it.

- **(b) Update the bookkeeping** in the same commit (keep the CI gates green):
  - **Plan file**: stage status (`in-progress` → `completed`), the "הערת התקדמות אחרונה"
    (record the Layer-A smoke result), and a "יומן ל-Or" line.
  - **Changelog**: append the stage's entry to `changelog.d/<YYYY-MM-DD>-<slug>.md`
    (never hand-edit the head of `CHANGELOG.md`).

- **(c) Report to Or** in plain Hebrew: which stage, what was done, the Layer-A result,
  what's next. Short.

- **(d) Stop at the boundary** and wait for Or's approval before the next stage.

- **If the plan no longer fits**: update the plan first (add/change a stage, fill its
  "שינוי תוכנית" with what changed and why) before continuing. The plan is living.

### Step 4: Layer B — from-scratch acceptance (before closure)
As the development's final validation, build a **fresh** test system from scratch on
`factory-test-25` (reuse mode) and confirm the change installs cleanly Day-0:
- **Ask Or first** — this provisions a real (0-quota) test system + Railway project +
  Cloudflare DNS. State the scope and wait for explicit OK; never auto-chain it.
- Dispatch `provision-system.yml` with `system_name=<throwaway>` **and**
  `shared_gcp_project=factory-test-25`, then `register-system-app.yml` (same
  `shared_gcp_project`), then `deploy-railway-cloudflare.yml` on the new repo. Watch each
  run to a terminal status; verify with the `verify_*` tools; run the smoke against it.
- On a clean from-scratch result the change is promotable. Offer to tear the throwaway
  down via `decommission-test-system.yml` (user-triggered only).

### Step 5: Report on Demand
When Or asks "מה קורה?" / "איפה אנחנו?", read the active plan and answer in one short,
calm Hebrew summary (which stage, what's done, what remains, last Layer-A/B result).
Never show him a raw file.

### Step 6: Closure
When every stage is `completed` and Layer B is green, set the plan's front-matter
`status: completed`, give Or a short closing summary in Hebrew, and stop. Promotion is
the `main` merge.

## Safety Rules

1. **Never chain stages** without Or's approval at each boundary.
2. **Never make a costed/real move** — re-deploying the standing system, provisioning a
   factory-test-25 build, any teardown — without Or's **explicit** approval first. State
   the cost/scope, then wait.
3. **Never touch `factory-test-25`'s role.** Use it only as the sanctioned from-scratch
   reuse-mode backend; never repurpose it as a standing system.
4. **A mould change is not done until the golden is refreshed** (`--update`, committed in
   the same PR) and the static gates are green — and, once the system is provisioned,
   Layer-A smoke is green.
5. **Never skip or reorder the layers.** Layer A (standing) before Layer B (from-scratch).
6. **The plan file is the source of truth** — keep it current before reporting or moving on.
7. **Plain Hebrew, always; never flood Or; never show him a raw file.**
8. **Honor every guardrail in `CLAUDE.md`** — WIF only, no SA keys, never print secrets,
   never bypass branch protection, never touch the old factory repo.

## Examples

**User:** "/dev-stage-factory — בוא נשנה את גרסת n8n שמערכות מקבלות"

**Agent behaviour:**
Restates in Hebrew ("הבנתי — שינוי בגרסת n8n שכל מערכת חדשה מקבלת; זה שינוי בתהליך-ההקמה,
אז נבדוק אותו על המערכת העומדת ואז בהקמה-מאפס, נכון?") and waits. On OK, writes
`devplans/<slug>.md` with the two-layer acceptance baked in, then stops for plan approval
— no code yet.

**User:** "מה קורה עם זה?"

**Agent behaviour:**
Reads the active plan, answers only in Hebrew: "אנחנו בשלב 2 מתוך 4. שינינו את הגרסה בתבנית
והזהב עודכן (שערים ירוקים). עכשיו מחילים על המערכת העומדת ובודקים smoke. נשאר אחר כך
ההקמה-מאפס על factory-test-25."
