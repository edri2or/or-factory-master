# Changelog fragment — capability-first (2026-06-10)

> A per-development changelog fragment (date + slug), written here instead of at the head of
> `CHANGELOG.md` per the repo's default for all developments. The **Compile changelog** workflow
> folds it into a numbered `CHANGELOG.md` in one single-threaded run. The CI changelog gate accepts
> this fragment.

## docs: capability-first — Phase-1 front doc + precise Pin/binary fix + Capability Card (Stage 1/3)

| Type | Summary |
|---|---|
| docs | Stage 1 of the capability-first development. New `docs/capability-first.md` adds a **Phase 1** that runs *before* n8n — prove the raw capability **outside n8n** (a curl/script spike) on a real fixture, then a feasibility go/no-go, then **Phase 2 = the existing `/build-agent` flow** — with three worked probes (Document AI/Hebrew marked *partial*; PDF fill via pdf-lib/PDFtk + Documenso for e-sign; Gmail RFC-2822 threading) and a credentials note (gcloud→REST, not Enterprise-only `$secrets`/env). Unverified specifics (`iw` vs `he`, "generative Form Parser English-only + 4 regions") are explicitly marked `משוער` (assumption, not fact). `templates/agent-design-spec.md` gains a **§0 Capability Card** section, a base64-string-vs-real-binary caveat under §3, and a feasibility-gate link to the new doc. `docs/agent-isolation-testing.md` §4 gains the precise binary caveat — *n8n may report node success while silently dropping the binary, pinning included* (GitHub #28843 on 2.15.0; docs "you can't pin data if the output includes binary data"), prove binary end-to-end via a real Webhook trigger — and §7's worked example cross-references it. No `templates/system/**` touch (golden/mirror untouched); reference docs only. |

## feat: capability-first — wire the Phase-1 front into `/build-agent` Step 0 + refresh golden (Stage 2/3)

| Type | Summary |
|---|---|
| feat | Stage 2 of the capability-first development. `.claude/commands/build-agent.md` Step 0 now opens with **"Phase 1 first — prove the raw capability OUTSIDE n8n"** (a curl/script spike on a real fixture + feasibility go/no-go, recorded in the design-spec Capability Card), and the "Context — Read First" list gains `docs/capability-first.md` as item 5 (before `agent-isolation-testing.md`) — it *precedes* "prove each brick alone", never replaces it. The byte-identical mirror `templates/system/.claude/commands/build-agent.md` was regenerated via `scripts/sync-skills-mirror.sh` (not hand-edited) and `tests/golden/system/MANIFEST.sha256` refreshed via `scripts/check-system-golden.sh --update` (one hash line moved). Local gates green: skills-mirror, system-golden, golden-sync. |

## feat: capability-first — inject the front doc into provisioning + close development (Stage 3/3)

| Type | Summary |
|---|---|
| feat | Stage 3 (final) of the capability-first development. `.github/workflows/provision-system.yml`'s agent-build references loop gains one pair — `docs/capability-first.md\|docs/capability-first.md` — so every newly provisioned system is born with the Phase-1 front doc alongside `agent-design-spec.md` / `agent-isolation-testing.md` / `agent-role-decomposition-planning.md` (the loop comment "the two rationale/how-to docs" → "the rationale/how-to docs"). Proven by replicating the workflow's exact `for pair` guard against the repo root — all six sources present, so `[ -f … ] \|\| exit 1` does not fire and the `cp` succeeds; yamllint clean. The new doc is a factory-root reference (not under `templates/system/**`), so it reaches systems via this provision-time copy, not the golden. Closes the development (`devplans/capability-first.md` → `status: completed`). Net effect: every system provisioned after this merge carries the capability-first methodology end-to-end — prove the raw capability outside n8n, feasibility gate, then build — wired into its own `/build-agent`. No live test system was stood up (inert reference docs, no runtime/deploy surface; lightweight proof). |

## feat: capability-first — dedicated `/prove-capability` skill, in addition to the build-agent hook (Stage 4/4)

| Type | Summary |
|---|---|
| feat | Stage 4 (added on Or's request, pre-merge) of the capability-first development. New `.claude/commands/prove-capability.md` (`audience: shared`) — a **thin** standalone slash-command for the Phase-1 feasibility spike, so a capability can be proven *before* deciding to build a whole agent. It **delegates to `docs/capability-first.md`** (single source — no methodology duplication, the parallel-playbook the research warned against) and **hands off to `/build-agent`** on a "go" verdict; it never builds the agent itself. Added **in addition to** the build-agent Step-0 hook (Stage 2), not as a replacement. Mirrored byte-identically to `templates/system/.claude/commands/prove-capability.md` via `scripts/sync-skills-mirror.sh` (68 shared commands) and `tests/golden/system/MANIFEST.sha256` refreshed (122 files). Local gates green: skills-mirror, system-golden, golden-sync. Net: every system also gets the direct `/prove-capability` command alongside the wired-in Step-0 front. |
