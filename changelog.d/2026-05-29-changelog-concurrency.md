# Changelog fragment — changelog-concurrency (2026-05-29)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: changelog-concurrency — compile engine (changelog.d → numbered CHANGELOG) + auto-archive (Stage 1/4)

| Type | Summary |
|---|---|
| feat | Stage 1 of the changelog-concurrency development — completes the fragment mechanism the `parallel-dev-stage` track explicitly left as "optional folding". New `scripts/compile-changelog.sh` folds every `changelog.d/<date>-<slug>.md` fragment into `CHANGELOG.md` as `## Stage N` sections, assigning the numbers in ONE single-threaded run (so concurrent PRs never pick a colliding number), deletes the consumed fragments, and auto-rotates the oldest sections into `docs/changelog-archive/CHANGELOG-<date>.md` when nearing the 20 KB cap (automating today's manual archive). New `.github/workflows/compile-changelog.yml` (`workflow_dispatch`) runs it under the broker App and opens a PR with the result — never pushes to `main` directly (checkout `persist-credentials: false`, per the Stage-133 lesson). New `changelog.d/README.md` documents the per-PR fragment convention. Verified locally: `--check` dry-run plus a real run in a throwaway copy folded 2 entries → Stage 138/139, kept `CHANGELOG.md` under the cap, rotated the 2 oldest sections to the archive (newest-first), and a re-run was an idempotent no-op; `shellcheck --severity=error` + `yamllint` + all four supply-chain gates clean. |
