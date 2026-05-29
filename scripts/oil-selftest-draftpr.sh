#!/usr/bin/env bash
# oil-selftest-draftpr.sh — tiny integer-sum helper for the factory self-check.
# Usage: oil-selftest-draftpr.sh <a> <b>  ->  prints a + b
set -euo pipefail

sum_two() {
  local a="$1" b="$2"
  echo "$(( a + b ))"
}

sum_two "${1:-0}" "${2:-0}"
