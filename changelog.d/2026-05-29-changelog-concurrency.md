# Changelog fragment — changelog-concurrency (2026-05-29)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: changelog-concurrency — compile engine (changelog.d → numbered CHANGELOG) + auto-archive (Stage 1/4)

| Type | Summary |
|---|---|
| feat | Stage 1 of the changelog-concurrency development — completes the fragment mechanism the `parallel-dev-stage` track explicitly left as "optional folding". New `scripts/compile-changelog.sh` folds every `changelog.d/<date>-<slug>.md` fragment into `CHANGELOG.md` as `## Stage N` sections, assigning the numbers in ONE single-threaded run (so concurrent PRs never pick a colliding number), deletes the consumed fragments, and auto-rotates the oldest sections into `docs/changelog-archive/CHANGELOG-<date>.md` when nearing the 20 KB cap (automating today's manual archive). New `.github/workflows/compile-changelog.yml` (`workflow_dispatch`) runs it under the broker App and opens a PR with the result — never pushes to `main` directly (checkout `persist-credentials: false`, per the Stage-133 lesson). New `changelog.d/README.md` documents the per-PR fragment convention. Verified locally: `--check` dry-run plus a real run in a throwaway copy folded 2 entries → Stage 138/139, kept `CHANGELOG.md` under the cap, rotated the 2 oldest sections to the archive (newest-first), and a re-run was an idempotent no-op; `shellcheck --severity=error` + `yamllint` + all four supply-chain gates clean. |

## docs: changelog-concurrency — fragment is the default changelog path for every PR (Stage 2/4)

| Type | Summary |
|---|---|
| docs | Stage 2 of the changelog-concurrency development — the change that actually closes the normal-PR race Or reported. Makes the `changelog.d/` fragment the **default** changelog path for every code PR, not just the parallel-development escape hatch the `parallel-dev-stage` track introduced. `.claude/commands/dev-stage.md` Step 3(b) (and its byte-identical mirror `templates/system/.claude/commands/dev-stage.md`) now instructs every stage to write its entry to a per-development fragment `changelog.d/<YYYY-MM-DD>-<slug>.md` and **never** hand-edit the head of `CHANGELOG.md`; the numbered `CHANGELOG.md` is produced only by the Compile changelog workflow (Stage 1). `CLAUDE.md` "Development workflow" updated to match. Net effect: a regular feature PR no longer picks a `Stage N` by hand, so it cannot collide. No code change; `check-skills-mirror.sh` passes (mirror byte-identical). |

## feat: changelog-concurrency — propagate compile engine + changelog.d seed to the system template (Stage 3/4)

| Type | Summary |
|---|---|
| feat | Stage 3 of the changelog-concurrency development. Every newly-provisioned system now inherits the race-proof changelog: `provision-system.yml`'s scaffold step copies the portable `scripts/compile-changelog.sh` (the portable-script list grows 8 → 9) and seeds a `changelog.d/` fragment dir + convention `README.md` (new `templates/system/changelog.d/README.md`) into the system repo. Combined with the already-propagated fragment-accepting gate (`check-changelog-updated.sh`) and the fragment-by-default `/dev-stage`, a new system inherits the full mechanism. `CLAUDE.md` governance line updated (8 → 9 portable scripts + `changelog.d/`). **Deferred:** the system-flavored compile *workflow* — it needs per-system WIF + `github-app-private-key` wiring that can't be verified without an actual provision, so shipping it untested would violate "verify each step"; a system's agent runs `bash scripts/compile-changelog.sh` directly meanwhile (the factory's own compile workflow from Stage 1 covers the factory repo). Verified: `yamllint` + all four supply-chain gates green on the edited `provision-system.yml`; YAML still parses to one `provision` job. |
