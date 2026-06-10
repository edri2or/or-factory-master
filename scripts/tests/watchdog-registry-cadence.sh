#!/usr/bin/env bash
# watchdog-registry-cadence.sh — proves that the two daily-audit entries in
# watchdog-registry.json carry a tolerance_hours and cron that match the actual
# daily schedule (not the old every-6h schedule they were mistakenly left on).
#
# Exits 1 if either entry still uses the stale every-6h cron or a sub-25h
# tolerance window; exits 0 when both are correct.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="$ROOT/monitoring/watchdog-registry.json"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[ -f "$REGISTRY" ] || fail "registry not found: $REGISTRY"

# ---------- helpers ----------------------------------------------------------

# Extract the cadence block for a named entry.
# Works with Python (always present on GitHub runners) or jq if available.
get_cadence() {
  local id="$1" field="$2"
  if command -v jq &>/dev/null; then
    jq -r --arg id "$id" \
      '.entries[] | select(.id==$id) | .cadence[$ARGS.named.field]' \
      --arg field "$field" \
      "$REGISTRY"
  else
    python3 - "$REGISTRY" "$id" "$field" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
entry = next(e for e in data["entries"] if e["id"] == sys.argv[2])
print(entry["cadence"][sys.argv[3]])
PY
  fi
}

# ---------- check factory-health-audit ---------------------------------------

FHA_CRON=$(get_cadence "factory-health-audit" "cron")
FHA_TOL=$(get_cadence  "factory-health-audit" "tolerance_hours")

echo "factory-health-audit: cron='$FHA_CRON' tolerance_hours=$FHA_TOL"

[[ "$FHA_CRON" == "0 6 * * *" ]] \
  || fail "factory-health-audit cron should be '0 6 * * *' (daily), got: '$FHA_CRON'"

[ "$FHA_TOL" -ge 25 ] 2>/dev/null \
  || fail "factory-health-audit tolerance_hours should be >=25, got: $FHA_TOL"

pass "factory-health-audit cadence is correct"

# ---------- check system-runtime-audit ---------------------------------------

SRA_CRON=$(get_cadence "system-runtime-audit" "cron")
SRA_TOL=$(get_cadence  "system-runtime-audit" "tolerance_hours")

echo "system-runtime-audit: cron='$SRA_CRON' tolerance_hours=$SRA_TOL"

[[ "$SRA_CRON" == "15 6 * * *" ]] \
  || fail "system-runtime-audit cron should be '15 6 * * *' (daily), got: '$SRA_CRON'"

[ "$SRA_TOL" -ge 25 ] 2>/dev/null \
  || fail "system-runtime-audit tolerance_hours should be >=25, got: $SRA_TOL"

pass "system-runtime-audit cadence is correct"

echo "All cadence checks passed."
