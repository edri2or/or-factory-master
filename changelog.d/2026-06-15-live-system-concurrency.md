## feat: per-system concurrency queue on the four live-system workflows

| Type | Summary |
|---|---|
| feat | The four factory workflows that act on a live system — `prove-on-test-system.yml`, `refresh-system-agents.yml`, `e2e-verify.yml`, `deploy-verify.yml` — now share a `concurrency` group `live-system-<system_name>` with `queue: max` (FIFO, up to 100 queued; `cancel-in-progress: false`, which `queue: max` requires). This serializes all factory operations on one live system (notably the standing proving system `or-edri-4`) so two parallel developments queue instead of overwriting each other's live state mid-proof. `e2e-verify`/`deploy-verify` were remapped from their old `*-verify-<target_ref>` group to the per-system group (matching the proof-system lock); `prove`/`refresh` gained a block they lacked. Intentional divergence: the `templates/system/` twins of e2e/deploy-verify keep the old grouping (golden-covered; backfill is future work). Not a provisioning-output change → no E2E proof; live queue serialization is verified post-merge on `or-edri-4`. |

## fix: actionlint -ignore for the stale queue-concurrency false-positive

| Type | Summary |
|---|---|
| fix | `playground-tests.yml`'s `actionlint` step gained a scoped `-ignore 'unexpected key "queue" for "concurrency" section'`. actionlint 1.7.7 (the pinned version) predates the `queue:` concurrency key (GitHub Actions GA 2026-05-07) and rejected the valid `queue: max` as an unexpected key, failing the "Playground tests" gate. yamllint and GitHub both accept the key; the version is left pinned (a bump risks unrelated new lint failures across the repo's workflows). Remove the `-ignore` once actionlint is bumped to a release that knows `queue`. |
