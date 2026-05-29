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
