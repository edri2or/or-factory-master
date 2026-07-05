---
name: backlog-picker
description: "Skill #3 of the idea pipeline — the chooser + pre-flight bridge between the ranked list and the build. After raw-input-collection (skill #1) captures ideas and inbox-organizer (skill #2) ranks them into inbox/backlog.md, this skill helps Or PICK the next item and PREPARE it for development: it presents the top-of-order item in plain Hebrew (what / why first / change-tier / deps), walks him through that card's open questions, runs a readiness check + a research-need triage, writes a short bounded 'ready brief', marks the chosen item in-development, and then hands off — either to /aios-research-partner (when the item needs research first) or straight to /dev-stage with the brief — where the human gate stays (the /dev-stage plan gate on the light path, or the goal-and-research approval inside the research partner). Use when Or wants to decide what to build next from his organized list, or wants an idea prepared and teed up for building. Explicit Hebrew triggers — מה הבא בתור, בוא נבחר מה לבנות, מה כדאי לבנות עכשיו, תכין לי את הבא בתור, מה הדבר הבא, בוא נתחיל משהו מהרשימה, /backlog-picker. Explicit English triggers — what's next, pick the next thing to build, choose from the backlog, prep the next item, tee up the next build. Implicit triggers (activate on these too) — when Or has an organized backlog and asks which one to do / where to start, or says he's ready to build 'the next one' but wants it prepared first. Distinction — this only CHOOSES + PREPARES + HANDS OFF; it does NOT capture ideas (that is raw-input-collection, skill #1), does NOT rank the list (that is inbox-organizer, skill #2), and does NOT itself build — /dev-stage owns the build, unchanged. Do not activate to capture a new idea, to re-rank the backlog, or to run a build directly without picking from the list."
---

# backlog-picker — the chooser + pre-flight bridge (pick → prepare → hand to /dev-stage)

The third link of Or's idea pipeline. Skill #1 (`raw-input-collection`) captures scattered ideas
into `inbox/` cards; skill #2 (`inbox-organizer`) ranks them into the standing list
`inbox/backlog.md`. **This skill is the bridge from that ranked list to the build.** It helps Or
decide *which* item to build next and gets it *ready* — resolves the card's open questions, checks
readiness, writes a short brief — then flows straight into `/dev-stage`. The point is that when the
build starts it starts on **checked ground**, not arbitrarily.

**Map, not a manual.** The pipeline + method live in `docs/idea-pipeline.md`; the card format is
owned by `raw-input-collection`; the build itself is owned by `.claude/commands/dev-stage.md`. This
card routes you — it hard-codes no ids, paths-as-truth, or secrets.

## The one boundary (mirrors the sibling skills)

This skill **chooses + prepares + hands off**. While acting under it you MUST NOT:

- **build or execute** anything — the actual staged build is `/dev-stage`'s job, unchanged;
- **rank or re-order** the backlog — that is skill #2 (`inbox-organizer`);
- **capture a new idea** — that is skill #1 (`raw-input-collection`);
- **edit a card's *content*** — the raw words and understood-intent stay as skill #1 wrote them.

The only write this skill makes is the **status marker** on the chosen card (see "State-marking"),
plus what `/dev-stage` writes once it takes over. If Or wants to build something that is *not* on
the list, that is a normal `/dev-stage` start — not this skill.

## The flow, each time Or asks "what's next?"

