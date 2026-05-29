#!/usr/bin/env bats
# _smoke.bats — minimal proof that test_helper/common.bash loads cleanly and
# bats-support + bats-assert are available. If this passes, every other .bats
# file in this directory can rely on the same harness. Underscore-prefixed so
# it sorts first when running `bats scripts/tests/*.bats`.

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
}

teardown() {
  common_teardown
}

@test "REPO_ROOT points at the repo root" {
  [ -n "$REPO_ROOT" ]
  [ -f "$REPO_ROOT/CLAUDE.md" ]
}

@test "assert_success / assert_output work" {
  run bash -c 'echo hello'
  assert_success
  assert_output "hello"
}

@test "assert_failure catches a failing command" {
  run bash -c 'exit 7'
  assert_failure 7
}

@test "make_tmpdir returns a fresh writable directory" {
  dir="$(make_tmpdir)"
  [ -d "$dir" ]
  echo "x" > "$dir/x"
  [ -f "$dir/x" ]
}

@test "make_fixture_repo gives a usable git repo with an initial commit" {
  repo="$(make_fixture_repo)"
  [ -d "$repo/.git" ]
  ( cd "$repo" && git log --oneline | grep -q initial )
}
