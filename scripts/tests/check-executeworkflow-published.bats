#!/usr/bin/env bats
# Tests for scripts/check-executeworkflow-published.sh — the static gate that
# fails when a published workflow references (via executeWorkflow / MAIN) a
# sub-workflow that configure installs UNPUBLISHED (n8n 2.x refuses to publish
# the parent → HTTP 400; the proven async-deep-research / factory-test-053 bug).
# Each test runs against an isolated copy of the mould so nothing real is touched.

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  CHECK="$REPO_ROOT/scripts/check-executeworkflow-published.sh"
  WORK="$(make_tmpdir)"
  cp -a "$REPO_ROOT/templates/system/." "$WORK/"
  export WF_DIR="$WORK/workflows/n8n"
  export CONFIGURE_FILE="$WORK/.github/workflows/configure-agent-router.yml"
}

teardown() {
  unset WF_DIR CONFIGURE_FILE
  common_teardown
}

@test "PASS: the real mould — every executeWorkflow sub is published" {
  run bash "$CHECK"
  assert_success
  assert_output --partial "PASS: executeWorkflow-published check"
}

@test "FAIL: a sub called via executeWorkflow installed unpublished (… no)" {
  sed -i 's#_upsert_wf "factory-master: tg-vision" /tmp/ar-prep-tg-vision.json yes#_upsert_wf "factory-master: tg-vision" /tmp/ar-prep-tg-vision.json no#' "$CONFIGURE_FILE"
  run bash "$CHECK"
  assert_failure
  assert_output --partial "installed unpublished"
}

@test "FAIL: an executeWorkflow placeholder with no sed substitution (dangling)" {
  sed -i '/s#@@SUB_DEEP_RESEARCH_WF_ID@@#/d' "$CONFIGURE_FILE"
  run bash "$CHECK"
  assert_failure
  assert_output --partial "no 's#@@"
}

@test "PASS: toolWorkflow-only subs may stay unpublished (request-write-action)" {
  # request-write-action is installed with 'no' on purpose (ai_tool reference,
  # exempt). The gate must NOT flag it — it is never an executeWorkflow target.
  run bash "$CHECK"
  assert_success
}

@test "PASS: empty workflow dir is a no-op" {
  rm -f "$WF_DIR"/*.json
  run bash "$CHECK"
  assert_success
  assert_output --partial "nothing to enforce"
}
