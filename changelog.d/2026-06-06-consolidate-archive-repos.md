# Changelog fragment — consolidate-to-master (2026-06-06)

> Per-development changelog fragment. Folded into the numbered `CHANGELOG.md` by
> `scripts/compile-changelog.sh`.

## chore: consolidate-to-master — one-shot workflow to archive the two retired repos (Stage 5)

| Type | Summary |
|---|---|
| chore | Final consolidation step — new one-shot `.github/workflows/archive-old-repos.yml` archives `edri2or/gcp-hands` and `edri2or/factory` (read-only, reversible) now that both their GCP control projects are deleted/inactive. Hardcoded to exactly those two repos with a guard that refuses anything else and hard-refuses the survivor; auth is WIF→broker-SA only to read the broker App creds from SM, then a GitHub PATCH `archived:true` as the org-wide broker App (administration:write, the same grant used for the protect-main ruleset). Idempotent. Listed in `monitoring/registry-exempt.txt` (one-shot, no cadence). yamllint clean. |
