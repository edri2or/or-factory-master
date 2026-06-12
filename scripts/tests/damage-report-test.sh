#!/usr/bin/env bash
# B4 proof — the configure "damage report" decision logic (master-system-integrity).
#
# Proves that the end-of-run report in templates/system/.github/workflows/
# configure-agent-router.yml:
#   - turns the job RED (exit 1) when ANY DEGRADED row is `critical`,
#   - stays GREEN (exit 0) when only `warning` rows are present (a clean birth with
#     an optional capability missing is never falsely RED'd),
#   - is a no-op (exit 0) when nothing degraded.
#
# `_report` below is a faithful MIRROR of the final block in the workflow — same
# `${#DEGRADED[@]}` guard, same `IFS='|' read` parse, same CRIT/exit decision —
# and it runs under the same `set -euo pipefail`, so a set-e / unbound-array
# regression in the workflow shape is caught here. Keep the two in sync.
set -euo pipefail

# --- MIRROR of the B4 final block (decision half; STEP_SUMMARY/_emit side-effects
#     are stubbed so we test pure control flow) -------------------------------
_report() {  # reads the DEGRADED array from the caller; echoes verdict; returns 0/1
  local CRIT=0 row c s r f
  if [ "${#DEGRADED[@]}" -gt 0 ]; then
    for row in "${DEGRADED[@]}"; do
      IFS='|' read -r c s r f <<< "$row"
      [ "$s" = "critical" ] && CRIT=1
    done
    if [ "$CRIT" = 1 ]; then echo "RED"; return 1; fi
    echo "GREEN-degraded"; return 0
  fi
  echo "GREEN-clean"; return 0
}
# -----------------------------------------------------------------------------

fails=0
assert() {  # assert <name> <expected-verdict> <expected-rc>
  local name="$1" exp_v="$2" exp_rc="$3" got_v got_rc
  got_v="$(_report)" && got_rc=0 || got_rc=$?
  if [ "$got_v" = "$exp_v" ] && [ "$got_rc" = "$exp_rc" ]; then
    echo "PASS: $name -> $got_v (rc=$got_rc)"
  else
    echo "FAIL: $name -> expected '$exp_v'(rc=$exp_rc), got '$got_v'(rc=$got_rc)" >&2
    fails=$((fails + 1))
  fi
}

# Case 1: a critical member (openrouter dead) among warnings -> RED / exit 1
DEGRADED=(
  "github_readonly|warning|github-app-* missing|register the App"
  "openrouter|critical|live chat/completions HTTP 401 — the bot answers nothing|rotate the key"
)
assert "critical-among-warnings-goes-RED" "RED" "1"

# Case 2: only warnings (clean birth, optional capabilities off) -> GREEN / exit 0
DEGRADED=(
  "railway_readonly|warning|railway-api-token missing|add the token"
  "telegram-bot|warning|token missing|run deploy"
)
assert "only-warnings-stays-GREEN" "GREEN-degraded" "0"

# Case 3: a db-setup shortfall (critical) alone -> RED / exit 1
DEGRADED=("db-setup|critical|only 7/10 Postgres tables present|fix db-setup")
assert "db-shortfall-goes-RED" "RED" "1"

# Case 4: nothing degraded -> no-op GREEN / exit 0
DEGRADED=()
assert "clean-is-noop-GREEN" "GREEN-clean" "0"

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "damage-report-test: ALL PASS (RED only on a critical member; warnings stay green)"
else
  echo "damage-report-test: $fails assertion(s) FAILED" >&2
  exit 1
fi
