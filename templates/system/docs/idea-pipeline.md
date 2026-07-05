# The idea pipeline — capture → organize → choose+prep → build → close-out

Or's pipeline for turning scattered spoken ideas into an organized, prioritized list — and then
into a chosen, prepared, ready-to-build item. Every skill **publishes to GitHub via a PR** —
nothing lives only in the ephemeral container. Building stays a distinct step; Or's decision to
build is never skipped. Clear owners, clean boundaries:

| Stage | Owner | Does | Does NOT |
|---|---|---|---|
| **1. Capture** | `raw-input-collection` skill | Listen to Or's loose Hebrew idea-dump, work out the intent, file one card per idea into `inbox/`, then **push + open a PR** | Rank, organize, build, execute |
| **2. Organize** | `inbox-organizer` skill | Read all cards, rank them, (re)write the standing list `inbox/backlog.md`, then **push + open a PR** | Build, touch `/dev-stage`, change the cards |
| **3. Choose + prep** | `backlog-picker` skill | Present the top-of-order item, walk Or through that card's open questions, run a readiness check, write a short bounded "ready brief", mark the chosen card `status: in-development`, then **run the research-need triage (§ below) and hand off — either research-first (`/aios-research-partner`) or straight to `/dev-stage`** | Rank (skill #2), capture (skill #1), or build — it only chooses + prepares + hands off |
| **4. Build** | `/dev-stage` (`.claude/commands/dev-stage.md`) | Take the chosen, prepared item, author `devplans/<slug>.md`, and run the staged build — with its **one plan-approval gate** (the human checkpoint) | Get invoked automatically by skill #2 |
| **5. Close-out** | `/dev-stage` Step 5 (`.claude/commands/dev-stage.md`) | On a finished build that came from a backlog card: mark the card `completed`, archive the devplan, file a one-line record in `inbox/completed.md` — so the item leaves the active list yet stays documented | Delete the card; leave a finished item ranked; keep the devplan at `devplans/` top level |

Between stage 3 and stage 4 there are **two on-ramps** to the build, and stage 3 chooses which — see
**Research-need triage** below.

The separation is deliberate: capture stays unbiased raw material, organizing is a distinct
deliberate pass that only *sorts* (never builds), choosing + prep is where Or decides **with a
co-pilot** — options laid out, open questions resolved, readiness checked — so the build starts on
checked ground, and building itself runs through `/dev-stage`'s gated stages. Nothing skips a human
where a human belongs: the choice is Or's, and the build checkpoint stays a human gate — either
`/dev-stage`'s plan-approval gate (the light path) or, when an item is routed to research first, the
goal-and-research approval inside `aios-research-partner` (see the gate-difference note in the triage
section).

## State-marking — how an item leaves the list into development

