#!/usr/bin/env bash
# Self-test for scripts/gcp-classify.sh: runs it against every row of
# tests/gcp-classify-fixtures.yml and fails (exit 1) on any tier mismatch.
# Pure bash + awk/sed (no jq) so it runs identically in CI and locally.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES="${FIXTURES:-$SCRIPT_DIR/../tests/gcp-classify-fixtures.yml}"
CLASSIFY="$SCRIPT_DIR/gcp-classify.sh"

if [[ ! -r "$FIXTURES" ]]; then
  echo "ERROR: fixtures file not readable: $FIXTURES" >&2
  exit 1
fi

# Emit "<expected_tier>\t<command>" per fixture record. Tier is printed first so
# a trailing empty command (command: "") still parses cleanly with read.
parse_fixtures() {
  awk '
    /^-[[:space:]]+command:/ { cmd = (match($0,/"[^"]*"/)) ? substr($0,RSTART+1,RLENGTH-2) : ""; have=1; next }
    have && /expected_tier:/ { t=$2; gsub(/"/,"",t); printf "%s\t%s\n", t, cmd; have=0 }
  ' "$FIXTURES"
}

fail=0
total=0
while IFS=$'\t' read -r expected cmd; do
  total=$((total + 1))
  got="$(bash "$CLASSIFY" "$cmd" | sed -n 's/.*"tier":[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [[ "$got" == "$expected" ]]; then
    printf 'PASS  %-38s -> %s\n' "[$cmd]" "$got"
  else
    printf 'FAIL  %-38s -> got=%s want=%s\n' "[$cmd]" "$got" "$expected"
    fail=1
  fi
done < <(parse_fixtures)

if [[ $fail -ne 0 ]]; then
  echo "FAIL: GCP classifier self-test had mismatches." >&2
  exit 1
fi
echo "PASS: GCP classifier self-test — $total fixtures classified as expected."
