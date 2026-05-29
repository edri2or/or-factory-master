#!/usr/bin/env bats
# check-actions-pinned.bats — unit tests for scripts/check-actions-pinned.sh.
#
# The script scans .github/workflows/*.yml,*.yaml and FAILS if any line
# matches its `uses:` regex with a ref that isn't a full 40-char hex SHA.
#
# IMPORTANT — known latent bug surfaced by these tests:
#   The script's regex is `^\s+uses:\s+[^.][^/]+/`, which requires `uses:`
#   immediately after leading whitespace. The standard YAML step form
#   `      - uses: owner/repo@ref` (with a list-item dash) does NOT match,
#   so step-level action uses ARE NOT INSPECTED by this script today. The
#   regex only catches the no-dash form used by reusable-workflow callers
#   (`jobs.<j>.uses:`).
#
# These tests document the script's ACTUAL behavior — they don't quietly
# fix the bug. The fix belongs in a separate dev-stage so the change is
# planned and reviewed; raising the bug is exactly what a Playground layer
# is supposed to do.

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

@test "PASS: reusable-workflow caller pinned to a full SHA" {
  # Reusable workflow caller — `uses:` sits directly at jobs.<j>.uses,
  # so the script's regex inspects it. Pinned to a 40-hex SHA → PASS.
  write_wf "caller.yml" "name: caller
jobs:
  call:
    uses: actions/example/.github/workflows/x.yml@${PINNED_SHA}"

  run bash -c "cd '$fixture' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: local action (uses: ./...) is ignored" {
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

# --- failure paths ---

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
