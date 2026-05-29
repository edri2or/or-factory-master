#!/usr/bin/env bash
# OIL auto-fix end-to-end self-test fixture (TEMPORARY).
#
# Inert by design: nothing in the repo references or executes this file
# (pipeline-tests.yml only shellcheck-lints scripts/*.sh), so main stays green
# while it sits here. It exists ONLY to give the OIL auto-fix loop a small,
# reproducible, in-bounds bug to find + fix during a live verification run, then
# it is removed.
#
# The bug: sum_two is DOCUMENTED to return a + b but is CODED as a - b. A repro
# test (sum_two 2 3 must equal 5) fails before the fix and passes after — exactly
# the fail-before/pass-after contract the deterministic gate requires.
set -euo pipefail

# Return the sum of two integers.
sum_two() {
  local a="$1" b="$2"
  echo "$(( a - b ))"
}

sum_two "${1:-0}" "${2:-0}"
