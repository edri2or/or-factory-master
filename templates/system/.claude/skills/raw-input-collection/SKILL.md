---
name: raw-input-collection
description: "The first skill of the two-skill idea pipeline — a pure LISTENING skill. Or dictates anything on his mind in loose, scattered Hebrew (a thought, a goal, a wish, a test he wants run, a task, an open question); this skill LISTENS, works out what he actually means, files ONE markdown card per distinct idea into the repo's inbox/ folder, then pushes it and opens a PR so the idea durably lives in GitHub — and does nothing else with the idea. It never builds, never edits system files, never runs an n8n workflow or deploy, and never prioritizes or plans the ideas. It only captures + phrases + files + publishes (the PR of its own card). A separate skill (skill #2, inbox-organizer) reads the inbox/ cards and ranks them into a standing organized list; that is explicitly NOT this skill's job. Each card keeps Or's raw words verbatim (Hebrew, the source of truth) plus an English structured read of the intent. Use whenever Or wants to dump / park / capture an idea rather than act on it. Explicit Hebrew triggers — יש לי מחשבה, יש לי רעיון, תקלוט, תקלוט את זה, תוסיף לרשימה, רשום לי, תשמור רעיון, זרוק את זה ל-inbox, פריקה, /raw-input-collection. Explicit English triggers — raw input, collect this idea, capture this thought, park this, add to the inbox, dump this idea. Implicit triggers (activate on these too) — when Or is clearly brain-dumping several loose ideas at once and does not ask you to do them, or says something like 'just remember this for later / I don't want to do it now, just write it down'. Distinction — this only CAPTURES raw ideas into inbox/; it does not act on them and does not build the development plan (that is skill #2). Do not activate for a normal actionable request Or wants done now, and do not activate for conversation memory (that is conversation-continuity)."
---

# raw-input-collection — the idea inbox (LISTEN only)

The first skill of a two-skill pipeline. Its entire job is to be Or's ears: he speaks whatever
is on his mind — a half-formed thought, a goal, a wish, a test he wants run, a task, a question —
in free, scattered, non-technical Hebrew, and this skill **captures it, works out what he actually
wants, and files it** into `inbox/`. That is all it does.

A **second skill (future, not this one)** later reads the `inbox/` cards and turns them into a
real development plan — ranking each item by importance and by how much it changes the system
(high = architecture/code, low = additive like a new skill, middle in between), ordering the
stages, deciding what comes first. **This skill does none of that.** It does not judge, rank,
order, build, or execute. It listens and files. Keeping capture and planning separate is the
whole point — the raw material is preserved clean, and the thinking happens later in skill #2.

## The one hard boundary (never cross it)

This skill is **capture-only**. While acting under it you MUST NOT:

- build, edit, or refactor any system file, workflow, config, or code;
- run any deploy, n8n workflow, or action that changes the running system;
- rank, prioritize, stage, or plan the ideas;
- decide whether an idea is good, feasible, or worth doing.

The **only** file you write is a card under `inbox/`. Publishing that card to GitHub — commit,
push a branch, open a PR — **is** part of this skill's job (so the idea durably lives in the repo,
not only in the ephemeral container); that is the one and only thing it pushes. If Or's message is
actually a request he wants done *now* (not parked), this is the wrong skill — do the task normally
instead. If in doubt whether he wants it captured or done, ask him in one short Hebrew line.

## What to do, each time Or dumps

1. **Listen to the raw dictation. Do not act on it.** Treat every word as material to preserve,
   not a command to execute.
2. **Work out the intent.** From the scattered words, figure out what he actually wants: is it a
   thought, a goal, a wish, a test, a task, or an open question? What is the core of it, and why
   does he seem to want it? Note any constraint he stated.
3. **Split by idea.** If one dictation holds several distinct ideas, write a **separate card per
   idea** — do not merge unrelated ideas into one card. If it is really one idea said three ways,
   it is one card.
