#!/usr/bin/env bats
# select-result-file.bats — unit tests for scripts/select-result-file.sh (Fix 4).
#
# Proves corr-strict selection: the corr-named file is returned; a dir that holds ONLY a
# different corr's json FAILS (no "first json" fallback) — so a polled-wrong worker run can
# never be silently written under the wrong correlation_id.

load test_helper/common

SCRIPT=""

setup() {
  _COMMON_TMP_PATHS=()
  SCRIPT="$REPO_ROOT/scripts/select-result-file.sh"
  DL="$(make_tmpdir)"
}

teardown() {
  common_teardown
}

@test "returns the corr-named file when present" {
  echo '{"answer":"ok"}' > "$DL/aaa.json"
  run bash "$SCRIPT" "$DL" aaa
  assert_success
  assert_output "$DL/aaa.json"
}

@test "FAILS when only a DIFFERENT corr's json is present (no first-json fallback)" {
  echo '{"answer":"other"}' > "$DL/bbb.json"
  run bash "$SCRIPT" "$DL" aaa
  assert_failure
  assert_output --partial "expected"
  assert_output --partial "aaa.json"
}

@test "FAILS when the dir is empty" {
  run bash "$SCRIPT" "$DL" aaa
  assert_failure
}

@test "ignores an unrelated extra json and still returns the corr one" {
  echo '{"answer":"ok"}' > "$DL/aaa.json"
  echo '{"answer":"noise"}' > "$DL/zzz.json"
  run bash "$SCRIPT" "$DL" aaa
  assert_success
  assert_output "$DL/aaa.json"
}

@test "FAILS on missing args (usage)" {
  run bash "$SCRIPT" "$DL"
  assert_failure
  assert_output --partial "usage"
}
