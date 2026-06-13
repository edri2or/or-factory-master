#!/usr/bin/env bats
# e2e-proof-systems.bats — unit tests for the E2E gate's proof_systems brake
# (scripts/lib.sh::e2e_surface_proof_systems / e2e_proof_system_allowed).
#
# The factory rule: a provisioning-process change is proven LIVE on the standing
# proving system `or-edri-4` first, then locked into the template. The E2E gate
# enforces it by pinning the enforced per-system surfaces' proof to `or-edri-4`
# (e2e-surfaces.json `proof_systems`). A proof from any other system is rejected;
# a surface with no `proof_systems` accepts any system (backward compatible).

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  cd "$REPO_ROOT" || return 1   # _e2e_registry reads e2e-surfaces.json from cwd
  # shellcheck source=../lib.sh
  source "$REPO_ROOT/scripts/lib.sh"
}

teardown() {
  common_teardown
}

# --- e2e_proof_system_allowed (pure logic) ---

@test "allowed: system in the allowlist passes" {
  run e2e_proof_system_allowed "or-edri-4" $'or-edri-4'
  assert_success
}

@test "allowed: system NOT in the allowlist fails" {
  run e2e_proof_system_allowed "factory-test-099" $'or-edri-4'
  assert_failure
}

@test "allowed: empty allowlist accepts any system (backward compatible)" {
  run e2e_proof_system_allowed "anything-at-all" ""
  assert_success
}

@test "allowed: multi-system allowlist matches any member" {
  run e2e_proof_system_allowed "or-edri-4" $'or-other\nor-edri-4'
  assert_success
  run e2e_proof_system_allowed "nope" $'or-other\nor-edri-4'
  assert_failure
}

# --- e2e_surface_proof_systems (registry read) ---

@test "registry: enforced per-system surfaces are pinned to or-edri-4" {
  run e2e_surface_proof_systems "telegram-bot"
  assert_success
  assert_output "or-edri-4"

  run e2e_surface_proof_systems "deploy-edge"
  assert_success
  assert_output "or-edri-4"
}

@test "registry: a surface without proof_systems returns empty (no constraint)" {
  run e2e_surface_proof_systems "factory-mcp"
  assert_success
  assert_output ""
}

# --- end-to-end: committed proofs survive the brake ---

@test "every committed e2e-proof satisfies the telegram-bot proof_systems pin" {
  allowed="$(e2e_surface_proof_systems telegram-bot)"
  [ -n "$allowed" ]
  shopt -s nullglob
  local proofs=(e2e-proofs/*.json) p sys
  [ "${#proofs[@]}" -gt 0 ]   # there ARE committed proofs to check
  for p in "${proofs[@]}"; do
    sys="$(jq -r '.system // ""' "$p")"
    run e2e_proof_system_allowed "$sys" "$allowed"
    assert_success
  done
}
