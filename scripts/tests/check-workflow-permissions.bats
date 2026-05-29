#!/usr/bin/env bats
# check-workflow-permissions.bats — unit tests for
# scripts/check-workflow-permissions.sh.
#
# The script scans .github/workflows/*.yml,*.yaml and FAILS if any line
# matches `permissions: write-all`. Scoped permissions blocks (contents:
# read, etc.) and the absence of a permissions key both PASS.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-workflow-permissions.sh"

setup() {
  _COMMON_TMP_PATHS=()
  fixture="$(make_tmpdir)"
  mkdir -p "$fixture/.github/workflows"
}

teardown() {
  common_teardown
}

write_wf() {
  printf '%s\n' "$2" > "$fixture/.github/workflows/$1"
}

# --- happy paths ---

@test "PASS: scoped permissions (contents: read) is allowed" {
  write_wf "scoped.yml" "name: scoped
permissions:
  contents: read
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: no permissions key at all" {
  write_wf "none.yml" "name: none
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

# --- failure paths ---

@test "FAIL: top-level permissions: write-all is forbidden" {
  write_wf "writeall.yml" "name: bad
permissions: write-all
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "write-all is forbidden"
}

@test "FAIL: indented permissions: write-all (job-level) is also forbidden" {
  # The grep is `^\s*permissions:\s*write-all` — leading whitespace allowed,
  # so any depth of write-all (workflow or job level) trips the gate.
  write_wf "indented.yml" "name: bad-indented
jobs:
  j:
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - run: echo ok"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "write-all is forbidden"
}
