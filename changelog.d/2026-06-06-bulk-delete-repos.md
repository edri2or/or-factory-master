# Changelog fragment — bulk-delete-repos (2026-06-06)

> Per-development changelog fragment. Folded into `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## chore: bulk-delete-repos — guarded one-time org repo cleanup (operator token)

| Type | Summary |
|---|---|
| chore | New `.github/workflows/bulk-delete-repos.yml` — guarded, keep-list bulk delete of unused org repos (200+ stale past-experiment repos). Uses the OPERATOR's own temporary token (repo secret `BULK_DELETE_TOKEN`), NOT the broker App — a scoped, briefly-held credential the operator removes after. Dry-run default; real delete needs `dry_run=false`+`confirm=DELETE`; non-empty keep-list; stale-keep-list guard (≥3 keepers must match a live repo); `or-factory-master` hard-coded ALWAYS-keep; per-repo failures collected. Enumerates every org repo and deletes the rest. Listed in `monitoring/registry-exempt.txt`. yamllint clean. GitHub repo deletion is permanent — execution is human-gated via the dry-run plan + explicit confirm. |
