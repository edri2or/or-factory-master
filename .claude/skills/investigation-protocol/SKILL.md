---
name: investigation-protocol
description: "A staged, session-scoped internal-investigation process for when Or asks a question or wants something checked/investigated inside a Claude Code session — not a build task. Distinct from truth-protocol (which governs per-claim accuracy): this skill's job is COVERAGE — making sure the investigation didn't skip something it should have accounted for, since a fully-accurate answer that missed something important can be worse than useless. Chain-of-Verification style, checklist-FIRST: derive a concrete rubric of what must be checked BEFORE gathering any evidence (prevents premature closure), then answer each rubric item with real tool calls (Grep/Read/WebSearch/Bash — same session, no sub-agents/Workflow, per Or's explicit choice), applying a structural blindfold per item (judge each check on its own evidence, not on the draft's existing conclusion) to counter same-session narrative inertia and sycophancy, then assemble the final answer only from what was actually verified — flagging Verification Theater / Context Rot / Sycophancy risks explicitly where they apply. truth-protocol's accuracy bar applies inside the answering step; it is not invoked as a separate sub-skill. Triggers on: explicit invocation — פרוטוקול חקירה, מצב חקירה, בדוק את זה ליסודו, /investigation-protocol, investigation protocol, investigate this thoroughly. AND careful auto-activation — a question that explicitly asks for thoroughness/certainty ('תבדוק טוב', 'אני רוצה להיות בטוח', 'תחקור את זה', 'make sure you check everything', 'be thorough') or a question whose answer would be consequential if incomplete (an architecture/design/system-behavior question with real follow-on impact). Do NOT auto-activate for ordinary conversation, a simple build/implementation request, a quick factual lookup already well-served by truth-protocol alone (a single date/number/fact), or a request that already explicitly invokes another staged process (aios-research-partner, dev-stage) — those already carry their own thoroughness structure and should not be wrapped in a second one."
---

# Investigation Protocol

## Purpose

A session-wide, staged process for genuinely thorough answers to Or's in-session questions
and checks — as opposed to a fast reply. Or's stated fear is not that an answer contains a
false claim (that's `truth-protocol`'s job), but that it **missed something it should have
accounted for**: even a fully-accurate answer can become irrelevant or harmful if the
investigation didn't cover the right ground.