4. **Write one card** `inbox/<YYYY-MM-DD>-<short-english-slug>.md` per distinct idea (see format
   below). Use a short, descriptive english slug; if a file with that name already exists, add a
   short numeric suffix (`-2`, `-3`) rather than overwriting.
5. **Publish it to GitHub (always).** The card must end up in the repo, not only in the ephemeral
   container. So: `git checkout -b inbox/capture-<YYYY-MM-DD>` (reuse the same branch if you already
   opened one this session) → `git add` the new card(s) → commit → `git push -u origin <branch>` →
   open a PR (ready for review), e.g. "chore(inbox): capture <topic>". A card is `.md` only, so the
   PR trips no CI gate; keep the commit to the `inbox/` card(s) alone. Do NOT push anything other
   than the card(s).
6. **Report to Or in Hebrew**, short: how many cards you filed, a one-line recap of each, and the
   PR link. Do not ask him to approve the wording and do not start planning — just confirm it is
   parked and pushed.

## Card format

```
---
captured: <YYYY-MM-DD>
topic: <short English title of the idea>
kind: <thought|goal|desire|test|task|question>
status: unprocessed
---

## Raw (verbatim)

<Or's exact words, unedited — Hebrew as he said it. This is the source of truth; never
paraphrase or "clean up" this block.>

## Understood intent

<English, structured. What he actually wants, in clear terms. Include, when present:
- the core ask in one sentence;
- why he seems to want it / the problem behind it;
- any constraint or preference he stated;
- open questions you would need answered before this could be planned.
**Never invent intent Or did not express.** Write only what his words support; where his meaning
is unclear, record it as an open question (or ask him one short Hebrew line) rather than guessing —
the raw block stays the verbatim source of truth. This is the pipeline's **truth discipline** (see
`docs/idea-pipeline.md` § "Truth discipline"): no invention, trace every read to his actual words,
and declare what you cannot confirm instead of filling it in.
Do NOT add importance, priority, staging, or a solution — that is skill #2's job.>
```

- **`status:`** is the card's lifecycle marker. Values, in order: **`unprocessed`** (every new
  card — skill #2 `inbox-organizer` reads it and never changes it) → **`in-development`** (set by
  skill #3 `backlog-picker` when Or commits the item to a build; adds a `devplan:` pointer) →
  **`completed`** (set at build **close-out** — `/dev-stage` Step 5 — when the work is merged/done;
  the `devplan:` pointer is repointed to the archived plan). `inbox-organizer` drops a `completed`
  card from the active list entirely; the "done" record lives in `inbox/completed.md`. See
  `docs/idea-pipeline.md` § "State-marking" + § "Stage 5 — Close-out".
- The **Raw block stays Hebrew and verbatim** (language-boundary ADR-0014: raw operator input is
  the source, preserved as-is). Everything structural — frontmatter, headings, the Understood
  intent — is **English**, because the card is internal material that skill #2 (the agent) reads.

## Why it's built this way

- **One card per idea, `<date>-<slug>.md`** mirrors the existing raw-capture precedent
  (`session-capture` → `sessions/raw/<date>-<slug>.md`): raw preserved verbatim, English
  structure around it, committed to git.
- **Capture ≠ organizing.** Separating the listener (this skill) from the organizer (skill #2,
  `inbox-organizer`) keeps the raw material unbiased and lets the ranking happen in a fresh,
  deliberate pass.
- **`inbox/` is append-only here.** This skill only adds cards (and pushes them via PR); skill #2
  reads them into the standing `inbox/backlog.md` list and never deletes them.

## See also

`inbox/README.md` (the folder's own note), and skill #2 (`inbox-organizer`) that reads `inbox/`
into the standing `inbox/backlog.md` prioritized list. Building anything is a separate step Or
starts himself via `/dev-stage`. This card is a map: it does not hard-code ids or secrets.
