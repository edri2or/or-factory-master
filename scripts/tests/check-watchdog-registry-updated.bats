#!/usr/bin/env bats
# check-watchdog-registry-updated.bats — unit tests for the watchdog registry
# CI gate. It must fail a PR that ADDS or REMOVES a monitorable surface (a
# workflow, an n8n template, or a hook script) without updating
# monitoring/watchdog-registry.json — and stay a no-op for plain edits and for
# surfaces listed in monitoring/registry-exempt.txt.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-watchdog-registry-updated.sh"

setup() { _COMMON_TMP_PATHS=(); }
teardown() { common_teardown; }

# Run the gate inside a repo, against its HEAD~1..HEAD diff.
run_gate() { run bash -c "cd '$1' && bash '$CHECK'"; }

@test "PASS: a non-surface change does not trigger the gate" {
  repo="$(make_fixture_repo)"
  ( cd "$repo" && mkdir -p scripts && echo 'echo hi' > scripts/foo.sh && git add . && git commit -q -m c1 )
  run_gate "$repo"
  assert_success
  assert_output --partial "skipped"
}

@test "PASS: surface added AND registry updated in the same diff" {
  repo="$(make_fixture_repo)"
  ( cd "$repo"
    mkdir -p .github/workflows monitoring
    echo 'name: X' > .github/workflows/x.yml
    echo '{"version":1,"entries":[]}' > monitoring/watchdog-registry.json
    git add . && git commit -q -m c1 )
  run_gate "$repo"
  assert_success
  assert_output --partial "registry was updated"
}

@test "FAIL: surface added WITHOUT updating the registry" {
  repo="$(make_fixture_repo)"
  ( cd "$repo"
    mkdir -p .github/workflows
    echo 'name: X' > .github/workflows/x.yml
    git add . && git commit -q -m c1 )
  run_gate "$repo"
  assert_failure
  assert_output --partial "was not updated"
}

@test "FAIL: surface deleted WITHOUT updating the registry" {
  repo="$(make_fixture_repo)"
  ( cd "$repo"
    mkdir -p .github/workflows
    echo 'name: X' > .github/workflows/x.yml
    git add . && git commit -q -m seed
    git rm -q .github/workflows/x.yml
    git commit -q -m drop )
  run_gate "$repo"
  assert_failure
  assert_output --partial "was not updated"
}

@test "PASS: a plain edit (no add/remove) does not trigger the gate" {
  repo="$(make_fixture_repo)"
  ( cd "$repo"
    mkdir -p .github/workflows
    echo 'name: X' > .github/workflows/x.yml
    git add . && git commit -q -m seed
    echo '# tweak' >> .github/workflows/x.yml
    git add . && git commit -q -m edit )
  run_gate "$repo"
  assert_success
  assert_output --partial "skipped"
}

@test "PASS: an exempt surface can be added without the registry" {
  repo="$(make_fixture_repo)"
  ( cd "$repo"
    mkdir -p .github/workflows monitoring
    echo 'name: Z' > .github/workflows/_verify-zzz.yml
    printf '%s\n' '.github/workflows/_verify-zzz.yml' > monitoring/registry-exempt.txt
    git add . && git commit -q -m c1 )
  run_gate "$repo"
  assert_success
  assert_output --partial "skipped"
}
