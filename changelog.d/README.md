# `changelog.d/` — per-PR changelog fragments

This directory holds **one small changelog fragment per pull request** instead of every PR
hand-editing the top of `CHANGELOG.md`. It exists to kill a real race: when two PRs each
picked the next sequential `## Stage N` at the head of a single shared `CHANGELOG.md`, they
collided (duplicate/stale numbers, repeated merge conflicts). A fragment file is unique by
construction, so **parallel PRs never collide and no number is ever picked by hand.**

This is the towncrier / Changesets "news fragment" pattern, adapted to this repo.

## How to add an entry (the normal path for any code PR)

Create a file named `changelog.d/<YYYY-MM-DD>-<slug>.md` (date keeps it collision-free and
ordered; `<slug>` is a short kebab-case name for the change). Put one or more entries in it:

```markdown
## <type>: <short title>

| Type | Summary |
|---|---|
| <type> | <one-line summary — may contain `code`, escaped pipes \| etc.> |
```

- `<type>` is one of `feat` / `fix` / `chore` / `docs`.
- A PR may append several entries to the same fragment file (one `##` block each).
- The CI "Changelog gates" job (`scripts/check-changelog-updated.sh`) accepts **either** a
  `changelog.d/*.md` fragment **or** a direct `CHANGELOG.md` edit, so a PR carrying a
  fragment passes the doc gate without touching the shared file.

## How fragments become `CHANGELOG.md`

`scripts/compile-changelog.sh` (run via the **Compile changelog** workflow, `workflow_dispatch`)
folds every fragment here into `CHANGELOG.md`:

1. Computes the next free `Stage N` from `CHANGELOG.md` + `docs/changelog-archive/` — **once,
   single-threaded** — so the numbers are assigned without any concurrency, hence no collision.
2. Emits each fragment entry as a `## Stage N — <type>: <title>` section with the standard
   `| PR | Type | Summary |` table, newest at the top.
3. Deletes the consumed fragments.
4. If `CHANGELOG.md` would cross the 20 KB cap, rotates the oldest sections into
   `docs/changelog-archive/CHANGELOG-<date>.md` automatically.

The compile opens a PR with the result; it never pushes to `main` directly. Run it whenever
fragments have accumulated (e.g. before a quiet period, or on a cadence).

> `README.md` is ignored by the compiler — only `<date>-<slug>.md` fragments are folded.
