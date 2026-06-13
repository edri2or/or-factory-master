#!/usr/bin/env bats
# runtime-audit-targets.bats — unit tests for scripts/runtime-audit-targets.sh.
#
# The runtime audit must ALWAYS probe the standing proving system (or-edri-4),
# which lives on a test project outside the Systems folder and so is never
# returned by gcloud. The script merges the folder listing with ALWAYS_PROBE,
# drops blanks, and de-duplicates. Tests inject the folder listing via
# RUNTIME_AUDIT_FOLDER_LIST (no gcloud, no network).

load test_helper/common

TARGETS="$REPO_ROOT/scripts/runtime-audit-targets.sh"

setup() { _COMMON_TMP_PATHS=(); }
teardown() { common_teardown; }

@test "always includes or-edri-4 even when the folder list omits it" {
  run env RUNTIME_AUDIT_FOLDER_LIST=$'sys-alpha\nsys-beta' ALWAYS_PROBE="or-edri-4" bash "$TARGETS"
  assert_success
  assert_line "or-edri-4"
  assert_line "sys-alpha"
  assert_line "sys-beta"
}

@test "or-edri-4 appears exactly once even if also folder-listed (dedup)" {
  run env RUNTIME_AUDIT_FOLDER_LIST=$'or-edri-4\nsys-alpha' ALWAYS_PROBE="or-edri-4" bash "$TARGETS"
  assert_success
  count="$(printf '%s\n' "$output" | grep -cx 'or-edri-4')"
  [ "$count" -eq 1 ]
}

@test "empty folder list still yields the always-probe system" {
  run env RUNTIME_AUDIT_FOLDER_LIST="" ALWAYS_PROBE="or-edri-4" bash "$TARGETS"
  assert_success
  assert_output "or-edri-4"
}

@test "no blank lines in the output" {
  run env RUNTIME_AUDIT_FOLDER_LIST=$'sys-alpha\n\nsys-beta\n' ALWAYS_PROBE="or-edri-4" bash "$TARGETS"
  assert_success
  refute_line ""
}

@test "supports multiple always-probe systems" {
  run env RUNTIME_AUDIT_FOLDER_LIST="sys-alpha" ALWAYS_PROBE="or-edri-4 or-other" bash "$TARGETS"
  assert_success
  assert_line "or-edri-4"
  assert_line "or-other"
  assert_line "sys-alpha"
}
