# `changelog.d/` — per-PR changelog fragments

This system inherits the factory's race-proof changelog. Instead of every PR hand-editing the
top of `CHANGELOG.md` (which collides when PRs run in parallel), each PR drops **one small
fragment file** here, and they are folded into a numbered `CHANGELOG.md` in a single pass.

## Add an entry (the default for any code PR)

Create `changelog.d/<YYYY-MM-DD>-<slug>.md` with one or more entries:

```markdown
## <type>: <short title>

| Type | Summary |
|---|---|
| <type> | <one-line summary> |
```

`<type>` is one of `feat` / `fix` / `chore` / `docs`. The CI "Changelog gates" job
(`scripts/check-changelog-updated.sh`) accepts either a `changelog.d/*.md` fragment or a direct
`CHANGELOG.md` edit, so a fragment satisfies the doc gate without touching the shared file.

## Fold fragments into `CHANGELOG.md`

Run `scripts/compile-changelog.sh` (one pass): it assigns the next `Stage N` to each fragment
entry, writes them to the top of `CHANGELOG.md` with the standard `| PR | Type | Summary |`
table, deletes the consumed fragments, and auto-archives the oldest entries into
`docs/changelog-archive/` past the 20 KB cap. Use `--check` for a dry run. Because the numbers
are assigned in one single-threaded pass, they never collide.
