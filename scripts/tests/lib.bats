#!/usr/bin/env bats
# lib.bats — unit tests for scripts/lib.sh::get_code_files.
#
# get_code_files filters a newline-separated list of paths down to those with
# extensions we treat as "code" for changelog/devplan gating: .sh, .json,
# .yml, .yaml. It must return empty (not exit non-zero) when nothing matches,
# so the gate scripts can call it safely under `set -euo pipefail`.

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  # shellcheck source=../lib.sh
  source "$REPO_ROOT/scripts/lib.sh"
}

teardown() {
  common_teardown
}

# --- happy paths ---

@test "get_code_files keeps .sh / .yml / .yaml / .json paths" {
  input=$'scripts/a.sh\n.github/workflows/b.yml\ntemplates/c.yaml\npackage.json'
  run get_code_files "$input"
  assert_success
  assert_output "$input"
}

# --- failure / edge paths ---

@test "get_code_files drops .md / .txt / extension-less paths" {
  input=$'README.md\nCHANGELOG.md\nnotes.txt\nMakefile'
  run get_code_files "$input"
  assert_success
  assert_output ""
}

@test "get_code_files returns empty (not error) for empty input" {
  # set -euo pipefail is on; the `|| true` in the helper must absorb grep's
  # exit code 1 (no match), otherwise callers would die here.
  run bash -c "set -euo pipefail; source '$REPO_ROOT/scripts/lib.sh'; get_code_files ''"
  assert_success
  assert_output ""
}

@test "get_code_files keeps only the code lines from a mixed list" {
  input=$'scripts/a.sh\nREADME.md\n.github/workflows/b.yml\nnotes.txt\npackage.json'
  expected=$'scripts/a.sh\n.github/workflows/b.yml\npackage.json'
  run get_code_files "$input"
  assert_success
  assert_output "$expected"
}
