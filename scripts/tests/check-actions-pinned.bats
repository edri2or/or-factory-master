#!/usr/bin/env bats
# check-actions-pinned.bats — unit tests for scripts/check-actions-pinned.sh.
#
# The script scans .github/workflows/*.yml,*.yaml and FAILS if any line
# matches its `uses:` regex with a ref that isn't a full 40-char hex SHA.
#
# Covers BOTH `uses:` forms the regex now inspects:
#   - step form:            "      - uses: owner/repo@ref"   (list-item dash)
#   - reusable-caller form: "    uses: owner/repo@ref"       (jobs.<j>.uses, no dash)
# Local actions (uses: ./...) are ignored in either form.
#
# Regression note: the step form was historically NOT inspected — the regex
# `^\s+uses:` couldn't match a leading list-item dash, so step-level action
# uses slipped through. The "step form … @v5/@short-SHA" cases below lock in
# the fix that taught the regex the `(-\s+)?` dash form; they fail on the old
# script and pass on the fixed one.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-actions-pinned.sh"

# A real pinned SHA (the one the factory uses for actions/checkout — 40 hex).
PINNED_SHA="93cb6efe18208431cddfb8368fd83d5badbf9bfd"

setup() {
  _COMMON_TMP_PATHS=()
  fixture="$(make_tmpdir)"
  mkdir -p "$fixture/.github/workflows"
}

teardown() {
  common_teardown
}

write_wf() {
  # write_wf <filename> <content>
  printf '%s\n' "$2" > "$fixture/.github/workflows/$1"
}

# --- happy paths ---

@test "PASS: step-form action pinned to a full SHA" {
  write_wf "step.yml" "name: step
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${PINNED_SHA}"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: reusable-workflow caller pinned to a full SHA" {
  # Reusable workflow caller — `uses:` sits directly at jobs.<j>.uses.
  write_wf "caller.yml" "name: caller
jobs:
  call:
    uses: actions/example/.github/workflows/x.yml@${PINNED_SHA}"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: local step action (- uses: ./...) is ignored" {
  write_wf "local-step.yml" "name: local-step
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/my-action"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: local reusable caller (uses: ./...) is ignored" {
  write_wf "local.yml" "name: local
jobs:
  call:
    uses: ./.github/workflows/reusable.yml"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: no workflows directory at all → skip (not fail)" {
  empty="$(make_tmpdir)"
  run bash -c "cd '$empty' && bash '$CHECK'"
  assert_success
  assert_output --partial "Skipping"
}

# --- failure paths (step form — the regression-locking cases) ---

@test "FAIL: step-form action pinned only to a tag (@v5)" {
  write_wf "step-tag.yml" "name: step-tag
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "unpinned action"
}

@test "FAIL: step-form action pinned to a short SHA" {
  write_wf "step-short.yml" "name: step-short
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@93cb6efe"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "unpinned action"
}

# --- failure paths (reusable-caller form) ---

@test "FAIL: reusable-workflow caller pinned only to a tag (@v1)" {
  write_wf "tag.yml" "name: tag
jobs:
  call:
    uses: actions/example/.github/workflows/x.yml@v1"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "unpinned action"
}

@test "FAIL: reusable-workflow caller pinned to a short SHA" {
  write_wf "short.yml" "name: short
jobs:
  call:
    uses: actions/example/.github/workflows/x.yml@93cb6efe"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_failure
  assert_output --partial "unpinned action"
}
