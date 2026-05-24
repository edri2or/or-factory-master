---
description: Stage 7 closeout — Full System E2E + Autonomy Proof. Runs the 48h autonomy window, verifies dual proof (Level-1 rebuild, Level-2 hands-off), then marks the stage completed. Use after Stage 6.
synthesis-required: false
adapted-by: skill-adapter
adapted-on: 2026-05-24
---

# Stage 7 — Full System E2E + Autonomy Proof

## Role
You are a Release Engineer who closes out the final build stage. You do **not**
build new infrastructure — you observe, measure, and document. You launch a
48-hour autonomy window on the already-deployed Stages 1–6 system, collect five
operator [your-telegram] probes, verify that scheduled workflows and CI gates run
without any agent touch, and only then flip Stage 7 to `completed` in
`state.json`.

## Context — Read First

Before starting, read in parallel:
- `CLAUDE.md` — reconfirm Hard Rules #7 (no skipping E2E gates), #8 (dual
  autonomy proof), #10 (SKILL.md DoD).
- `state.json` — stages 0–6 must be `completed`, stage 7 `pending`.
- `[your-journey-file]` — last 3 entries for current context + any open routing-quality
  carry-overs (Macro-F1 → 0.95 lift).
- `docs/system/BUILD-STAGES.md` — Stage 7 section: goals, E2E test matrix,
  dual-autonomy-proof definition.
- `docs/adr/` — journal architecture ADR (why `state.json` + hot JOURNEY).
- `docs/adr/` — SKILL.md DoD enforcement ADR.
- `workflows/n8n/agent-router.json` — the `Classify` system prompt (only edit
  if the Macro-F1 lift to 0.95 is the first action inside the window).
- `.github/workflows/documentation-enforcement.yml` — confirm it is a
  **required** status check on `main` (Branch Protection).

## Architecture (one-glance)

```
48h observation window  (clock starts when the operator fires the first probe)
  │
  ├─ Operator Telegram probes ×5 ──────▶ Router (Classify)
  │                                       ├─▶ ops-agent   → live healthz reply
  │                                       ├─▶ code-agent  → GitHub PR/branch reply
  │                                       ├─▶ research-agent → OpenRouter reply
  │                                       └─▶ unknown/clarification path
  │
  ├─ Scheduled workflows on cron ──────▶ rotate-journey.yml + any nightly
  │                                       jobs run **without agent involvement**
  │
  ├─ Railway uptime poll (curl loop) ──▶ >99% over 48h on healthz/readiness
  │
  └─ CI required status check ─────────▶ A test PR omitting a JOURNEY update
                                         MUST be blocked by
                                         documentation-enforcement.yml
```

Three evidence streams, one stage flip. No infrastructure changes in this
stage — only observation + documentation.

## Prerequisites

| Prerequisite | Why | How to verify |
|---|---|---|
| Stages 0–6 complete in `state.json` | Entire platform stack must be live before the autonomy window | `jq '.build_stages[] \| select(.status!="completed") \| .number' state.json` returns only `7` |
| Macro-F1 ≥ 0.95 (target) | Weak router produces false operator frustration inside the 48h window | Re-dispatch `configure-subagents.yml`, read the `Macro-F1: X.XXX` line |
| `rotate-journey.yml` scheduled | Level-2 evidence stream — journal maintenance with no agent touch | `grep -n "schedule:" .github/workflows/rotate-journey.yml` |
| `documentation-enforcement.yml` is a **required** status check | Final E2E matrix test #6 depends on this being unbypassable | Confirmed via GitHub Branch Protection UI (operator action); recorded in an ADR if changed |
| Operator has 5 test commands ready | Evidence for E2E matrix test #2 | Operator confirms in [your-telegram] before the window opens |
| SKILL.md registered in `plugin.json` | Hard Rule #10 DoD | `grep -n "stage7-full-system-e2e" .claude/plugins/engineering-std/.claude-plugin/plugin.json` returns 1 |
| [your-journey-file] < 200 KB | Retention safety threshold (per your journal rotation policy) | `[ "$(wc -c < [your-journey-file])" -lt 204800 ]` |

## Instructions

### Step 1: Verify prerequisites + open a fresh Stage-7 branch

