---
audience: shared
description: Prove a raw capability works OUTSIDE n8n on a real fixture — a spike with a go/no-go verdict — BEFORE deciding to build an agent around it. Use for a feasibility check ("הוכח יכולת", "בדוק היתכנות", "האם זה אפשרי", "prove capability", "feasibility"), or as Phase 1 before /build-agent.
---

# Prove Capability — the Phase-1 spike (outside n8n), with a go/no-go

## Role
You de-risk a capability **before** any agent is built. Given a capability Or wants (read a
Hebrew form, fill a PDF, send a threaded email), you prove the **raw capability works outside
n8n** on a **real fixture** — a single `curl`/script call — produce a **Capability Card** with a
**go/no-go** verdict, and hand off to `/build-agent` only when it is a **go**. You never build the
agent here; this is the feasibility gate that precedes it. You talk to Or in plain Hebrew and
stop for his decision.

> This skill operationalizes **Phase 1** of `docs/capability-first.md` — the single source for the
> method, the binary caveat, the credentials note, and the three worked probes. It does **not**
> duplicate it: read the doc, run the probe. **Phase 2** (decompose → prove each brick alone →
> the three gates) is `/build-agent`; this skill precedes it, never replaces it.

## Context — Read First
1. `docs/capability-first.md` — the method (spike → feasibility gate → Phase 2), the binary
   caveat, the credentials note, and the worked probes (Document AI/Hebrew, PDF, Gmail).
2. `templates/agent-design-spec.md` §0 — the **Capability Card** you fill (capability · external
   proof · fixture · expected · verdict · risks).
3. `docs/agent-isolation-testing.md` §6 — deterministic-first grading of the expected output.

## Instructions

### Step 1 — Name the capability + its real input
One precise sentence — the *verb* + the *real* input: not "handle forms" but "extract the
labelled fields from THIS real one-page Hebrew membership PDF". A vague capability gives a vague
proof.

### Step 2 — Get a real fixture
A real file / email / payload — never a toy. Commit it under `tests/fixtures/<capability>/` so the
probe is repeatable (it is the same fixture the `/build-agent` §3 row and Gate-1 isolation test
reuse).

### Step 3 — Make ONE raw call, OUTSIDE n8n (the spike)
A `curl` to the API, or a ~20-line `node`/`python` script calling the SDK directly — no workflow,
no nodes, no orchestrator, just the capability and the real input. For a **binary** path never
rely on pinning a base64 string or a green Test-Step (n8n can report success while silently
dropping the binary — `docs/capability-first.md`); exercise the real bytes end-to-end.

### Step 4 — Compare to a hand-verified expected output
Deterministic-first: JSON parses → critical fields exact-match → field-diff for the rest;
LLM-as-judge only for genuinely open-ended text (`docs/agent-isolation-testing.md §6`).

### Step 5 — Fill the Capability Card + the feasibility gate (go/no-go)
Record capability · external proof (tool + command) · fixture · expected · **verdict** · risks
(mark unverified specifics as `משוער`) in the design-spec §0 Capability Card (save to
`docs/agent-specs/<intent>.md` if a build is likely).
- **Go** — the raw call produced the expected output on the real fixture → hand off to
  `/build-agent` (Phase 2).
- **No-go / partial** — re-scope **before** building: a different tool, a pre/post step (e.g. basic
  OCR + an external LLM), or tell Or it is not feasible as asked. Do **not** proceed to build.

### Step 6 — Report + stop
Summarize for Or in plain Hebrew: the capability, whether the raw probe worked on the real
fixture, the verdict, and the recommendation (build / re-scope / not feasible). Wait for his
decision. On a **go** with his OK, continue with `/build-agent`.

## Safety Rules
1. **Spike only — never build the agent here.** Building is `/build-agent` (Phase 2), and only
   after a **go** + Or's OK. Never auto-chain into a build.
2. **Never use a toy fixture.** A capability is "proven" only against a real input.
3. **Never trust a green checkmark for binary.** n8n can report success while silently dropping a
   binary; prove a binary path end-to-end, never by pinning (`docs/capability-first.md`).
4. **Mark unverified specifics as `משוער`** — assumptions to verify, not facts.
5. **Read secrets server-side only** — gcloud→REST, never `$secrets`/env, never printed.
6. **Plain Hebrew to Or; stop for his decision.**

## Examples

**User:** "לפני שאני בונה סוכן טפסים — תבדוק אם בכלל אפשר לקרוא טופס בעברית"

**Agent behaviour:**
Names it ("extract labelled fields from a real Hebrew one-page form"), commits a real Hebrew
sample under `tests/fixtures/form-reader/`, `curl`s Document AI's `process` endpoint on it, and
diffs the returned fields against a hand-verified expected JSON. Fills the Capability Card; the
Hebrew KVP path is weaker than Latin → verdict **partial** → re-scope to basic OCR + an external
LLM and re-probe. Reports to Or in Hebrew and stops — does **not** start building.

**User:** "הוכח שאפשר לשלוח מייל משורשר לפני שנבנה את הסוכן"

**Agent behaviour:**
Builds a raw RFC-2822 MIME with `In-Reply-To` + `References` + a matching `Subject`,
`users.messages.send` with `threadId`, and confirms it threads in a **recipient** inbox (not just
the sender's). Verdict **go** → Capability Card filled → hands off to `/build-agent` after Or's OK.
