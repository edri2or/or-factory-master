---
name: inbox-organizer
description: "Skill #2 of the two-skill idea pipeline — the organizer. Reads the raw idea cards that skill #1 (raw-input-collection) filed into inbox/, works out what each one really is, RANKS them with a research-backed method (importance + level-of-system-change + dependencies), and writes a single standing, prioritized list at inbox/backlog.md (each item carrying an advisory research-route — 🔬 research-first / 🛠️ build-direct — that previews the pick-time triage) — then pushes and opens a PR so the organized list lives in the GitHub repo. It STOPS there. It does NOT hand off to /dev-stage, does NOT build anything, and does NOT change the cards. Choosing what to develop, and when, is Or's separate decision — he opens inbox/backlog.md whenever he wants and picks. Use when Or wants his collected ideas sorted and prioritized — 'organize the inbox', 'sort my ideas', 'what's most important'. Explicit Hebrew triggers — תסדר את ה-inbox, תארגן את הרעיונות, תמיין את מה שאספתי, תדרג את הרעיונות, מה הכי חשוב, תעדכן את הרשימה, /inbox-organizer. Explicit English triggers — organize the inbox, sort my ideas, rank my ideas, prioritize the inbox, update the backlog. Implicit triggers (activate on these too) — when Or says the inbox has piled up and he wants it made sense of / sorted, or asks which idea is most important or where things stand. Distinction — this only ORGANIZES and RANKS into inbox/backlog.md and opens a PR; it does NOT capture raw ideas (that is raw-input-collection, skill #1) and does NOT build or plan execution (that is /dev-stage, which Or starts himself, separately). Do not activate to capture a new idea, and do not activate to build something."
---

# inbox-organizer — the idea organizer (RANK into a standing list, open a PR)

The second skill of the two-skill pipeline. Skill #1 (`raw-input-collection`) is the ears — it
files Or's scattered ideas into `inbox/` as raw cards. **This skill is the brain that sorts them
into an ordered, prioritized list.** It reads the cards, ranks them professionally (how important,
how heavy a change, what depends on what), and (re)writes one standing file — `inbox/backlog.md` —
that is always the current, organized picture. Then it **pushes and opens a PR** so the list lives
in the GitHub repo.

**Boundary — it organizes and stops.** This skill **ranks and writes `inbox/backlog.md` and opens
a PR** — nothing more. It does NOT hand off to `/dev-stage`, does NOT build or execute anything, and
does NOT change the cards' contents or status. **When and what to develop is Or's separate call:**
he opens `inbox/backlog.md` whenever he wants, picks an item, and starts `/dev-stage` himself if and
when he chooses. Capturing is skill #1's job; building is `/dev-stage`'s.

**Map, not a manual.** The full method + its sources live in `docs/idea-pipeline.md`; the card
format is owned by `raw-input-collection`. This card routes you.

**Who invokes this skill (it is the sole ranking owner).** Besides Or's manual "organize / תסדר",
this regenerate is now called **automatically** at two points so the list is always current: (1) at
build **close-out** (`/dev-stage` Step 5) right after an item is marked `completed`, and (2) at
**pick-time** (`backlog-picker` step 0) if it finds the list stale. Both just *invoke* this skill —
the ranking/renumbering logic lives only here. See `docs/idea-pipeline.md` § "The backlog is always
current".

## The ranking method (three axes + a sequencer)

Research-backed (RICE, WSJF/Cost-of-Delay, ICE, t-shirt sizing, Eisenhower, ADR significance,
critical-path — see `docs/idea-pipeline.md`), tuned for a single operator and kept simple:

1. **Triage cut — Eisenhower** (urgent × important): Do (urgent+important) / Schedule (important,
   not urgent) / Delegate-automate (urgent, not important) / Drop (neither).
2. **Priority score — simplified ICE/WSJF**: `priority = (Impact + Urgency + Unblocks-others) ÷ Effort`.
   - Impact / Urgency / Unblocks-others: each 1–5. Effort: t-shirt size → XS=1, S=3, M=5, L=8, XL=13.
   - Higher = sooner. Carry a **confidence tag** `[High] / [Medium] / [⚠️ Low]` on each score.
3. **Change tier — ADR significance (a SEPARATE axis):** 🔴 high (architecturally significant:
   multi-component, hard/expensive to reverse, real trade-off — n8n workflows, the router, DB
   schema, agent-org topology) · 🟡 middle (real code, not architecture) · 🟢 low (additive,
   self-contained — a new skill/doc). The tier tells Or how heavy a build would be; it does not
   change the priority number.
4. **Parallelizability — cross-item non-conflict (a SEPARATE axis):** for the current run's items
   1..N, compute for **each** item which *others* it can be developed **in parallel** with — so Or
   can open **two separate Claude Code sessions** and run both without them clashing (the goal is
   *concurrent sessions*, not two builds in one session). Two items **conflict** (not parallel-safe)
   if either (a) a **dependency edge** joins them (one's `deps` names the other, directly or
   transitively), or (b) they **share a concrete artifact** — the same n8n workflow / router / DB
   table / skill file / doc. Derive the touched artifacts from each item's existing **מה זה /
   Why-tier / Deps** detail — **no new card field**. Touching the *same subsystem* is **not** a
   conflict when the concrete artifacts/roles differ (one reads `research_archive`, one writes it,
   one is its storage layer → three separate, parallel-safe builds). Show it **compactly by number +
   a one-line non-conflict proof** — never assert a pairing without the proof (truth discipline, G1).
   Numbers are a **per-run snapshot** — recomputed fresh each run against that run's 1..N, valid only
   within the current file. This axis is Or's green light for multi-session concurrent work; it does
   **not** change the priority number or the order, and it is **distinct from** skill #3's
   `status: in-development` marker (which *removes* a card from the ranking). Output form → flow step 4.