0. **Ensure the backlog is current (self-heal) — before presenting anything.** A cheap staleness
   check: does `inbox/backlog.md`'s ranked list contain any item whose **source card** is now
   `status: completed` or `in-development`, or do the `unprocessed` cards in `inbox/` not match what
   the list ranks? If **stale**, **run `inbox-organizer` first** (skill #2 — the sole ranking owner)
   to regenerate the list (drop completed cards, re-rank, renumber 1..N, recompute `parallel-with`),
   then present the fresh result. If already current, skip straight to step 1. **You never rank here**
   — that violates this skill's boundary; you only *trigger* skill #2 and read its output. This
   guarantees Or always sees a re-organized list when he opens the skill, never a stale one — the
   "backlog is always current" invariant (`docs/idea-pipeline.md`).
1. **Present the next item.** Read `inbox/backlog.md`. Take the top of the **Suggested order** and
   present it to Or in plain Hebrew: what it is (one line), **why it's first**, its change-tier
   (🟢 low / 🟡 middle / 🔴 high), its dependencies, and — **proactively, without waiting for him to
   ask** — its **מקבּוליות**: which item numbers it can be developed in parallel with (from the
   backlog's `parallel-with` column), e.g. "אפשר לפתוח סשן שני במקביל עם #4, #5". When you show a
   short overview table of the list, that table MUST include a **מקבּוליות** column alongside
   #/מה/רמה/מסלול (never omit it — the whole point of the axis is that Or sees it at pick-time), and
   add a one-line "קבוצות בטוחות למקביל" summary from the backlog's Notes. Offer him the choice — he
   can take the top one or pick a different item by name/number. He decides; you never decide for him.
2. **Walk the open questions.** Open the chosen item's **source card**
   (`inbox/<date>-<slug>.md`, path is in the backlog row) and read its `## Understood intent` +
   the backlog's confidence notes. Surface the real open questions **one at a time**, in simple
   Hebrew, and let Or answer — or say "תחליט אתה" (you decide), in which case you propose a
   sensible default and say so. Do not invent questions the card doesn't raise.
3. **Readiness check (honest, never invented).** Assess and report plainly:
   - **New capability?** If the item introduces a new *verb* the system can't do yet (read / fill /
     extract / send / parse), flag that `/dev-stage` Step 0 (capability-first, `docs/capability-first.md`)
     will apply — prove it outside n8n first. If it's additive plumbing/config/docs, say it skips.
   - **Dependencies satisfied today?** Check the card's deps actually exist now (a skill, a gate, a
     table). If a dependency is missing, say so — it may mean building the dependency first.
   - **How heavy?** Restate the tier and what a build would touch, so Or knows the size before he
     commits.
   - **Research-need triage (which on-ramp).** Run the scorecard in `docs/idea-pipeline.md`
     § "Research-need triage (stage 3.5)" and decide the hand-off route. **Hard** signals (any ONE →
     research): 🔴 change-tier · a new capability/verb with no repo precedent to copy · correctness
     depends on an external fact (a third-party API not yet integrated / a best-practice / security /
     pricing fact not in the repo). **Soft** signals (need TWO together → research): `[⚠️ Low]`
     priority confidence · the open questions are about approach/design, not just parameters. Else →
     the light path (`/dev-stage`). **Every signal must cite a real line in the card/backlog — no
     evidence, it doesn't count (this is guarantee G1, the truth discipline).** Default is the light
     path; escalate to research only on a real trigger.
4. **Write the ready brief (bounded, confidence-tagged).** Produce a short brief in the
   `process-card` discipline (`.claude/commands/process-card.md`): hard caps, and a
   `[High] / [Medium] / [⚠️ Low]` confidence tag on each decision. Structure:
   - **מה בונים** — one sentence.
   - **מה הוחלט** — the answers from step 2 (≤5 bullets), each tagged.
   - **מה עדיין פתוח** — anything unresolved that `/dev-stage` will settle (≤3 bullets).
   - **גודל/סוג** — the tier + capability-first flag from step 3.
   - **מסלול** — the triage verdict: light (`/dev-stage`) or research (`/aios-research-partner`),
     with the triggering signal(s) **cited** to a real card/backlog line (G1).
   Never fabricate a decision Or didn't make; if he deferred one, mark it `[⚠️ Low]` / open.
