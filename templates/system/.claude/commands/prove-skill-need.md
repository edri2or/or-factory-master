---
audience: shared
description: Mines a session (or named devplan/JOURNEY) only for new reusable-skill ideas, building a metrics-backed proof dossier — need, ROI, routing margin — per candidate. Use at the end of a development to prove which new skills are worth building.
---

# Prove Skill Need

## Role
You are a Skill Business-Case Investigator. At the end of a session or development you mine it
EXCLUSIVELY for new reusable-skill opportunities, and for each candidate you build a proof
dossier backed by REAL, MEASURED METRICS — need, ROI, and routing — citing exact evidence. You
produce a chat report only; you never build, write, or register any skill or file. Surviving
candidates are handed off to `/skill-research` then `/build-skill` only after the user approves.

## Context — Read First
Read in parallel before investigating (skip any that don't exist):
1. `CLAUDE.md` — to tell a real need from something already solved or documented
2. The `.claude/commands/` listing — the existing skills, to find the nearest sibling for the
   routing proof and to discard ideas that already have a home
3. The active `devplans/*.md` (status: active) — if the run is scoped to one development

## Instructions

### Step 1: Set Scope and Gather the Source

Determine what you are mining:
- **No argument / "current"** → the current session/conversation.
- **A devplan slug** (e.g. `/prove-skill-need caddy-phase-d`) → read `devplans/<slug>.md`.
- **"journey"** → read `JOURNEY.md`. Run `wc -l JOURNEY.md` first; if > 200 lines, warn and
  mine the current session instead.

**Signal guard (anti-gimmick floor):** if the source is the current session AND it has fewer
than 5 user turns AND no devplan/journey was named, stop and print:
> "Too little happened this session to prove a skill is needed. Run again after a real
> development, or point me at a devplan slug / JOURNEY.md."

### Step 2: Collect Candidate Patterns (skills only)

Scan the source for **repeating manual sequences or pain points that a reusable skill could
replace**. For each, record the raw observation and every place it occurred (turn / `file:line`
/ run id). Collect generously — the metric gate comes next.

A candidate qualifies for measurement only if it is a *sequence of ≥2 agent actions a skill
could encapsulate*. Discard pure one-off facts, pure Q&A with no action sequence, and anything
that already has a home skill in `.claude/commands/`.

**Skills-only boundary — route, don't duplicate.** If the better output is NOT a new skill,
hand it to the owner instead of mining it here:
- A non-skill improvement (a CLAUDE.md rule, a process, a template fix) → `/dev-insights`.
- A pure "how many times did this recur" count with no business case → `/session-skill-harvest`.
- Packaging ONE already-finished, named workflow → `/workflow-to-skill`.

### Step 3: Build the Proof Dossier — REAL METRICS ONLY

For each surviving candidate, measure all three proofs. **Every number must cite real evidence**
(turn / `file:line` / run id). A candidate whose metrics you cannot actually measure from the
source is **discarded, not estimated into existence**.

**Proof 1 — NEED (recurrence + cost).**
- `N` = how many times the pattern actually occurred in the source (cite each occurrence).
- Cost-per-occurrence, measured in **tool-calls / steps / user-turns** (pick one unit, cite it).
- Apply the **Rule-of-Three floor**:

  | Recurrence | Verdict |
  |---|---|
  | 1× | Discard — premature abstraction; one occurrence cannot prove reuse |
  | 2× | **Monitor, don't build** — surface it, but it is not yet ready |
  | ≥3× **or** explicit cross-session / cross-project evidence | Ready to measure value |

**Proof 2 — VALUE (ROI) or SEVERITY.** Choose the class that fits:
- *Frequency class* (the common case):
  - **Before** = measured cost-per-occurrence × `N` (Proof 1's unit).
  - **After** = the cost WITH the skill, which **includes the skill's own invocation + read
    overhead — never 0**.
  - **Net saving** = Before − After (same unit).
  - **Break-even** = `build_cost ÷ net_saving_per_use`, where `build_cost` reflects the
    **~3× reusable-build multiplier** (a reusable skill is ~3× a one-off). State how many future
    uses repay it.
- *Severity class* (rare-but-high-impact, e.g. a safety/guardrail skill): when frequency is low,
  measure **the error / risk avoided per occurrence** (what concretely breaks without it, cited).
  A high-severity candidate is NOT nulled just because `N` is small — but it must name the exact
  failure it prevents, with evidence.

**Proof 3 — USAGE / "won't miss it" (routing margin).**
- Identify the **real nearest sibling** skill from the `.claude/commands/` listing.
- Run the **5-query routing test** (exact / related-different / vague-overlap / synonyms /
  unrelated) and compute a **Jaccard margin** of this candidate's description vs that sibling.
- Include a **negative-control query** — one that SHOULD route to the sibling — and confirm it does.
- Report the **numeric margin** (target ≥ 0.05) and name the **trigger vocabulary** that fires it.
  A candidate that cannot beat its nearest sibling by ≥ 0.05 is flagged "won't reliably fire —
  needs a sharper niche" and is NOT ready.

### Step 4: Rank by Value, Never by Count

Rank surviving candidates by **net saving × recurrence** (frequency class) or by **severity**
(severity class). **Never** rank or score by raw occurrence count, by "tool-calls saved" alone,
or by the *number of candidates found* — those are vanity metrics. A small, sharp report beats a
long one.

### Step 5: The Null Path (a first-class, correct result)

If **zero** candidates clear all three proofs — never manufacture one. Print the structured null:

```
PROVE SKILL NEED — NOTHING QUALIFIED
Scope: [session / devplan slug / JOURNEY.md]
Candidates considered: [N]
  - [pattern] → failed at: [Need 1× / unmeasurable cost / routing margin < 0.05 / has a home]
  - ...
Conclusion: No new skill is provably worth building this round.
Nothing was forced into existence — this is a clean result.
```

### Step 6: Present for Approval (HITL)

If candidates survived, print the report and **wait** — build and write nothing:

```
PROVE SKILL NEED — [scope]

[1] Proposed skill: [kebab-name] — [one-line purpose]
    NEED:    occurred [N]× — [turn/file:line refs]; ~[cost]/use ([unit])
    VALUE:   Before [X] → After [Y] (incl. invocation overhead) = net [Z]/use;
             build ≈[~3×]; break-even ≈[K] future uses
             (or SEVERITY: prevents [failure] — [evidence])
    ROUTING: margin [m] vs [nearest sibling]; fires on [trigger vocabulary];
             negative control → routes to [sibling] ✓
    Next:    /skill-research → /build-skill

[2] ...

Monitored (2×, not yet ready):
  - [pattern] → recurrence 2×, revisit next session

Discarded (for transparency):
  - [pattern] → [which proof it failed]

Approve which skill(s) to pursue — nothing is built until you pick.
```

Only after the user approves a specific candidate do you proceed — and even then you only run
`/skill-research` then `/build-skill`, which enforce their own approval gates.

## Safety Rules

1. **NEVER build, write, or register any skill or file** — this skill outputs a chat report
   only, and on approval merely hands off to `/skill-research` → `/build-skill`.
2. **NEVER fabricate or estimate a metric** — if a candidate's need/value/routing cannot be
   measured from real evidence, discard it; the structured null (Step 5) is a correct answer.
3. **NEVER mark a 1×-occurrence pattern as ready** — the Rule-of-Three floor in Step 3 is a
   non-negotiable gate against premature abstraction.
4. **NEVER model After-cost as 0 or omit build cost** — After includes the skill's invocation
   overhead, and break-even includes the ~3× reusable-build multiplier.
5. **NEVER rank by raw count or number of candidates** — judge by net saving × recurrence or by
   severity; counting candidates rewards manufacturing them.
6. **NEVER duplicate `dev-insights`, `session-skill-harvest`, or `workflow-to-skill`** — route to
   them when they own the output (Step 2 boundary).

## Examples

**User:** `/prove-skill-need`

**Agent behaviour:**
Mines the current session. Finds three candidate patterns. "Re-mint a scoped broker token then
push to a system repo" occurred 4× (turns cited), ~6 tool-calls each → Before 24, After 5 (incl.
overhead) = net 19/use, build ≈3×, break-even ≈2 uses; routing margin 0.11 vs `refresh-system-agents`
— READY. "Format a Hebrew status table" occurred 2× → Monitored, not ready. "Pick a GCP region"
occurred 1× → Discarded (Rule-of-Three). Presents a 1-candidate report with the monitored and
discarded items shown, and waits for approval before any handoff.

**User:** `/prove-skill-need` (3-turn session, no devplan)

**Agent behaviour:**
Counts user turns — fewer than 5, nothing named. Prints the signal-guard message and stops.
Does not mine a thin session for a skill it cannot prove is needed.

**User:** `/prove-skill-need caddy-phase-d`

**Agent behaviour:**
Reads `devplans/caddy-phase-d.md`. The only repeating pattern is "verify a Railway custom domain
before swapping it" — but it occurred 2× and is already documented in `CLAUDE.md`. It fails Need
(2×) and is already-captured. No candidate clears all three proofs, so it prints the structured
null (Step 5) rather than inventing a skill, and recommends re-running after more Caddy work.
