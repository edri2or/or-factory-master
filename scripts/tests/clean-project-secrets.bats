#!/usr/bin/env bats
# clean-project-secrets.bats — unit tests for scripts/clean-project-secrets.sh.
#
# Uses a mock gcloud to verify flag parsing, project guards, and filter
# behaviour without touching real GCP resources.

load test_helper/common

SCRIPT=""

setup() {
  _COMMON_TMP_PATHS=()
  SCRIPT="$REPO_ROOT/scripts/clean-project-secrets.sh"

  # Build a mock gcloud in a private tmpdir and prepend it to PATH.
  # The mock records every invocation to calls.log, and returns preset
  # secret lists that let us verify which filter was (or wasn't) used.
  MOCK_DIR="$(make_tmpdir)"
  CALLS_LOG="$MOCK_DIR/calls.log"

  # Write mock — $MOCK_DIR / $CALLS_LOG are expanded at write time;
  # $* and $1 inside the heredoc are escaped so they stay literal.
  cat > "$MOCK_DIR/gcloud" << MOCK_EOF
#!/usr/bin/env bash
echo "\$*" >> "${CALLS_LOG}"
case "\$*" in
  *"NOT labels.copied-from-factory"*)
    # Reuse-filtered list: only test-specific secrets survive
    printf 'runtime-secret\ngithub-app-id\n'
    ;;
  *"secrets list"*)
    # Full (unfiltered) list: generics + test-specific
    printf 'generic-secret\nruntime-secret\ngithub-app-id\n'
    ;;
  *"secrets delete"*)
    true
    ;;
esac
MOCK_EOF
  chmod +x "$MOCK_DIR/gcloud"

  export PATH="$MOCK_DIR:$PATH"
  export CALLS_LOG
}

teardown() {
  common_teardown
}

# ---------------------------------------------------------------------------
# Guards — control project rejected in every mode
# ---------------------------------------------------------------------------

@test "FAIL: control project rejected in default mode" {
  run bash "$SCRIPT" or-factory-master-control
  assert_failure
  assert_output --partial "FAIL: refusing to wipe secrets in control project"
}

@test "FAIL: old control project rejected in default mode" {
  run bash "$SCRIPT" factory-control-9piybr
  assert_failure
  assert_output --partial "FAIL: refusing to wipe secrets in control project"
}

@test "FAIL: control project rejected in reuse mode" {
  run bash "$SCRIPT" --reuse or-factory-master-control
  assert_failure
  assert_output --partial "FAIL: refusing to wipe secrets in control project"
}

@test "FAIL: control project rejected in adopt mode" {
  run bash "$SCRIPT" --adopt or-factory-master-control
  assert_failure
  assert_output --partial "FAIL: refusing to wipe secrets in control project"
}

# ---------------------------------------------------------------------------
# Guards — project-pattern enforcement
# ---------------------------------------------------------------------------

@test "FAIL: default mode rejects non-test project name" {
  run bash "$SCRIPT" my-real-system
  assert_failure
  assert_output --partial "not an allowed test project"
}

@test "FAIL: reuse mode rejects non-test project name" {
  run bash "$SCRIPT" --reuse my-real-system
  assert_failure
  assert_output --partial "not an allowed test project"
}

@test "FAIL: adopt mode rejects factory-test-25" {
  run bash "$SCRIPT" --adopt factory-test-25
  assert_failure
  assert_output --partial "refusing to wipe factory-test-25"
}

@test "FAIL: --adopt and --reuse are mutually exclusive" {
  run bash "$SCRIPT" --adopt --reuse factory-test-25
  assert_failure
  assert_output --partial "mutually exclusive"
}

@test "FAIL: unknown flag is rejected" {
  run bash "$SCRIPT" --unknown factory-test-25
  assert_failure
  assert_output --partial "unknown flag"
}

@test "FAIL: missing project argument" {
  run bash "$SCRIPT"
  assert_failure
  assert_output --partial "Usage:"
}

# ---------------------------------------------------------------------------
# Default mode — full wipe, no label filter
# ---------------------------------------------------------------------------

@test "default mode deletes all secrets (no label filter)" {
  run bash "$SCRIPT" factory-test-25
  assert_success
  assert_output --partial "Mode: full wipe"
  assert_output --partial "3 secret(s) to delete"
  assert_output --partial "deleted: generic-secret"
  assert_output --partial "deleted: runtime-secret"
  assert_output --partial "deleted: github-app-id"
  assert_output --partial "3 secret(s) deleted"
}

@test "default mode does not use NOT labels filter" {
  run bash "$SCRIPT" factory-test-25
  assert_success
  refute_output --partial "NOT labels"
}

@test "default mode accepts v2-test- project pattern" {
  run bash "$SCRIPT" v2-test-abc
  assert_success
  assert_output --partial "Mode: full wipe"
}

@test "default mode accepts or-test- project pattern" {
  run bash "$SCRIPT" or-test-xyz
  assert_success
  assert_output --partial "Mode: full wipe"
}

# ---------------------------------------------------------------------------
# Reuse mode — targeted delete, keeps copied-from-factory
# ---------------------------------------------------------------------------

@test "reuse mode uses NOT labels.copied-from-factory filter" {
  run bash "$SCRIPT" --reuse factory-test-25
  assert_success
  assert_output --partial "Mode: targeted (reuse)"
  # only test-specific secrets are deleted (2, not 3)
  assert_output --partial "2 secret(s) to delete"
  assert_output --partial "deleted: runtime-secret"
  assert_output --partial "deleted: github-app-id"
  assert_output --partial "2 secret(s) deleted"
}

@test "reuse mode does NOT delete copied-from-factory secrets" {
  run bash "$SCRIPT" --reuse factory-test-25
  assert_success
  refute_output --partial "deleted: generic-secret"
}

# ---------------------------------------------------------------------------
# Adopt mode — full wipe on non-test projects
# ---------------------------------------------------------------------------

@test "adopt mode deletes all secrets on a valid real project" {
  run bash "$SCRIPT" --adopt some-real-system
  assert_success
  assert_output --partial "Mode: full wipe"
  assert_output --partial "3 secret(s) to delete"
  assert_output --partial "deleted: generic-secret"
}

@test "adopt mode rejects invalid project-id shape" {
  run bash "$SCRIPT" --adopt "BAD_NAME"
  assert_failure
  assert_output --partial "not a valid GCP project id"
}
