#!/usr/bin/env bash
# Verifies that daily cron workflows in watchdog-registry.json have tolerance_hours >= 25
# and correct daily cron expressions (not the old every-6h strings).
set -euo pipefail

REGISTRY="$(cd "$(dirname "$0")/../.." && pwd)/monitoring/watchdog-registry.json"

if [[ ! -f "$REGISTRY" ]]; then
  echo "FAIL: registry not found at $REGISTRY" >&2
  exit 1
fi

fail=0

check_entry() {
  local id="$1"
  local expected_cron="$2"
  local min_tolerance=25

  actual_cron=$(python3 -c "
import json, sys
data = json.load(open('$REGISTRY'))
entry = next((e for e in data['entries'] if e['id'] == '$id'), None)
if entry is None: sys.exit(1)
print(entry['cadence']['cron'])
")
  actual_tolerance=$(python3 -c "
import json, sys
data = json.load(open('$REGISTRY'))
entry = next((e for e in data['entries'] if e['id'] == '$id'), None)
if entry is None: sys.exit(1)
print(entry['cadence']['tolerance_hours'])
")

  local entry_fail=0

  if [[ "$actual_cron" != "$expected_cron" ]]; then
    echo "FAIL [$id]: cron='$actual_cron', expected '$expected_cron'" >&2
    entry_fail=1
  fi

  if (( actual_tolerance < min_tolerance )); then
    echo "FAIL [$id]: tolerance_hours=$actual_tolerance, want >= $min_tolerance (daily schedule)" >&2
    entry_fail=1
  fi

  if [[ "$entry_fail" -eq 0 ]]; then
    echo "OK   [$id]: cron='$actual_cron', tolerance_hours=$actual_tolerance"
  fi

  return "$entry_fail"
}

check_entry "factory-health-audit"  "0 6 * * *"  || fail=1
check_entry "system-runtime-audit"  "15 6 * * *" || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "FAIL: watchdog-registry.json has stale cadence entries for daily audit workflows" >&2
  exit 1
fi

echo "PASS: all daily audit entries have correct cron and tolerance_hours"
exit 0
