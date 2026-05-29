#!/usr/bin/env bats
# check-changelog-updated.bats — unit tests for scripts/check-changelog-updated.sh.
#
# The script fails CI if .sh/.json/.yml/.yaml changed in HEAD~1..HEAD without
# EITHER CHANGELOG.md OR a changelog.d/<...>.md fragment being changed in the
# same diff. It's a no-op when no code files changed.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-changelog-updated.sh"

setup() {
  _COMMON_TMP_PATHS=()
}

teardown() {
  common_teardown
}

# Helper: commit a set of (path -> content) pairs as a single HEAD commit on
# top of the fixture repo's initial commit, so HEAD~1..HEAD shows exactly
# what the test wants the script to see.
#
#   commit_files <repo> "<msg>" path1 content1 [path2 content2 ...]
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

@test "PASS: code change paired with CHANGELOG.md update" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "stage 1" \
    "scripts/foo.sh" "echo foo" \
    "CHANGELOG.md"   "## stage 1 — foo added"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: code change paired with a changelog.d/ fragment" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "stage 1 via fragment" \
    "scripts/foo.sh"                     "echo foo" \
    "changelog.d/2026-05-29-feature.md"  "## fragment"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: docs-only change (no .sh/.json/.yml/.yaml) is a no-op" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "docs only" \
    "README.md" "new docs"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

# --- failure paths ---

@test "FAIL: code change without any changelog touch" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "code only" \
    "scripts/foo.sh" "echo foo"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "ERROR"
}

@test "FAIL: .yml workflow change without any changelog touch" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "workflow only" \
    ".github/workflows/x.yml" "name: X"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "neither CHANGELOG.md nor a changelog.d/ fragment"
}
