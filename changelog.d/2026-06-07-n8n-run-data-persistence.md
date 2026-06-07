# Changelog fragment — n8n run-data persistence (2026-06-07)

> Per-development changelog fragment. Folded into `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## fix: system deploy template — n8n keeps a year of execution history (was 48h)

| Type | Summary |
|---|---|
| fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the n8n env upsert pruned executions older than 48h (and beyond 1000) and relied on n8n's implicit save-on-success default. Now sets it explicitly — `EXECUTIONS_DATA_SAVE_ON_SUCCESS/ON_ERROR=all`, `..._MANUAL_EXECUTIONS=true`, `..._ON_PROGRESS=true` (crash-safe mid-run) — and extends retention to `MAX_AGE=8760` (1 year) / `PRUNE_MAX_COUNT=25000`. Golden refreshed (`tests/golden/system/MANIFEST.sha256`). Propagates to systems provisioned after this change; existing systems need their own redeploy (or-tok fixed in parallel). |