Research grounding this design (filed to `research_archive`, topic tag
`investigation-protocol`; two rounds — the second round from Or's own parallel deep-research
run, per `aios-research-partner` step 13): intrinsic self-critique — a model reflecting on its
own draft with no external check — does not reliably improve answers and can actively invent
errors in correct ones (Huang et al., ICLR 2024, arXiv:2310.01798; the "self-critique
paradox"). What does work is **concrete external anchoring**: deriving specific verification
questions and answering them with real tools (Chain-of-Verification, Dhuliawala et al. 2023,
arXiv:2309.11495 — +23% F1 over an unverified draft).

**A sharper distinction from round 2, and a real trade-off it exposes.** CoVe's own literature
splits into **Joint** (verification Q&A done in the same continuous context — does NOT
meaningfully reduce hallucination, because the answers are biased by the immediately preceding
draft) vs. **Factored** (each verification question answered in an isolated, separate
call/context — the variant that actually works; arXiv:2309.11495). The strongest form of this
— Cross-Context Review, where a fresh session with no access to the production history reviews
an artifact — measurably beats same-session review (F1 28.6% vs. 24.6%, p=0.008;
arXiv:2603.12123) precisely because information restriction, not "more thinking," is what
removes sycophancy and narrative-inertia bias. **Or was asked explicitly whether this skill
should therefore spin up an isolated sub-call for verification, and chose to keep it strictly
session-scoped** (no sub-agents/Workflow — his original, reaffirmed requirement). This skill is
therefore a deliberate approximation of Factored CoVe **within** one context, not true
Cross-Context Review: stage 2 below is checklist-FIRST (built before evidence, so it cannot be
shaped by a biased draft) and stage 3 applies a **structural blindfold** — judge each rubric
item strictly on the evidence that item's own tool call returns, not on what an earlier draft
already concluded. This is a real, named trade-off (weaker than true isolation, per the
research), accepted deliberately for staying single-session. Every stage below must produce a
real tool call or a real search — not "let me think about this again."

This skill governs THIS Claude Code session only. It does not change the Telegram bot, the
Agent Router, or any n8n workflow.

## Activation

- **Manual.** Or invokes it explicitly (a trigger phrase, or `/investigation-protocol`).
  Acknowledge in ≤2 Hebrew lines that the protocol is running, then work through all five
  stages before answering.
- **Auto — narrow and deliberate.** Only when the question itself signals that thoroughness
  matters: an explicit ask to be thorough/certain, or a question whose incompleteness would
  have real follow-on consequences (an architecture/design/system-behavior question Or will
  act on). Do **not** auto-activate for: ordinary conversation, a build/implementation request
  (that's `/dev-stage`'s job), a single quick fact already covered by `truth-protocol` alone,
  or a request that already names another staged process (`aios-research-partner`,
  `/dev-stage`) — wrapping an already-staged process in a second one adds no coverage, only
  noise. When genuinely unsure whether a question warrants this, ask Or in one short Hebrew
  line rather than guessing either way — false triggers erode trust in the skill as much as
  missed ones do.

## The five stages (checklist/rubric-first — reordered per round-2 research)

Round-2 research (arXiv:2605.20149, "Less Back-and-Forth") found checklist-improved prompting
scores a mean 7.50/8 vs. 5.67/8 for a raw draft-first approach — because generating the rubric
**before** looking at evidence prevents the rubric itself from being shaped by whatever the
first quick answer happened to notice ("premature closure"). This skill therefore builds the
checklist in stage 1, before any drafting or evidence-gathering — the reverse of a natural
draft-then-check instinct.

### 1. Build the rubric — "what must be checked" (before any evidence)
From Or's question alone — not from a first-pass answer — list the concrete things that would
need to be true, checked, or ruled out for a complete answer: the specific claims/domains/files
implicated, and any implicit scope (e.g. "does X work" implying across all cases, not just the
common one). Each rubric item must be a checkable, specific question — not "did I get this
right?" in general. This is the stage that exists specifically to prevent premature closure: it
is built without an answer in hand to anchor on.

### 2. Gather evidence for each rubric item — real tool calls only
For each rubric item from stage 1, use an actual tool — `Grep`/`Read`/`Glob` for this system's
own code and docs, `WebSearch`/`WebFetch` for outside-world facts, `Bash` for anything checkable
by running it — and record what the tool actually returned, verbatim enough to point at (a file
path + line, a quoted search-result line, a URL). **Verification Theater guard:** a rubric item
with no tool output attached is not "checked" — write `[UNVERIFIED — no tool call made]` rather
than a confident-sounding sentence with nothing behind it.

### 3. Judge each item with a structural blindfold — mark confirmed/refuted/partial/cannot-verify
For each rubric item, judge strictly from that item's own stage-2 evidence — not from what any
other item's answer, or a mental first impression of the whole question, already suggests the
overall answer should be. This is the same-session substitute for true cross-context isolation
(Or chose to stay session-scoped rather than spawn an isolated sub-call for this — see the
research note above): the discipline is "this specific piece of evidence, on its own terms," not
"does this fit the answer I'm forming." No speculation-as-fact (same standard as
`truth-protocol`, applied per rubric item). If an item needs `truth-protocol`'s full accuracy
discipline (a factual claim where being wrong matters), apply it inline — do not switch modes.

### 4. Missed-scope check — "what wasn't in the rubric at all"
The stage-1 rubric can itself be incomplete. Before assembling the answer, ask explicitly: is
there an existing skill/doc/mechanism in this repo relevant here that no rubric item named? Does
a related-but-distinct topic exist that should be named rather than silently folded in or
ignored? List what you checked here, even briefly — a one-line "checked: git history for a
prior attempt at this — none found" is enough; an unexamined item is not evidence.

### 5. Assemble the final answer
Build the answer only from what stage 3 actually confirmed for each rubric item, explicitly
flag anything `[UNVERIFIED]`/partial/cannot-verify, and note what the stage-4 missed-scope check
surfaced (including "nothing additional found" — say so, don't omit the step). Two more guards
to apply here specifically: **Context Rot** — if the answer is long, re-state the core
constraints/negatives at the end rather than trusting they carried through from early in the
reasoning; **Sycophancy / Final-Output-Gap** — if Or's phrasing hinted at an expected answer, and
the rubric evidence points somewhere else, give the evidence-backed answer, not the hinted one,
and say so plainly. Keep the Hebrew-facing summary short and calm; the staging is internal
discipline, not something to narrate at length to Or.

## Where a verified source comes from

Same as `truth-protocol`: retrieve a real source or declare its absence — never fabricate one.
- **This system's own state** → `Grep`/`Read`/`Glob` over the repo, the `postgres_named_query`
  whitelist (`archive_search`/`memory_search`/etc.), `docs/CAPABILITIES.md`.
- **The outside world** → `WebSearch`/`WebFetch`, citing the full URL actually fetched.
- **Neither yields a source** → mark that specific question `cannot-verify` in stage 3 and say
  so plainly in the final answer; do not bridge the gap with a guess.

## Short example

Or: "יש בריפו הזה מנגנון שכבר עושה coverage-check מפורש?"
1. **Rubric (before any evidence):** "לבדוק: (א) האם קיים קובץ-סקיל עם 'coverage'/'completeness'
   כשלב-מפורש. (ב) האם truth-protocol עצמו מכיל שלב כזה. (ג) האם יש סקילים גלובליים/plugin
   שלא ניתנים לבדיקה מקומית — לציין כמגבלה אם כן."
2. **Evidence (real tool calls):** `Grep -i "coverage|completeness"` על `.claude/skills/**/SKILL.md`
   → תוצאה בפועל: רק `truth-protocol/SKILL.md` תואם, דרך שורת "## Final truth-check".
3. **Judge per-item (structural blindfold):** (א) confirmed — אין קובץ מקומי אחר עם שלב-שלמות
   מפורש. (ב) partial — truth-protocol כן כולל "בדיקת-אמת סופית", אך זו בדיקת-דיוק לא
   בדיקת-שלמות-כיסוי. (ג) cannot-verify — סקילים גלובליים לא נגישים לקריאה מהסשן.
4. **Missed-scope check:** לא נמצא מנגנון-שלמות נוסף מעבר לשלושת הפריטים; שום דבר לא נכנס
   מחוץ לרוברייק המקורי.
5. **Final answer:** "לא — יש רק `truth-protocol`, וזו בדיקת-דיוק (Final truth-check), לא
   בדיקת-שלמות-כיסוי ייעודית. נבדק ב-grep על כל הסקילים המקומיים; סקילים גלובליים/plugin
   לא ניתנים לבדיקה מכאן — מגבלה, לא הוסתרה."
