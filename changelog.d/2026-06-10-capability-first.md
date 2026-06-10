# Changelog fragment — capability-first (2026-06-10)

> A per-development changelog fragment (date + slug), written here instead of at the head of
> `CHANGELOG.md` per the repo's default for all developments. The **Compile changelog** workflow
> folds it into a numbered `CHANGELOG.md` in one single-threaded run. The CI changelog gate accepts
> this fragment.

## docs: capability-first — Phase-1 front doc + precise Pin/binary fix + Capability Card (Stage 1/3)

| Type | Summary |
|---|---|
| docs | Stage 1 of the capability-first development. New `docs/capability-first.md` adds a **Phase 1** that runs *before* n8n — prove the raw capability **outside n8n** (a curl/script spike) on a real fixture, then a feasibility go/no-go, then **Phase 2 = the existing `/build-agent` flow** — with three worked probes (Document AI/Hebrew marked *partial*; PDF fill via pdf-lib/PDFtk + Documenso for e-sign; Gmail RFC-2822 threading) and a credentials note (gcloud→REST, not Enterprise-only `$secrets`/env). Unverified specifics (`iw` vs `he`, "generative Form Parser English-only + 4 regions") are explicitly marked `משוער` (assumption, not fact). `templates/agent-design-spec.md` gains a **§0 Capability Card** section, a base64-string-vs-real-binary caveat under §3, and a feasibility-gate link to the new doc. `docs/agent-isolation-testing.md` §4 gains the precise binary caveat — *n8n may report node success while silently dropping the binary, pinning included* (GitHub #28843 on 2.15.0; docs "you can't pin data if the output includes binary data"), prove binary end-to-end via a real Webhook trigger — and §7's worked example cross-references it. No `templates/system/**` touch (golden/mirror untouched); reference docs only. |