When `backlog-picker` (skill #3) commits an item to a build, it sets that item's **source card**
frontmatter `status: unprocessed → in-development` and adds a `devplan: devplans/<slug>.md` pointer
(a status-only edit — never the card's `## Raw` or `## Understood intent`). On the next organize
run, `inbox-organizer` (skill #2) reads that status and lists the card under a separate
**"🏗️ In development"** note at the top of `inbox/backlog.md` instead of in the active "what to
build next" ranking — so an item already in flight is never re-suggested, and the list stays an
honest picture of what's parked, what's ranked, and what's being built.

## Stage 5 — Close-out (how a finished item leaves the list, still documented)

The card lifecycle is `unprocessed → in-development → completed`. When a build **finishes** (merged
/ done), `/dev-stage` Step 5 closes the loop for a card-sourced build with three status-only actions:

1. **Mark the card `completed`** — flip its front-matter `status: in-development → completed` and
   repoint `devplan:` to the archived plan (never touch `## Raw` / `## Understood intent`).
2. **Archive the devplan** — move `devplans/<slug>.md` → `devplans/archive/<slug>.md`.
3. **File a "done" record** — append one line to **`inbox/completed.md`** (topic + completion date +
   archived-devplan link + source-card path). This is the append-only completed log; `inbox-organizer`
   never rewrites it and skips it when gathering cards.

A `completed` card is **dropped from `inbox/backlog.md` entirely** — not ranked, and not in the
"🏗️ In development" note. So the active list holds only real work-to-do, while every finished item
stays permanently documented in `inbox/completed.md` and the devplan archive — a built item leaves the
list without being lost. (A build not opened from a backlog card skips Stage 5.)

## The backlog is always current (auto re-organize — not just "remove the card")

**Invariant:** `inbox/backlog.md` always reflects the **current card set, fully re-ranked and
renumbered** — never a stale list with a finished item still in it, and never a hole. Removing a
completed card is not enough on its own; the list must **re-run the whole organize process** (re-score
by impact → renumber 1..N → recompute `parallel-with`). `inbox-organizer` (skill #2) is the sole owner
of that process; it "rewrites the list wholesale each run". Two automatic triggers invoke it so Or
never has to remember to re-organize:

1. **At close-out (eager).** `/dev-stage` Step 5, right after marking a card `completed`, runs
   `inbox-organizer` to regenerate `backlog.md`. So the moment a build finishes, the list is already a
   fresh, re-ranked, renumbered picture — even if Or opens `backlog.md` directly.
2. **At pick-time (self-heal guarantee).** `backlog-picker` step 0, before presenting, checks whether
   `backlog.md` is stale (contains a card now `completed`/`in-development`, or is out of sync with the
   `inbox/` cards) and, if so, runs `inbox-organizer` **first**, then presents. So opening
   `backlog-picker` in a new session **always** shows a freshly organized list — regardless of how
   staleness arose. (`backlog-picker` only *triggers* the re-organize; it never ranks itself — that
   would violate its boundary.)

Concretely: finish item #4 → close-out drops it and the list becomes 5 items, renumbered 1..5 with
`parallel-with` recomputed → a new session's `backlog-picker` confirms it's current and presents the
fresh five. The re-organize happened automatically; the numbering and ranking updated *in response to*
the removal, not merely around it.

## Truth discipline (across the whole chain)

Every stage of this pipeline reads or transforms Or's own words, and a fabricated read poisons every
later stage. So one **truth discipline** binds all of them — the same principle the session's
`truth-protocol` applies to factual answers, scoped here to idea-processing:

- **No invention** — never add an idea, intent, ranking, dependency, open question, or routing verdict
  that Or's words / a real card / a verified system fact do not support.
- **Trace to source** — every claim traces to a real line (the card, `backlog.md`, a file, a named
  query). No source → it does not go in.
- **Tag confidence** — carry a `[High] / [Medium] / [⚠️ Low]` tag on each judgment (ranking scores,
  brief decisions, the triage verdict), so uncertainty is visible, not hidden.
- **Declare insufficiency** — if the material is too sparse to decide, say so and ask Or (or mark it an
  open question) rather than filling the gap with a guess.

This is not a new rule bolted on — it is already how the chain works: `raw-input-collection` keeps the
raw block verbatim and never invents intent; `inbox-organizer` "never invents an item or dependency not
evidenced in a card"; `backlog-picker` "does not invent — every claim traces to a real card or a
verified system fact"; and the research-need triage below states it as guarantee **G1**. The
`aios-research-partner` runs the fuller `truth-protocol` (verified/speculative, sourced 3-round
verification) because it makes external factual claims; the capture/rank/prep skills apply the
principle above, not the full session ceremony.

## Research-need triage (stage 3.5) — which on-ramp to the build

There are **two on-ramps** from the chosen item to the build, and `backlog-picker` (stage 3) decides
which one, right after its readiness check and before the hand-off:

- **Light path** — `backlog-picker` → `/dev-stage`. Keeps `/dev-stage`'s **plan-approval gate** as the
  human checkpoint. The default.
- **Research path** — `backlog-picker` → `/aios-research-partner` → (`handoffs-dev-stage` bridge) →
  `/dev-stage`. The research partner does its 12-step deep research (repo touch-points + a verified
  3-round web research → synthesis → plan → handoff), and the bridge then starts `/dev-stage`
  **without** its plan-approval gate — because the research **is** the more-informed approval.

### The decision — a measured scorecard, not a vibe

Most inputs are **discrete fields already computed** by `inbox-organizer` and written into
`inbox/backlog.md`, so the same item scores the same way twice (repeatable = measured).

**Hard signals — any ONE routes to research:**
- **H1. Change tier = 🔴** — architecturally significant (multi-component / hard to reverse / real
  trade-off). Read straight from the backlog row's `tier` column (rubric = Axis B below). A 🔴 item's
  trade-off is exactly what the research partner's synthesis (its "Conflict → Decision" step) exists for.
- **H2. New capability/verb with no repo precedent to copy** — the capability-first flag `backlog-picker`
  already computes in its readiness check, AND no existing agent/workflow already does this verb. (This
  decides the *design*; `/dev-stage` Step 0 capability-first still separately proves the raw brick.)
- **H3. Correctness depends on an external fact** — a bounded yes/no checklist: does the item name a
  third-party system/API not yet integrated? does it need a best-practice / security-model /
  pricing-or-limits fact that is **not** in the repo? Only the research partner does verified,
  sourced web research; the pipeline's readiness check only verifies *internal* facts.

**Soft signals — need TWO together to route:**
- **S1. Priority confidence = `[⚠️ Low]`** — the ranking itself wasn't sure. Read from the backlog's
  confidence tag.
- **S2. The chosen item's open questions are about approach/design**, not just parameters Or can
  answer on the spot.

**Threshold:** any hard signal → research; else ≥2 soft signals → research; **else → straight to
`/dev-stage`** (the conservative default).

### What makes it reliable (four guarantees)

- **G1. Evidence-required** — every signal must cite a real line in the card/backlog; **no evidence →
  the signal is not counted.** This IS the truth discipline (see § Truth discipline) applied to the
  decision, and it mirrors `backlog-picker`'s existing "do not invent — every claim must trace to a
  real card or a verified system fact" and the research partner's `verified`/`speculative` rule.
- **G2. Written trace** — the scorecard result + its cited evidence + a `[High]/[Medium]/[⚠️ Low]`
  confidence tag are written into the "ready brief" (the `process-card` discipline), so a past
  routing decision is auditable, not "I said so once".
- **G3. Or confirms** — the route + its evidence are presented in one plain-Hebrew line; Or can
  override (force research or force the light path). Never a silent auto-route. If routed to research,
  `aios-research-partner` **also** restates the goal and stops for Or's OK at its own Step 1 — a
  natural second confirm; `backlog-picker` does **not** suppress that stop.
- **G4. Conservative + reversible** — the default is the cheap path; research fires only on a real
  trigger (so a trivial 🟢 item is never dragged through the heavy 12-step engine); and if the research
  turns out shallow, its handoff still lands in `/dev-stage` — nothing is lost.

### The honest limitation

This is a repeatable, evidence-backed scorecard over **pre-assigned discrete fields** — it is **not** a
deterministic CI gate. H3 and S2 keep a bounded judgment core, and the decision is only as good as the
upstream `tier`/`confidence` tags (a mis-tag is caught by G1's evidence requirement and G3's human
confirm). Reliable and measured to the standard the rest of this system uses for accountable judgment
calls — without pretending to be fully deterministic.

### The gate-difference note (must be a conscious choice)

Routing an item to research **moves where Or approves**: the light path approves the `/dev-stage`
plan; the research path drops that gate and moves Or's approval to the goal-and-research inside
`aios-research-partner`. For a 🔴 architectural item this is *better* (he approves from full research,
not a blind plan) — but it must be a deliberate choice, surfaced to Or, never a silent side-effect.
What never changes on either path: `/dev-stage` Safety Rule 5 (a stop before any costly/irreversible
move), all CI gates, and every system red-line.

### Route preview (in the ranked list)

`inbox-organizer` (stage 2) surfaces an **advisory route** per ranked item in `inbox/backlog.md` — a
`route` column, 🔬 research-first / 🛠️ build-direct — computed from the scorecard's **hard signal it can
already see** (mainly H1: change-tier 🔴 → 🔬; and H2 where a no-precedent capability is evident). This is
a **preview, not the verdict**: it lets Or see at a glance which items will likely need research first,
without waiting until pick-time. The **authoritative** triage — the full scorecard, the cited evidence,
and Or's confirm (G1–G3 above) — still runs in `backlog-picker` when the item is actually chosen, and can
override the preview. Consistent with the honest-limitation note: the preview reads a discrete pre-assigned
field (the tier), it is not a deterministic verdict.

## The `inbox/` contents

- **Idea cards** — plain `.md` files `inbox/<YYYY-MM-DD>-<short-english-slug>.md` (see
  `.claude/skills/raw-input-collection/SKILL.md` for the authoritative format):

  ```
  ---
  captured: <YYYY-MM-DD>
  topic: <short English title>
  kind: <thought|goal|desire|test|task|question>
  status: unprocessed          # a simple marker; skill #2 reads every card and never changes it
  ---
  ## Raw (verbatim)            # Or's exact Hebrew words — source of truth, never paraphrased
  ## Understood intent         # English structured read of the ask
  ```

  Skill #1 appends cards and PRs them; skill #2 reads them but never edits, restatuses, or deletes
  a card.

- **`inbox/backlog.md`** — the standing organized list, rewritten wholesale by `inbox-organizer`
  each run. It is always "the current picture" Or browses and picks from.

## The ranking method (stage 2)

Two independent axes plus a sequencer. It is a tuned blend of established prioritization frameworks,
adapted for a **single operator** (so RICE's "Reach" is dropped — there is one user) and kept
ADHD-simple.

### Axis A — priority (how important / what first)

1. **Eisenhower triage** (urgent × important) → **Do** / **Schedule** / **Delegate-automate** /
   **Drop**. Cuts noise before scoring.
2. **Priority score** (simplified ICE / WSJF):
   `priority = (Impact + Urgency + Unblocks-others) ÷ Effort`
   - Impact, Urgency, Unblocks-others — each 1–5.
   - Effort — t-shirt size: XS=1, S=3, M=5, L=8, XL=13.
   - Higher = sooner. Each score carries a confidence tag `[High] / [Medium] / [⚠️ Low]`.

### Axis B — change tier (how heavy a system change)

Based on the "architecturally significant" test used to decide when a change warrants an ADR
(structure / blast-radius, reversibility, real trade-off):

- 🔴 **high** — multi-component, hard to reverse, or a genuine trade-off (n8n workflows, the router,
  DB schema, agent-org topology). Would need the full `/dev-stage` treatment (E2E proof, maybe an
  ADR) **if and when Or chooses to build it**.
- 🟡 **middle** — real code/scripts/docs, but not architecture.
- 🟢 **low** — additive, self-contained (a new skill/doc/helper) — breaks nothing.

Axis B does not change the Axis A priority number; it sets how heavy the build is and the
order-of-safety.

### Axis C — parallelizability (can two run at once)

For the current run's ranked items 1..N, compute for **each** item which *others* it can be built
**in parallel** with — the point being that Or can open **two separate Claude Code sessions** and
run both without them clashing (not running two builds in one session).

Two items **conflict** (not parallel-safe) if either:
- a **dependency edge** joins them (one's `deps` names the other, directly or transitively), or
- they **share a concrete artifact** — the same n8n workflow, the router, a DB table/schema, a skill
  file, or a doc.

The touched-artifacts signal is **derived from each item's existing detail** (its *מה זה / Why-tier /
Deps* already name what it touches) — no new card field. Touching the **same subsystem is not itself
a conflict** when the concrete artifacts/roles differ: e.g. one item *reads* `research_archive`,
another *writes* it, a third *is* its storage layer — three separate builds, all parallel-safe.

Output (in `inbox/backlog.md`): a `parallel-with` column of safe item numbers, a per-item
**מקבּוליות** field with a one-line non-conflict proof, and a **"קבוצות בטוחות למקביל"** Notes line
listing the maximal mutually-non-conflicting sets. Never assert a pairing without its proof (truth
discipline, G1).

**Snapshot numbering.** The backlog is rewritten wholesale each run, so item numbers are volatile.
The `parallel-with` references are a **per-run snapshot** — recomputed fresh each run against that
run's 1..N and valid only within the current file. No stable-id mechanism (keyword-first /
depth-by-metric — add one only if a real need appears).

Axis C does not change the Axis A priority number or the order; it is a separate
safety-for-concurrency signal, and it is **distinct from** `backlog-picker`'s `status: in-development`
marker (which *removes* a committed card from the ranking — Axis C decorates the still-ranked,
unpicked items in place).

### Sequencer — dependency-aware order

Build a small dependency note per item (what must exist first). An item that **unblocks others** is
pulled earlier; prefer 🟢/safe/enabling work before 🔴 architectural work unless a dependency forces
the other order. Conceptually a topological order over the dependency graph, with the critical path
(the longest dependency chain) setting the pace.

## Sources (verified 2026-07-04, web research under the truth-protocol)

Prioritization frameworks:
- RICE (Reach × Impact × Confidence ÷ Effort; Impact 3/2/1/0.5/0.25, Confidence 100/80/50%,
  Effort in person-months) — [Intercom](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/),
  [ProductPlan](https://www.productplan.com/glossary/rice-scoring-model).
- WSJF = Cost of Delay ÷ Job Size, Cost of Delay = Business Value + Time Criticality +
  Risk-Reduction/Opportunity-Enablement (Fibonacci scale) —
  [Scaled Agile / SAFe](https://framework.scaledagile.com/wsjf).
- ICE = Impact × Confidence × Ease (1–10), Sean Ellis —
  [Growth Method](https://growthmethod.com/ice-framework/),
  [ProductPlan](https://www.productplan.com/glossary/ice-scoring-model).
- Framework overview — [Atlassian](https://www.atlassian.com/agile/product-management/prioritization-framework),
  [AltexSoft](https://www.altexsoft.com/blog/most-popular-prioritization-techniques-and-methods-moscow-rice-kano-model-walking-skeleton-and-others/).

Effort sizing:
- T-shirt sizing (XS/S/M/L/XL relative effort) — [Asana](https://asana.com/resources/t-shirt-sizing),
  [Easy Agile](https://www.easyagile.com/blog/agile-estimation-techniques).

Urgency/importance triage:
- Eisenhower matrix (urgent × important → Do/Decide/Delegate/Delete) —
  [Asana](https://asana.com/resources/eisenhower-matrix),
  [Todoist](https://www.todoist.com/productivity-methods/eisenhower-matrix).

Change significance & sequencing:
- Architecturally significant / when to write an ADR —
  [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html),
  [adr.github.io](https://adr.github.io/).
- Dependency graph / critical path —
  [Cirkus](https://www.cirkus.com/blog/critical-path-analysis-in-project-management/),
  [IBM](https://www.ibm.com/docs/en/devops-release/6.2.5?topic=tasks-task-dependency-graph).

> Note: several primary pages block automated fetch (HTTP 403); the figures above were taken from
> the search engine's excerpts of those official sources and cross-checked across multiple
> independent sources that agree.
