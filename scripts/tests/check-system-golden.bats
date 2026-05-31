#!/usr/bin/env bats
# Tests for scripts/check-system-golden.sh + scripts/render-system-golden.sh —
# the static golden gate that fails on any drift in the templates/system render.
# Each test runs against an isolated copy of the mould + a throwaway golden dir
# (TEMPLATES_DIR / GOLDEN_DIR env overrides), so the committed golden is never
# touched.

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  CHECK="$REPO_ROOT/scripts/check-system-golden.sh"
  WORK="$(make_tmpdir)"
  mkdir -p "$WORK/templates/system"
  cp -a "$REPO_ROOT/templates/system/." "$WORK/templates/system/"
  export TEMPLATES_DIR="$WORK/templates/system"
  export GOLDEN_DIR="$WORK/golden"
}

teardown() {
  unset TEMPLATES_DIR GOLDEN_DIR
  common_teardown
}

@test "FAIL: missing golden tells you to --update" {
  run bash "$CHECK"
  assert_failure
  assert_output --partial "golden manifest missing"
}

@test "PASS: a freshly generated golden matches the render" {
  run bash "$CHECK" --update
  assert_success
  run bash "$CHECK"
  assert_success
  assert_output --partial "PASS"
}

@test "FAIL: editing a template file is detected as drift" {
  bash "$CHECK" --update
  printf '\n# drift probe\n' >> "$TEMPLATES_DIR/Caddyfile"
  run bash "$CHECK"
  assert_failure
  assert_output --partial "drift"
}

@test "FAIL: editing a rendered *.template surfaces a readable diff" {
  bash "$CHECK" --update
  printf '\nDRIFT for ${SYSTEM_NAME}\n' >> "$TEMPLATES_DIR/AGENTS.md.template"
  run bash "$CHECK"
  assert_failure
  assert_output --partial "rendered/AGENTS.md drift"
}

@test "PASS: --update after an intentional change re-greens the gate" {
  bash "$CHECK" --update
  printf '\n# intentional change\n' >> "$TEMPLATES_DIR/Caddyfile"
  run bash "$CHECK"
  assert_failure
  bash "$CHECK" --update
  run bash "$CHECK"
  assert_success
}
