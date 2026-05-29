#!/usr/bin/env bash
# Reproduces the sum_two a-b vs a+b typo bug.
# Exits non-zero when the script subtracts; exits zero when it adds correctly.
set -euo pipefail

SCRIPT="$(dirname "$0")/../oil-selftest-draftpr.sh"

got="$(bash "$SCRIPT" 3 5)"
expected=8

if [[ "$got" != "$expected" ]]; then
  echo "FAIL: expected $expected, got $got" >&2
  exit 1
fi

echo "PASS: sum_two 3 5 = $got"
