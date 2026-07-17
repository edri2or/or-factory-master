# Language boundary — English internals, Hebrew edge

> Read this before writing or changing anything in this repo. It is the one rule that decides
> which language a piece of the system is in. The per-system specifics (names, URLs, secrets)
> live in `AGENTS.md`; this file is the **policy**.

## The rule

**The system works internally in ENGLISH; Hebrew is produced only at the edge the operator
(Or) sees.**

- **Everything Or sees directly must be Hebrew** — your session replies to him, the Telegram
  bot's replies, and the operator-facing websites (dashboard / gallery / chat).
- **The system itself works in English** — code, the files agents read, skills, docs, prompts,
  comments, plans, and commit messages. English is the lingua franca of code and
  interoperability, and the models route and generate more reliably against English
  instructions.

So if Or dictates a new skill or doc in Hebrew, **write it in English** and **give HIM the
answer in Hebrew** — the two are different surfaces.

## Four categories — the category, not the file type, decides its fate

Every Hebrew occurrence in the repo falls into exactly one of four categories:

- **A — Documentation / prose** read by developers or agents (doc bodies, prompt persona
  prose, comments, journals, historical dev prose). → **Convert to English.**
- **B — Output-language directive** ("reply in Hebrew"). → The directive belongs to the
  **edge only** (the coordinator / the session): keep it (produce Hebrew), worded in English. On a
  **non-edge internal component** (a specialist, which never addresses Or) it **inverts** to
  "return `{reply}` in English to the orchestrator" — the Hebrew is produced later, once, at
  the coordinator.
- **C — Functional Hebrew data.** Classifier few-shot examples, deterministic
  keyword / verb / trigger arrays, Hebrew stopwords / `to_tsquery` / regex, eval inputs, test
  fixtures, skill `description` trigger phrases. → **Must stay Hebrew** — it is behavior, not
  text. Translating it silently breaks routing, deterministic detection, and tests.
- **D — Operator-facing output surfaces.** Telegram acks / replies, the dashboard / gallery /
  chat sites, session replies to Or. → **Stay Hebrew** (this is the edge).

## The boundary mechanism — the edge is the coordinator, not each specialist

This system is a single-coordinator broker: Or talks to **one** agent — the coordinator (the Agent
Router on the bot surface; the Claude Code session on today's surface). The specialists return
`{reply}` to the coordinator and **never address Or directly**. Hebrew is therefore produced **once,
at the single coordinator**, never inside an internal specialist:

- **Bot surface:** specialists go fully English (persona, instructions, **and** `{reply}`
  output); the coordinator renders Hebrew at its egress. The classifier's input stays Hebrew — the
  Hebrew *is* the routing signal there (category C), so it is never translated.
- **Session surface:** the session *is* the coordinator; the specialists are internal capabilities;
  only the session's replies to Or are Hebrew.
- **Independent edges** that cannot be centralized at the router (media self-send acks, any
  operator-facing website product, the static sites, and this repo's own operator directives
  in `AGENTS.md`) stay Hebrew and are handled per-surface by this policy.

## Why

- Cleaner, more portable internals and more reliable model behavior against English
  instructions; one rule (the A/B/C/D categories) replaces ad-hoc judgment.
- The operator language is produced **once**, at the coordinator — matching the single-voice
  architecture instead of smearing Hebrew across internal components.
- **The dominant risk is over-translation** — Anglicizing a category-C string. When in doubt,
  treat a Hebrew string as **functional (C) until proven documentation (A)**, and re-run the
  relevant routing / classifier / behavior proof after any conversion.