```bash
# Stages 0–6 completed?
jq '[.build_stages[] | select(.number<7 and .status!="completed")] | length' state.json
# MUST output 0. If not, halt — Stage 7 cannot begin.

# Branch
git rev-parse --abbrev-ref HEAD   # expected: claude/stage7-e2e-<slug>
```

### Step 2: (Conditional) Lift Macro-F1 from 0.893 → ≥ 0.95

Only if the last recorded Macro-F1 in `[your-journey-file]` is < 0.95. Edit the
`Classify` system prompt in `workflows/n8n/agent-router.json` — add 1–2
few-shot examples of short colloquial Hebrew probes that currently miss
(`"איך N8N?"` → `ops`, `"מה עם ה-PR?"` → `code`). Then hand the operator this
Hebrew instruction:

> הפעל ב-GitHub Actions את `configure-subagents.yml` על `claude/stage7-e2e-<slug>`.
> דווח לי את הערך של `Macro-F1: X.XXX`.

Acceptance: Macro-F1 ≥ 0.95. Record the value + run ID in [your-journey-file].

### Step 3: Open the 48-hour observation window

Record the **window open timestamp** in [your-journey-file] (UTC). From this moment
the agent does **nothing active** except:
- Poll `https://n8n-production-c7305.up.railway.app/healthz/readiness` once
  per hour ([your-railway] service-health evidence; direct hostname because the
  [your-cloudflare] edge is currently 503-ing per the Known-Failures row and the
  operator [your-telegram] path bypasses [your-cloudflare] anyway) via
  `curl -s -o /dev/null -w "%{http_code}"`. ~48 samples over 48h resolves a
  99%-uptime gate cleanly (1% of 48h ≈ 29 min, well inside one bucket).
- Log non-200 responses to a bounded scratchpad: keep the first 20 + a
  total count; collapse runs of identical status codes to a single line
  with start-timestamp + duration.
- **Do not** dispatch workflows. **Do not** edit N8N. **Do not** answer
  operator questions about system state beyond repeating what CLAUDE.md /
  state.json already say.

If a scheduled workflow fires inside the window (e.g., `rotate-journey.yml`
around 2026-07-01), record the run ID + outcome — this is Level-2 evidence.

### Step 4: 5-command operator probe battery

Hand the operator this Hebrew brief once at window open:

> במהלך 48 השעות הקרובות, שלח לבוט בטלגרם 5 הודעות בסגנונות שונים:
> 1. `/status`
> 2. הודעה חופשית למצב שירותים (למשל: `מה מצב השירותים?`)
> 3. הודעה חופשית על PR/branch (למשל: `תבדוק את ה-PR האחרון`)
> 4. הודעה חופשית מחקרית (למשל: `תסכם לי את הלוגים מהיום`)
> 5. הודעה לא ברורה או בשפה זרה (למשל: `random english text`) כדי לבדוק את נתיב `unknown` / clarification.
>
> אחרי כל הודעה — שלח לי את התשובה שקיבלת. אני רק רושם, לא מתערב.

For each probe record: operator text, timestamp, intent classified,
sub-agent that replied, reply text, latency. A probe passes if:
- The classified intent matches the operator's apparent intent, **or**
- The `unknown` clarification path fires on probe #5.

Acceptance: 5/5 probes pass. No retry; the operator is the source of truth.

### Step 5: Level-2 — System runs without agent intervention

Over the 48h window, collect evidence that the deployed system runs without
the contractor agent being in the loop:
- [your-telegram] bot responded to all 5 probes with no agent dispatch.
- [your-railway] uptime ≥ 99% on `healthz/readiness` (out of ~48 hourly polls, at
  most one non-200 allowed).
- GCP Secret Manager access log (operator pulls via console or [your-telegram]
  `/audit`): 0 unauthorised access attempts over the window.
- Any scheduled workflow that fires inside the window completes green.

Record all four streams with timestamps and run IDs in the JOURNEY entry.

### Step 6: Level-1 — Fresh-session rebuild proof

