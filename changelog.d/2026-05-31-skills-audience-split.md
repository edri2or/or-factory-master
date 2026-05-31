# Changelog fragment — skills-audience-split (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## chore: skills-audience-split — tag all existing commands `audience: shared` (Stage 1/3)

| Type | Summary |
|---|---|
| chore | Stage 1 of the skills-audience-split development — prepares the per-skill propagation split without changing any behavior. Adds `audience: shared` as the first frontmatter key (right after the opening `---`) to all 65 `.claude/commands/*.md` files **and** their byte-identical mirror `templates/system/.claude/commands/*.md`. `shared` means "used by the factory AND shipped to every provisioned system" — i.e. exactly today's behavior for all current commands, so no system's command set changes. The two dirs stay byte-identical, so the existing `check-skills-mirror.sh` still passes; the audience-aware guard that consumes the tag lands in Stage 2. Verified: `diff -rq .claude/commands templates/system/.claude/commands` empty; `bash scripts/check-skills-mirror.sh` → PASS (65 skills). |
