#!/usr/bin/env bash
# Self-test for scripts/agent-classify.sh: runs it against every row of
# tests/agent-classify-fixtures.yml (task + worker → expected EFFECTIVE tier) and fails
# (exit 1) on any mismatch. Proves the capability-aware cap (Fix 1): a read-only worker caps
# a red-content task at yellow; an unlisted/write worker (or none) leaves it red.
# Pure bash + awk/sed (no jq) so it runs identically in CI and locally.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES="${FIXTURES:-$SCRIPT_DIR/../tests/agent-classify-fixtures.yml}"
CLASSIFY="$SCRIPT_DIR/agent-classify.sh"
# Drive the classifier against the test-only policy fixture (generic worker names), so the
# capability-aware cap stays exercised independent of the live production policy's worker list.
export POLICY_FILE="${POLICY_FILE:-$SCRIPT_DIR/../tests/agent-classify-policy.yml}"

if [[ ! -r "$FIXTURES" ]]; then
  echo "ERROR: fixtures file not readable: $FIXTURES" >&2
  exit 1
fi

# Emit "<expected_tier><US><worker><US><task>" per fixture record (three quoted fields). The
# field separator is ASCII Unit Separator (\037) — NOT tab — so an empty worker field (the
# backward-compat row) is preserved (read collapses adjacent IFS-whitespace like tab, not \037).
parse_fixtures() {
  awk '
    /^-[[:space:]]+task:/           { task = (match($0,/"[^"]*"/)) ? substr($0,RSTART+1,RLENGTH-2) : ""; haveT=1; next }
    haveT && /^[[:space:]]+worker:/ { wk   = (match($0,/"[^"]*"/)) ? substr($0,RSTART+1,RLENGTH-2) : ""; haveW=1; next }
    haveW && /expected_tier:/       { t=$2; gsub(/"/,"",t); printf "%s\037%s\037%s\n", t, wk, task; haveT=0; haveW=0 }
  ' "$FIXTURES"
}

fail=0
total=0
while IFS=$'\037' read -r expected worker task; do
  total=$((total + 1))
  got="$(bash "$CLASSIFY" "$task" "$worker" | sed -n 's/.*"tier":[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [[ "$got" == "$expected" ]]; then
    printf 'PASS  worker=%-16s -> %s\n' "${worker:-<none>}" "$got"
  else
    printf 'FAIL  worker=%-16s -> got=%s want=%s\n' "${worker:-<none>}" "$got" "$expected"
    fail=1
  fi
done < <(parse_fixtures)

if [[ $fail -ne 0 ]]; then
  echo "FAIL: agent classifier self-test had mismatches." >&2
  exit 1
fi
echo "PASS: agent classifier self-test — $total fixtures classified as expected."
