## fix: devplan gate exempts oil-autofix/* branches (follow-up #9)

| Type | Summary |
|---|---|
| fix | `scripts/check-devplan-updated.sh` now skips (PASS) when the branch is `oil-autofix/*` (read from `GITHUB_HEAD_REF`, falling back to `GITHUB_REF_NAME`). OIL auto-fix PRs are automated, safety-gated fixes — not dev stages — so they correctly never touch a devplan and must not be blocked by the devplan gate even while a development is active (this is how OIL-49 stalled this morning). No workflow change needed (both are GitHub default env vars). New `check-devplan-updated.bats` tests prove the exemption via both env vars plus a hermetic `setup()`; fail-before/pass-after demonstrated. |

## fix: GCP risk gate rejects a leading/doubled gcloud (follow-up #8)

| Type | Summary |
|---|---|
| fix | `scripts/gcp-classify.sh` now rejects (exit 3, clear stderr) any command whose first token is `gcloud` — most often a doubled `gcloud gcloud …`. Such a command otherwise fell through to the `red` tier and reached Or's Telegram approval card for a command that can only fail at runtime (the execute step re-prepends `gcloud`). Because `gcp-action.yml`'s Classify step runs under `set -e` (`OUT=$(bash scripts/gcp-classify.sh …)`), the non-zero exit aborts the propose flow before the approval POST — no workflow change needed. `scripts/test-gcp-classify.sh` gained a `reject` expectation and `tests/gcp-classify-fixtures.yml` two reject rows; fail-before/pass-after demonstrated. |
