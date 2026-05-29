#!/usr/bin/env bash
# common.bash — shared helpers for every BATS test file under scripts/tests/.
#
# Loaded at the top of each .bats file via:
#   load test_helper/common
#
# Provides:
#   - bats-support + bats-assert loaded (assert_success / assert_failure /
#     assert_output / assert_output --partial / refute_output / etc.)
#   - REPO_ROOT          — absolute path to the repo root, regardless of CWD
#   - make_tmpdir        — mktemp -d wrapper that auto-cleans on teardown
#   - make_fixture_repo  — temp git repo with one initial commit, ready for
#                         scripts that diff HEAD~1..HEAD
#   - common_teardown    — removes everything make_tmpdir/make_fixture_repo
#                         allocated for the current test
#
# These helpers exist so every check-script test stays short and obvious:
# create a fixture, run the script against it, assert on the verdict.

# `load` inside a helper still resolves relative to the *test file*'s dir,
# not this helper's dir. Use absolute paths anchored on this file so any
# .bats file under scripts/tests/ (at any depth) can `load test_helper/common`.
_THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
load "${_THIS_DIR}/bats-support/load"
load "${_THIS_DIR}/bats-assert/load"

# Absolute path to the repo root. Computed once per BATS process; safe even
# when a test cd's into a tmpdir, because we resolve relative to this file.
REPO_ROOT="$(cd "${_THIS_DIR}/../../.." && pwd)"
export REPO_ROOT

# Tracks every tmpdir / repo allocated by the current test, so common_teardown
# can blow them away in one shot. Reset by setup() in each test (BATS gives
# each test a fresh shell, so this array starts empty anyway — the export is
# belt-and-braces for tests that source other helpers).
_COMMON_TMP_PATHS=()
export _COMMON_TMP_PATHS

# Make a throwaway directory. Returns the path on stdout; the caller captures
# it with `dir=$(make_tmpdir)`. Auto-cleaned by common_teardown.
make_tmpdir() {
  local dir
  dir="$(mktemp -d)"
  _COMMON_TMP_PATHS+=("$dir")
  printf '%s\n' "$dir"
}

# Make a throwaway git repo with one empty initial commit. Useful for scripts
# that read `git diff HEAD~1..HEAD` — they need at least two commits to walk.
# The caller stages/commits additional files itself, then runs `git commit`
# again to produce the HEAD~1..HEAD window the script under test expects.
#
#   repo="$(make_fixture_repo)"
#   ( cd "$repo" && echo x > a.sh && git add a.sh && git commit -qm "add a" )
#
# The repo is fully self-contained — no global git config touched, no
# network access, deterministic identity.
make_fixture_repo() {
  local repo
  repo="$(make_tmpdir)"
  (
    cd "$repo"
    git init -q -b main
    git config user.email "test@example.com"
    git config user.name  "BATS Test"
    git config commit.gpgsign false
    git commit -q --allow-empty -m "initial"
  )
  printf '%s\n' "$repo"
}

# Remove every tmpdir/repo this test allocated. Tests opt in by calling this
# from their own teardown(), or by defining teardown() { common_teardown; }.
common_teardown() {
  local p
  for p in "${_COMMON_TMP_PATHS[@]}"; do
    [ -n "$p" ] && [ -d "$p" ] && rm -rf "$p"
  done
  _COMMON_TMP_PATHS=()
}