5. **Sequence — dependency-aware:** an item that unblocks others is pulled earlier; prefer 🟢/safe
   /enabling work before 🔴 architectural work, unless a dependency forces otherwise.
6. **Route preview — advisory (which on-ramp).** From the research-need triage scorecard
   (`docs/idea-pipeline.md` § "Research-need triage"), compute a **preview** route per item using only
   the hard signal already in hand — mainly the change tier (🔴 → 🔬 research-first), and a
   no-precedent new capability where evident; everything else → 🛠️ build-direct. This is a **preview,
   not the verdict**: the authoritative full scorecard + Or's confirm run later in `backlog-picker` at
   pick-time and can override it. Never invent a signal — cite the tier/card line, or it doesn't count
   (truth discipline, G1). It does not change the priority number or the order.

## The flow

1. **Gather** — read every idea card `inbox/*.md` (skip `README.md`, `backlog.md`, and
   `completed.md`). Note each card's `status`:
   - **`status: in-development`** (set by skill #3, `backlog-picker`, when Or committed it to a
     build) is **not ranked** — it is already in flight. Set it aside for the "🏗️ In development"
     note (step 4).
   - **`status: completed`** (set at build close-out by `/dev-stage` Step 5) is **dropped entirely
     from `backlog.md`** — not ranked, and **not** in the "🏗️ In development" note. Its documented
     "done" record lives in the append-only `inbox/completed.md` (written at close-out, never
     rewritten by this skill). This keeps the active list honest: only real work-to-do.
2. **Understand + cluster** — parse each card (`captured` / `topic` / `kind` + `## Raw (verbatim)`
   (Hebrew, do not paraphrase) + `## Understood intent`). Merge cards that are the same idea into
   one work item; keep distinct ideas separate.
3. **Score sequentially** — apply the four parts above to each work item, validating against the
   card's own words. Never invent an item or a dependency not evidenced in a card.
4. **Write the standing list** — (re)write `inbox/backlog.md`: a single prioritized table/list, each
   item with its 🔴/🟡/🟢 tag, priority score + confidence, Eisenhower bucket, an advisory **route**
   (🔬 research-first / 🛠️ build-direct, from method part 6) with its cited reason, dependencies, the
   source card path, and the suggested order + a one-line why. **Also add its parallelizability**
   (method part 4): a `parallel-with` column of the item numbers it is parallel-safe with (or `—`),
   a per-item **מקבּוליות** detail field carrying those numbers + a one-line non-conflict proof, and
   one **"קבוצות בטוחות למקביל"** summary line in Notes (the maximal mutually-non-conflicting sets —
   the sets Or can each hand to its own session at once). Document `parallel-with` in the Columns
   legend, and state once (in the header) that the numbers are a **per-run snapshot** valid only for
   the current file. This file is the deliverable — the
   organized picture Or browses and picks from. Overwrite it wholesale each run (it is always "the
   current state"); Hebrew for the human-facing summary lines, English for structure. If any cards
   were set aside as `status: in-development` (step 1), list them at the top under a short
   **"🏗️ In development"** note (topic + its `devplan:` pointer) so Or sees what is already in
   flight — separate from, and never re-suggested in, the active "what to build next" ranking.
5. **Publish — push + open a PR.** `git checkout -b inbox/organize-<date>` → `git add inbox/backlog.md`
   → commit → `git push -u origin <branch>` → open a PR (ready for review), e.g.
   "chore(inbox): organize backlog". `backlog.md` is plain `.md` (not "code"), so the PR trips no CI
   gate. If an open organize-PR already exists this session, reuse its branch. Then tell Or in
   Hebrew: the list is updated, plus the PR link.
6. **Stop.** Do not invoke `/dev-stage`, do not change the cards, do not build. The list is ready;
   Or takes it from here on his own schedule.

## Guardrails

- **No `/dev-stage`, no building.** If Or says "build the top one", that is his separate `/dev-stage`
  decision — this skill only produces and publishes the organized list.
- **Do not invent.** Every ranked item and dependency must trace to a real card. If the cards are
  too sparse to rank confidently, say so and ask Or for more, rather than fabricating a list. (This is
  the pipeline's **truth discipline** — no invention / trace-to-source / tag-confidence /
  declare-insufficiency; see `docs/idea-pipeline.md` § "Truth discipline".)
- **Do not touch the cards.** This skill reads them and writes only `inbox/backlog.md`; it never
  edits or restatuses a card.
- **Always publish.** The organized list is not done until it is pushed and a PR is open — it must
  live in GitHub, not only in the ephemeral container.

## See also

`docs/idea-pipeline.md` (the pipeline + method + sources, incl. § "Research-need triage" — the source
of the advisory route), `raw-input-collection` (skill #1, the capture half + card format),
`backlog-picker` (skill #3 — runs the authoritative pick-time triage the route column previews),
`.claude/commands/process-card.md` (the bounded-extraction-with-confidence precedent),
`.claude/commands/dev-stage.md` (the build flow Or starts himself, separately).
