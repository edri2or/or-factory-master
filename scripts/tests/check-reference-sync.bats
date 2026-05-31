#!/usr/bin/env bats
# check-reference-sync.bats — unit tests for scripts/check-reference-sync.sh.
#
# The script enforces two invariants over HEAD~1..HEAD:
#   (A) a templates/system/ change must also touch tests/golden/system/;
#   (B) the envsubst ALLOWLIST must be byte-identical across the golden
#       renderer, provision workflow, and template validator.
# It is a no-op when nothing relevant changed and the allow-lists agree.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-reference-sync.sh"

# The canonical allow-list used by the passing fixtures (content is irrelevant
# to this gate — only that all three copies match).
ALLOWLIST_LINE="ALLOWLIST='\${SYSTEM_NAME} \${GCP_PROJECT} \${MODE}'"

setup() {
  _COMMON_TMP_PATHS=()
}

teardown() {
  common_teardown
}

# commit_files <repo> "<msg>" path1 content1 [path2 content2 ...]
commit_files() {
  local repo="$1" msg="$2"
  shift 2
  (
    cd "$repo"
    while [ "$#" -gt 0 ]; do
      local path="$1" content="$2"
      shift 2
      mkdir -p "$(dirname "$path")"
      printf '%s\n' "$content" > "$path"
      git add "$path"
    done
    git commit -q -m "$msg"
  )
}

# The three allow-list source files the parity check reads (default paths).
_render="scripts/render-system-golden.sh"
_provision=".github/workflows/provision-system.yml"
_validate="scripts/tests/validate-templates.sh"

@test "PASS: unrelated change with matching allow-lists is a no-op" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "unrelated" \
    "README.md"   "docs" \
    "$_render"    "$ALLOWLIST_LINE" \
    "$_provision" "$ALLOWLIST_LINE" \
    "$_validate"  "$ALLOWLIST_LINE"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "FAIL: templates/system change without a golden update" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "mould only" \
    "templates/system/Caddyfile" "reverse_proxy" \
    "$_render"    "$ALLOWLIST_LINE" \
    "$_provision" "$ALLOWLIST_LINE" \
    "$_validate"  "$ALLOWLIST_LINE"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "tests/golden/system/"
}

@test "PASS: templates/system change paired with a golden update" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "mould + golden" \
    "templates/system/Caddyfile"          "reverse_proxy" \
    "tests/golden/system/MANIFEST.sha256" "deadbeef  Caddyfile" \
    "$_render"    "$ALLOWLIST_LINE" \
    "$_provision" "$ALLOWLIST_LINE" \
    "$_validate"  "$ALLOWLIST_LINE"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_success
  assert_output --partial "PASS"
}

@test "FAIL: allow-list drift between the three copies" {
  repo="$(make_fixture_repo)"
  commit_files "$repo" "allow-list drift" \
    "README.md"   "docs" \
    "$_render"    "$ALLOWLIST_LINE" \
    "$_provision" "ALLOWLIST='\${SYSTEM_NAME} \${GCP_PROJECT}'" \
    "$_validate"  "$ALLOWLIST_LINE"

  run bash -c "cd '$repo' && bash '$CHECK'"
  assert_failure
  assert_output --partial "ALLOWLIST drift"
}
