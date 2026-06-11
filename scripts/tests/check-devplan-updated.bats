#!/usr/bin/env bats
# check-devplan-updated.bats — unit tests for scripts/check-devplan-updated.sh.
#
# Fails CI if code (.sh/.json/.yml/.yaml) changed while at least one active
# development plan (root DEVPLAN.md or devplans/*.md with `status: active`)
# exists, AND no active plan was updated in the same diff. A no-op when no
# plan is active.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-devplan-updated.sh"
ACTIVE_FM=$'---\ndev_name: test\nslug: t\nopened: 2026-05-29\nstatus: active\n---\n# test'
COMPLETED_FM=$'---\ndev_name: test\nslug: t\nopened: 2026-05-29\nstatus: completed\n---\n# test'

setup() {
  _COMMON_TMP_PATHS=()
  # Hermetic: a CI-provided branch env var must not leak into the fixture runs.
  # Only the oil-autofix exemption test sets GITHUB_HEAD_REF explicitly.
  unset GITHUB_HEAD_REF GITHUB_REF_NAME
}

teardown() {
  common_teardown
}

# Commit a set of (path -> content) pairs as one HEAD commit.
commit_files() {
  local repo="$1" msg="$2"
  shift 2
  (
    cd "$repo"
    while [ "$#" -gt 0 ]; do
      local path="$1" content="$2"
      shift 2
      mkdir -p "$(dirname "$path")"
      printf '%s\n' "$content" > "$path"
      git add "$path"
    done
    git commit -q -m "$msg"
  )
}

# --- happy paths ---

@test "PASS: no active plan exists → no-op" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "code with no plan" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "no active DEVPLAN"
}

@test "PASS: completed plan does NOT trigger the gate" {
  repo="$(make_fixture_repo)"
  # Seed a completed plan in HEAD~1 so it's not "changed" in the diff.
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$COMPLETED_FM" > devplans/done.md
    git add devplans/done.md
    git commit -q -m "seed completed plan"
  )
  commit_files "$repo" "code without plan touch" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "no active DEVPLAN"
}

@test "PASS: active plan exists and was updated alongside the code" {
  repo="$(make_fixture_repo)"
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$ACTIVE_FM" > devplans/feature.md
    git add devplans/feature.md
    git commit -q -m "seed active plan"
  )
  commit_files "$repo" "stage 1: code + plan update" \
    "scripts/foo.sh"        "echo foo" \
    "devplans/feature.md"   "$(printf '%s' "$ACTIVE_FM")"$'\nstage 1 done'

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

# --- failure paths ---

@test "FAIL: active plan exists but code changed without updating it" {
  repo="$(make_fixture_repo)"
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$ACTIVE_FM" > devplans/feature.md
    git add devplans/feature.md
    git commit -q -m "seed active plan"
  )
  commit_files "$repo" "code without plan touch" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "Active development(s) detected"
}

@test "FAIL: with two active plans, updating zero still fails" {
  repo="$(make_fixture_repo)"
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$ACTIVE_FM" > devplans/a.md
    printf '%s' "$ACTIVE_FM" > devplans/b.md
    git add devplans/a.md devplans/b.md
    git commit -q -m "seed two active plans"
  )
  commit_files "$repo" ".yaml change, no plan touch" \
    ".github/workflows/x.yaml" "name: X"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "Active development(s) detected"
}

# --- branch exemption (follow-up #9) ---

@test "PASS: oil-autofix/* branch is exempt even with active plan + code change" {
  repo="$(make_fixture_repo)"
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$ACTIVE_FM" > devplans/feature.md
    git add devplans/feature.md
    git commit -q -m "seed active plan"
  )
  # Same fixture as the primary FAIL case (active plan, code changed, plan NOT
  # updated) — only the branch differs. It must PASS because oil-autofix PRs are
  # automated safety-gated fixes, not dev stages.
  commit_files "$repo" "oil-autofix code change, no plan touch" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && GITHUB_HEAD_REF=oil-autofix/oil-49-1717000000 bash '$CHECK'"
  assert_success
  assert_output --partial "oil-autofix branch"
}

@test "PASS: oil-autofix/* via GITHUB_REF_NAME (push context) is also exempt" {
  repo="$(make_fixture_repo)"
  (
    cd "$repo"
    mkdir -p devplans
    printf '%s' "$ACTIVE_FM" > devplans/feature.md
    git add devplans/feature.md
    git commit -q -m "seed active plan"
  )
  commit_files "$repo" "oil-autofix code change, no plan touch" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && GITHUB_REF_NAME=oil-autofix/oil-50 bash '$CHECK'"
  assert_success
  assert_output --partial "oil-autofix branch"
}
