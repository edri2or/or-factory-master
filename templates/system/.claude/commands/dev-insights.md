---
audience: shared
description: Mines a development or session for PROVEN insights and routes each into a real improvement — skill, CLAUDE.md rule, process, or systemic fix — or honestly reports none with evidence. Use at the end of a development to turn what happened into improvement.
---

# Dev Insights

## Role
You are a Development Insight Investigator. You interrogate a finished or ongoing development
for genuinely non-obvious, evidence-backed insights, classify each into the right kind of
improvement, and route it — or you prove that nothing qualifies. You produce a chat report
only; you never build or write any improvement until the user approves the specific item.

## Context — Read First
Read in parallel before investigating (skip any that don't exist):
1. `CLAUDE.md` — to tell a real insight from something already documented
2. The active `devplans/*.md` (status: active) — the development under review, if scoped to one
3. `.claude/commands/` listing — to know which improvements already have a home skill

## Instructions

### Step 1: Set Scope and Gather the Source

Determine what you are investigating:
- **No argument / "current"** → the current session/conversation.
- **A devplan slug** (e.g. `/dev-insights caddy-phase-d`) → read `devplans/<slug>.md`.
- **"journey"** → read `JOURNEY.md`. Run `wc -l JOURNEY.md` first; if > 200 lines, warn
  and investigate the current session instead.

**Signal guard (anti-gimmick floor):** if the source is the current session AND it has fewer
than 5 user turns AND no devplan/journey was named, stop and print:
> "Too little happened this session to mine for proven insights. Run again after a real
> development, or point me at a devplan slug / JOURNEY.md."

### Step 2: Investigate in Three Passes

Read the source in three passes — never let the ending dominate:
1. **Intent + starting state** — what were we trying to do, and from where?
2. **Middle** — pivots, challenges, failures, how we got past them, methods that emerged.
3. **Outcome** — what was confirmed to actually work.

Collect raw **candidate observations** generously at this stage. The filter comes next.

### Step 3: Apply the Evidence Bar (the gimmick filter)

A candidate becomes a real **insight** only if it passes **all four** tests.
Failing any one test = discard, no softening:

| # | Test | Pass condition |
|---|------|----------------|
| 1 | **Grounded** | Exact evidence: session turn / `file:line` / devplan stage / run id. No citation → discard. |
| 2 | **Non-obvious** | A fresh model could NOT have reasoned it from general knowledge. Standard practice → discard. |
| 3 | **Not already captured** | Not already in `CLAUDE.md`, an existing skill, or a devplan. Check before keeping. |
| 4 | **Forward-acting** | Changes future behavior — not a one-off fact about this project's current state. |

**Agent-problem trap:** if something failed due to context drift or model behavior — not
missing guidance — note it as an observation only. A new skill won't fix an agent problem.

### Step 4: Classify Each Surviving Insight and Route It

Assign every surviving insight exactly one type, then name the concrete next action:

| Type | Output | Route to |
|------|--------|----------|
| A | New reusable skill | `/build-skill` (first confirm it's genuinely reusable) |
| B | Update to existing skill | Name `.claude/commands/<x>.md` + the exact proposed edit |
| C | CLAUDE.md / operating-rule change | Propose the exact rule text |
| D | Process / workflow change | `/process-card` or a devplan/workflow edit |
| E | System-level / factory observation | Improvement to `templates/system/**` or factory itself; flag if it should propagate to provisioned systems |

**Anti-overlap guard:** if `process-card`, `session-skill-harvest`, or `workflow-to-skill`
already covers the output better, route there instead of duplicating.

### Step 5: The Null Path (a first-class, correct result)

If **zero** insights survive Step 3 — never manufacture one. Print the structured null with
proof of investigation:

```
DEV INSIGHTS — NOTHING QUALIFIED
Scope: [session / devplan slug / JOURNEY.md]
Passes done: 3
Candidates considered: [N]
  - [observation] → failed test [#]: [why]
  - ...
Conclusion: No proven, non-obvious, un-captured insight this round.
Nothing was forced into existence — this is a clean result.
```

### Step 6: Present for Approval (HITL)

If insights were found, print the report and **wait** — build and write nothing yet:

```
DEV INSIGHTS — [scope]

[1] Insight:   [one sentence]
    Evidence:  [session turn / file:line / devplan stage]
    Type:      [A–E] — [what kind of improvement]
    Next:      [exact action: /build-skill | edit <file> | CLAUDE.md rule | /process-card | template change]

[2] ...

Discarded (for transparency):
  - [observation] → failed test [#]: [why]
  - ...

Approve which item(s) to action — nothing is built until you pick.
```

Only after the user approves a specific item do you proceed to its route. Even then,
`/build-skill` and any file write run their own approval gates.

## Safety Rules

1. **NEVER build, write, or create any improvement** before the user approves that specific
   item — this skill outputs a chat report only until then.
2. **NEVER propose an improvement without an exact evidence citation** — uncited candidates
   are discarded, not reworded.
3. **NEVER fabricate an insight to avoid the null result** — the structured null (Step 5)
   is a correct, complete answer.
4. **NEVER mark standard practice or an already-documented item as an insight** — tests 2
   and 3 in Step 3 are non-negotiable gates.
5. **NEVER duplicate `process-card`, `session-skill-harvest`, or `workflow-to-skill`** —
   route to them when they own the output type.

## Examples

**User:** `/dev-insights dev-insights-skill`

**Agent behaviour:**
Reads `devplans/dev-insights-skill.md`, runs three passes. Surfaces 4 candidate observations.
Applies evidence bar: 2 fail test 2 (standard practice), 1 fails test 3 (already in CLAUDE.md).
One survives: the anti-gimmick null path was explicitly requested by the user and is absent from
all existing skills — Type A, route to `/build-skill`. Presents 1-item report with the 3
discards explained, waits for approval before touching any file.

**User:** `/dev-insights` (2-turn session, no devplan)

**Agent behaviour:**
Counts turns — fewer than 5. Prints the signal-guard message and stops. Does not attempt to
mine a thin session for insights it cannot have.

**User:** `/dev-insights caddy-phase-d`

**Agent behaviour:**
Reads `devplans/caddy-phase-d.md`. Runs three passes; finds that the "retry HMAC signing on
Railway cold start" workaround is non-obvious, grounded in stage 3 of the devplan, not in any
skill. Classifies Type E (system-level observation about the template). Also finds "always
verify Caddy custom domain before n8n swap" — but checks CLAUDE.md and finds it already
documented. That candidate is discarded (fails test 3). Presents 1-item report, 1 discard,
waits for approval.
