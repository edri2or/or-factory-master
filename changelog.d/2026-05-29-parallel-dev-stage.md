# Changelog fragment — parallel-dev-stage (2026-05-29)

> A per-development changelog fragment, written here instead of at the head of
> `CHANGELOG.md` because another development (`oil-autofix`) was `status: active` in
> parallel — the exact case this development adds support for. Carries date + slug, so
> it never collides on a running number. May optionally be folded into `CHANGELOG.md`
> with running Stage numbers once no parallel development remains.

## feat: parallel dev-stage — dev-stage writes a changelog fragment in the parallel case (Stage 3/4)

| Type | Summary |
|---|---|
| feat | Stage 3 of the parallel-dev-stage development — and the first real use of the fragment mechanism itself. `.claude/commands/dev-stage.md` Step 3(b) (and its byte-identical mirror `templates/system/.claude/commands/dev-stage.md`) now instructs: when more than one development is `status: active` (counting the root `DEVPLAN.md` and every `devplans/*.md`), write the stage's changelog entry to a per-development fragment `changelog.d/<YYYY-MM-DD>-<slug>.md` (appending each stage to the same fragment) instead of the head of `CHANGELOG.md`, so two parallel PRs never collide on the changelog head. In the single-development case the behaviour is unchanged (write to `CHANGELOG.md`). The CI changelog gate already accepts the fragment (Stage 2). This very entry is written to the fragment because `oil-autofix` is active in parallel. |

## docs: parallel dev-stage — CLAUDE.md documents the parallel-development workflow + closure (Stage 4/4)

| Type | Summary |
|---|---|
| docs | Stage 4 (final) of the parallel-dev-stage development. `CLAUDE.md` "Development workflow" section updated to document the new behaviour end-to-end: every `/dev-stage` development now lives at `devplans/<slug>.md` (so parallel sessions don't collide on the plan file); the devplan gate enforces every active plan, not just the first; and in a parallel-development situation a stage's changelog entry goes to a dated `changelog.d/<YYYY-MM-DD>-<slug>.md` fragment that the changelog gate accepts, instead of the head of `CHANGELOG.md`. Closes the development (`devplans/parallel-dev-stage.md` → `status: completed`). Net effect across the four stages: two `/dev-stage` developments can run simultaneously in separate sessions without colliding on the plan file or the changelog; the normal single-development path is unchanged. |