Simulate a brand-new contractor-agent session. In a separate session (or a
fresh context): read only `CLAUDE.md` + `state.json` + `[your-journey-file]` (hot).
Write a short rebuild narrative (no code changes committed) that describes,
end to end, how the session would re-deploy Stage 7 — which workflows to
dispatch, in what order, and which ADRs govern each step. Paste the narrative
into the JOURNEY entry under a `Level-1 rebuild rehearsal` sub-section.

Acceptance: the narrative cites only documents the fresh session can read
from the repo — no "I remember from last session" references.

### Step 7: CI required-status-check test (E2E matrix #6)

Open a throwaway branch with a source-only change (e.g. edit a comment in
`src/agent/index.ts`) and **no** JOURNEY update. Push, open the PR, confirm
`documentation-enforcement` fails red with the `[journey]` violation. Close
the PR without merging. Record the PR number + failure output in the
JOURNEY entry.

⚠ Do **not** actually merge this PR — its whole purpose is to prove the
gate still blocks. `git push --delete origin <branch>` after closing.

### Step 8: Flip Stage 7 to `completed` + commit + push + open PR

Only after Steps 3–7 are all acknowledged green. Edit `state.json`:

```json
{ "number": 7, "name": "Full System E2E + Autonomy Proof", "status": "completed" }
```

Also refresh `updated_at`, `last_session`, and `next_actions` per
`state.schema.json` (remove completed Stage-7 items; keep the Iter-6 and
Level-3 carry-overs).

Append one `[your-journey-file]` entry covering all four evidence streams + the
dual-autonomy proof + the CI test.

```bash
git add state.json JOURNEY.md CLAUDE.md \
        .claude/plugins/engineering-std/skills/stage7-full-system-e2e/SKILL.md \
        .claude/plugins/engineering-std/.claude-plugin/plugin.json
git commit -m "feat(stage7): closeout — 48h autonomy window green + Stage 7 completed"
git push -u origin claude/stage7-e2e-<slug>
```

Open PR. Expected CI: `check_skill()` walks the plugin tree, finds
`stage7-full-system-e2e/SKILL.md` registered in `plugin.json`, passes. If
the SKILL.md is missing from `plugin.json`, the enforcer still passes today
(the check is filesystem-based) but the loader will not discover it — catch
this in local review.

## Known Failures and Fixes

| Failure | Symptom | Root Cause | Fix |
|---------|---------|-----------|-----|
| Macro-F1 lift regresses | Post-tightening F1 lower than 0.893 | Over-specific few-shot starves other intents | Revert the prompt edit; try a smaller additive change (one example at a time) |
| [your-cloudflare] edge 503 / Error 1016 at `[your-system].[your-domain]` | `curl` to `[your-domain]` returns 503 "DNS cache overflow" / [your-cloudflare] Error 1016 (Origin DNS error); [your-telegram] probes via bot are **unaffected** | Stage-1 CNAME placeholder in `bootstrap.yml` pointing to `"railway.app"`; Stage-2 CNAME update never delivered (proven by a forensic audit ADR) | `configure-telegram-n8n.yml` resolves `N8N_DOMAIN` from [your-railway] GraphQL and bakes the **direct [your-railway] hostname** into both `WEBHOOK_URL` ([your-telegram] `setWebhook`) and `AGENT_ROUTER_URL` (Router dispatch). The [your-telegram] → N8N path bypasses [your-cloudflare] entirely, so an edge 503 is **not a Stage 7 blocker**. See your project's forensic audit ADR for the remediation plan (`fix-cloudflare-cname.yml` queued for post-window dispatch) |
| Scheduled workflow fails in-window | `rotate-journey.yml` red on its first run | Quarter boundary logic, token drift, etc. | Level-2 fails. Fix the workflow in a separate PR. Restart the 48h clock after merge |
| `check_skill()` passes but skill not discoverable | Plugin loader can't find SKILL.md | Not registered in `plugin.json` skills array | Append `"skills/stage7-full-system-e2e/SKILL.md"` to `plugin.json` |
| CI test #6 does not fail | Throwaway PR merges green without JOURNEY update | `documentation-enforcement` is not a required check | Operator toggles it to Required in Branch Protection, records action in a new ADR (per your branch-protection Hard Rules) |
| [your-journey-file] near 200 KB | Rotation threshold approaching | Hot-only retention per your journal rotation policy | Let the scheduled auto-rotation fire; or run `scripts/rotate-journey.sh` manually — both are acceptable Level-2 evidence |
| Operator asks agent to dispatch a workflow mid-window | Agent tempted to "just this once" act | Narrative erosion | Refuse politely in Hebrew, point at CLAUDE.md Hard Rule #8, record the refusal in JOURNEY |

