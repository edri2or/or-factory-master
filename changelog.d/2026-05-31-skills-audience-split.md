# Changelog fragment — skills-audience-split (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## chore: skills-audience-split — tag all existing commands `audience: shared` (Stage 1/3)

| Type | Summary |
|---|---|
| chore | Stage 1 of the skills-audience-split development — prepares the per-skill propagation split without changing any behavior. Adds `audience: shared` as the first frontmatter key (right after the opening `---`) to all 65 `.claude/commands/*.md` files **and** their byte-identical mirror `templates/system/.claude/commands/*.md`. `shared` means "used by the factory AND shipped to every provisioned system" — i.e. exactly today's behavior for all current commands, so no system's command set changes. The two dirs stay byte-identical, so the existing `check-skills-mirror.sh` still passes; the audience-aware guard that consumes the tag lands in Stage 2. Verified: `diff -rq .claude/commands templates/system/.claude/commands` empty; `bash scripts/check-skills-mirror.sh` → PASS (65 skills). |

## feat: skills-audience-split — audience-aware mirror guard + sync regenerator (Stage 2/3)

| Type | Summary |
|---|---|
| feat | Stage 2 of the skills-audience-split development — the enforcement engine. Rewrites `scripts/check-skills-mirror.sh` from a blunt byte-identical `diff -rq` into an audience-aware guard: every `.claude/commands/*.md` MUST declare `audience: shared` or `audience: factory-only` in its first frontmatter block (missing/invalid → CI fails with a friendly per-file remediation, so every new skill is forced to choose where it ships), and the mirror `templates/system/.claude/commands/` must equal EXACTLY the `shared` set — byte-identical (`cmp -s`), no `factory-only` leak, none missing. The mirror is now a **derived subset**, not a forced clone. New `scripts/sync-skills-mirror.sh` regenerates the mirror from the tags (deletes mirror `*.md`, re-copies only `shared`; refuses to run on any missing/invalid tag), and the guard's drift error points at it. New `scripts/tests/check-skills-mirror.bats` (11 cases) locks in the behavior: shared+factory-only split, missing-tag fail, invalid-value fail, no-frontmatter fail, factory-only-leak fail, shared-missing fail, content-drift fail, body-only `audience:` ignored, and the sync regenerator's copy/exclude + refuse-on-bad-tag paths. Frontmatter extractor is awk parsing only the first `---…---` block (CRLF/space/quote tolerant); a `found` flag drives the exit code because awk always runs `END` on `exit`. Verified: guard on the real tree → `PASS: 65 shared shipped, 0 factory-only excluded`; `shellcheck --severity=error` clean on both scripts; all 11 bats green. CI wiring unchanged (`changelog-check.yml` already calls the guard at the same path). |
