## feat(ci): Playground Tests — runtime-validation CI layer (dev-stage)

| Type | Summary |
|---|---|
| feat | **Stage 1 — BATS infrastructure.** Add `bats-core` (v1.13.0), `bats-support` (v0.3.0), and `bats-assert` (v2.2.4) as git submodules under `scripts/tests/bats/` and `scripts/tests/test_helper/{bats-support,bats-assert}/` — each pinned to a full SHA, no `apt`-installed bats. Add the shared helper `scripts/tests/test_helper/common.bash` (anchored absolute paths so any `.bats` file under `scripts/tests/` can `load test_helper/common`): loads bats-support + bats-assert, exports `REPO_ROOT`, and provides `make_tmpdir` / `make_fixture_repo` / `common_teardown` for tests that need throwaway git repos or temp dirs. `scripts/tests/_smoke.bats` proves the harness end-to-end (5 checks, all PASS). Lays the ground for stage 2's per-script tests and stage 4's CI workflow. Devplan: `devplans/playground-tests.md`. |