## Safety Rules

1. **NEVER** flip Stage 7 to `completed` before all four evidence streams
   (5/5 probes, 99% uptime, 0 unauthorised secret access, scheduled workflow
   green) are documented in `[your-journey-file]`. Hard Rule #7 + #8.
2. **NEVER** print, log, or commit any of: `TELEGRAM_BOT_TOKEN`,
   `OPENROUTER_API_KEY`, `GITHUB_PAT_ACTIONS_WRITE`, `N8N_OWNER_PASSWORD`,
   `N8N_SECRETS_BROKER_TOKEN`, `AGENT_SESSION_OTP`, `RAILWAY_TOKEN`, or any
   GCP SM secret value.
3. **ALWAYS** register a new SKILL.md in
   `.claude/plugins/engineering-std/.claude-plugin/plugin.json` skills array
   in the same commit as the SKILL.md itself — otherwise the plugin loader
   can't discover it even though `check_skill()` passes on the filesystem.
4. **ALWAYS** communicate with the operator in Hebrew, short sentences,
   with analogies, per `CLAUDE.md` Operator Profile.
5. **ALWAYS** end multi-step operator updates with `ממתין לאישורך`.
6. **NEVER** shorten the 48h observation window without a new ADR. The
   number is drawn from BUILD-STAGES.md and industry operational-readiness
   soak-test norms.
7. **NEVER** dispatch a workflow during the observation window on the
   operator's behalf — the window's purpose is to prove the operator does
   not need the agent. Refuse politely; point at CLAUDE.md Hard Rule #8.
8. **NEVER** merge the Stage 7 closeout PR if `check_skill()` is red.

## Examples

**User:** `/stage7-full-system-e2e` (Stages 0–6 completed, Macro-F1 = 0.893
recorded in [your-journey-file], branch `claude/stage7-e2e-autonomy-5Mj3c` checked
out)

**Agent behaviour:**
Reads `state.json`, `[your-journey-file]` last three entries, `CLAUDE.md`. Confirms
Stages 0–6 completed, Stage 7 pending. Notes Macro-F1 < 0.95 → proposes
Step 2 tightening. Hands the operator the Hebrew dispatch brief for
`configure-subagents.yml`. On operator reply of `Macro-F1: 0.962`, records
in JOURNEY and opens the 48h window in Step 3. Sends the 5-command probe
brief to the operator. Polls healthz every 30 min. After 48h + 5/5 probes
+ clean uptime + CI test #6 red + Level-1 rehearsal written, flips
`state.json` and pushes. Ends with `ממתין לאישורך`.

**User:** `/stage7-full-system-e2e` (operator reports only 3/5 probes
replied correctly over 24h)

**Agent behaviour:**
Does **not** flip Stage 7. Identifies the two failing probes — e.g. probe
#3 (code-agent) returned an empty reply; probe #4 (research-agent) timed
out at 30s. Opens an ADR or JOURNEY follow-up, proposes a fix in the
relevant sub-agent workflow, asks the operator to re-dispatch
`configure-subagents.yml` after the fix lands, **restarts the 48h clock**.
Records both partial-window JOURNEY entries — failures are audit-trail
evidence, not errors to delete.

**User:** `/stage7-full-system-e2e` (during the window, external `curl` to
`[your-system].[your-domain]` returns 503 but operator [your-telegram] probes
keep succeeding)

**Agent behaviour:**
Notes the [your-cloudflare]-edge 503 in the bounded scratchpad with start time +
duration. Does **not** pause the window clock — the operator [your-telegram]
path resolves to the direct [your-railway] hostname, and uptime is measured
against `/healthz/readiness` on that same hostname (Step 3 + Step 5). The
503 is a Level-3 follow-up observation, not a Stage-7 gate failure.
Continues observing until the recorded window-close timestamp.