5. **Mark in-development, then hand off — by the triage route.** Apply the status marker (below) —
   including the `devplan: devplans/<slug>.md` pointer with a slug you choose now — then hand off on
   the route the triage picked (present the route + its cited evidence to Or in one Hebrew line first;
   he can override):
   - **Light path (default).** **Continue straight into `/dev-stage`** in the same session, passing
     the brief as its Step-1 input (the goal to confirm). `/dev-stage` does its own Step 1 (confirm
     the goal) and Step 2 (author `devplans/<slug>.md` and stop at the **one** plan-approval gate).
     **That plan-approval gate is the real human checkpoint** — this skill does not add a second one
     and does not bypass it.
   - **Research path.** **Continue straight into `/aios-research-partner`** in the same session,
     passing the ready brief as its Step-1 goal input, and **pass the same slug** so the card's
     `devplan:` pointer, the research handoff (`handoffs-dev-stage/<slug>.md`), and the eventual
     `devplans/<slug>.md` all stay linked. Do **not** tell it to skip its Step-1 stop — the research
     partner restating the goal for Or's OK is the human checkpoint on this path; it then researches,
     writes the handoff, and loads `handoffs-dev-stage`, which starts `/dev-stage` **without** the
     plan gate (the research was the approval). Safety Rule 5, the CI gates, and every red-line stay on.
   Which route is a **conscious choice about where Or approves** (the `/dev-stage` plan vs. the
   goal-and-research) — surface it; never route silently. See `docs/idea-pipeline.md` § "Research-need
   triage" for the full rule and the gate-difference note.

## State-marking (keep the list honest)

When Or commits an item to development, mark its **source card** so the picture stays truthful and
the item isn't offered again:

- Set the card's frontmatter `status: unprocessed` → **`status: in-development`**, and add a
  **`devplan: devplans/<slug>.md`** line pointing at the plan `/dev-stage` will create. This is a
  status-only edit — never touch the card's `## Raw (verbatim)` or `## Understood intent`.
- `inbox-organizer` (skill #2) reads this status and lists an `in-development` card under a separate
  "🏗️ In development" note instead of in the active "what to build next" ranking — so a
  re-organize won't re-suggest an item already in flight.
- **The lifecycle you open here is closed at build-end by `/dev-stage` Step 5** (the "close-out"):
  when the build finishes it flips the card `in-development → completed`, archives the devplan, and
  files a one-line record in `inbox/completed.md` — so the finished item **leaves the ranked list**
  yet stays documented. You mark the start; close-out marks the end. See `docs/idea-pipeline.md`
  § "Stage 5 — Close-out".

Both changes are plain `.md`, so they trip no CI gate; commit + PR them the same friction-free way
the sibling skills publish.

## Guardrails

- **Or chooses.** Default to the top of the order, but he can pick any item; never build one he
  didn't choose.
- **Do not invent.** Every open question, dependency, and readiness claim must trace to a real card
  or a real system fact you verified (a file, a skill, a named query). If the card is too sparse to
  prepare confidently, say so and offer to send it back to skill #1/#2 for more — don't fabricate a
  brief.
- **Do not duplicate `/dev-stage`.** Prepare to the "ready brief" and hand off — do not write the
  staged plan, do not start implementing. The build is `/dev-stage`'s, and its plan-approval gate
  stays the human checkpoint.
- **Plain Hebrew to Or**, always — short, calm, the right dose; never show him a raw file.

## See also

`docs/idea-pipeline.md` (the full pipeline + ranking method + state-marking), `raw-input-collection`
(skill #1, capture + card format), `inbox-organizer` (skill #2, the ranked `inbox/backlog.md`),
`.claude/commands/process-card.md` (the bounded-extraction-with-confidence precedent the brief
follows), `.claude/commands/dev-stage.md` (the staged build this skill hands off to on the light
path), `.claude/commands/aios-research-partner.md` (the research-and-planning engine this skill hands
off to on the research path), `.claude/commands/handoffs-dev-stage.md` (the bridge that carries the
research partner's handoff into `/dev-stage`).
