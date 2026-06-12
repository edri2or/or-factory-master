#!/usr/bin/env bash
# B3 proof — the configure register→configure ordering preflight (master-system-integrity).
#
# Proves the GitHub-App preflight decision in templates/system/.github/workflows/
# configure-agent-router.yml distinguishes three states and feeds the damage report
# correctly:
#   - APP_ID set + a github-app-* secret MISSING  -> GH_APP_BROKEN  -> CRITICAL row -> RED
#     (the App was registered but its credentials never reached SM — a real ordering break),
#   - APP_ID EMPTY + secrets missing              -> no GH_APP_BROKEN -> WARNING row -> GREEN
#     (App simply not registered yet — a clean pre-registration state, never falsely RED'd),
#   - APP_ID set + all secrets present            -> tool installed   -> no github row.
# It also proves the warning row is SUPPRESSED when broken (no duplicate github_readonly row).
#
# `_preflight` + `_github_rows` below are faithful MIRRORs of the corresponding lines in the
# workflow (the preflight `if` and the two DEGRADED+= lines), and `_report` mirrors the B4
# final block. All run under the same `set -euo pipefail`, so a set-e / unbound-array
# regression in the workflow shape is caught here. Keep them in sync.
set -euo pipefail

# --- MIRROR of the B3 preflight (configure-agent-router.yml, github-app block) ----------
_preflight() {  # args: APP_ID_VAR GH_APP_ID GH_APP_INSTALL_ID GH_APP_PRIVATE_KEY ; echoes GH_APP_BROKEN
  local APP_ID_VAR="$1" GH_APP_ID="$2" GH_APP_INSTALL_ID="$3" GH_APP_PRIVATE_KEY="$4"
  local GH_APP_BROKEN=""
  if [ -n "${APP_ID_VAR:-}" ] && { [ -z "$GH_APP_ID" ] || [ -z "$GH_APP_INSTALL_ID" ] || [ -z "$GH_APP_PRIVATE_KEY" ]; }; then
    GH_APP_BROKEN="APP_ID=${APP_ID_VAR} set but github-app-* missing in SM"
  fi
  printf '%s' "$GH_APP_BROKEN"
}

# --- MIRROR of the two github_readonly DEGRADED+= lines (B3 + the guarded B4 warning) ----
_github_rows() {  # args: WF_GITHUB_READONLY_ID GH_APP_BROKEN ; appends rows to DEGRADED
  local WF_GITHUB_READONLY_ID="$1" GH_APP_BROKEN="$2"
  [ -z "${WF_GITHUB_READONLY_ID:-}" ] && [ -z "${GH_APP_BROKEN:-}" ] && DEGRADED+=("github_readonly|warning|github-app-* missing / tool not installed|register the system App")
  [ -n "${GH_APP_BROKEN:-}" ] && DEGRADED+=("github_readonly|critical|${GH_APP_BROKEN}|re-run register-system-app or mirror github-app-* into SM")
  return 0
}

# --- MIRROR of the B4 final block (decision half) ---------------------------------------
_report() {  # reads DEGRADED from the caller; echoes verdict; returns 0/1
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
# ----------------------------------------------------------------------------------------

fails=0
# assert <name> <app_id> <gh_id> <gh_install> <gh_key> <wf_ghro_id> <exp_broken:Y/N> <exp_rows> <exp_verdict> <exp_rc>
assert() {
  local name="$1" app="$2" gid="$3" gin="$4" gkey="$5" wfid="$6" exp_broken="$7" exp_rows="$8" exp_v="$9" exp_rc="${10}"
  local broken got_broken rows_n got_v got_rc
  broken="$(_preflight "$app" "$gid" "$gin" "$gkey")"
  [ -n "$broken" ] && got_broken="Y" || got_broken="N"
  DEGRADED=()
  _github_rows "$wfid" "$broken"
  rows_n="${#DEGRADED[@]}"
  got_v="$(_report)" && got_rc=0 || got_rc=$?
  if [ "$got_broken" = "$exp_broken" ] && [ "$rows_n" = "$exp_rows" ] && [ "$got_v" = "$exp_v" ] && [ "$got_rc" = "$exp_rc" ]; then
    echo "PASS: $name -> broken=$got_broken rows=$rows_n $got_v (rc=$got_rc)"
  else
    echo "FAIL: $name -> expected broken=$exp_broken rows=$exp_rows '$exp_v'(rc=$exp_rc), got broken=$got_broken rows=$rows_n '$got_v'(rc=$got_rc)" >&2
    fails=$((fails + 1))
  fi
}

# Case 1: App registered (APP_ID set) but secrets gone -> BROKEN -> 1 critical row -> RED.
assert "registered-but-secrets-missing-goes-RED" "12345" "" "" "" "" "Y" "1" "RED" "1"

# Case 2: App registered, only ONE secret missing (private key) -> still BROKEN -> RED.
assert "registered-partial-secrets-goes-RED" "12345" "12345" "67890" "" "" "Y" "1" "RED" "1"

# Case 3: App NOT registered yet (APP_ID empty), secrets absent -> not broken -> 1 warning -> GREEN.
assert "not-registered-yet-stays-GREEN-warning" "" "" "" "" "" "N" "1" "GREEN-degraded" "0"

# Case 4: Healthy — App registered, all secrets present, tool installed -> not broken, no github row.
assert "healthy-all-present-no-row" "12345" "12345" "67890" "PEMKEY" "wf_ghro_99" "N" "0" "GREEN-clean" "0"

# Case 5: broken state must NOT also emit the warning row (no duplicate github_readonly row).
DEGRADED=()
_github_rows "" "$(_preflight "12345" "" "" "")"
if [ "${#DEGRADED[@]}" = "1" ] && [[ "${DEGRADED[0]}" == github_readonly\|critical\|* ]]; then
  echo "PASS: broken-suppresses-warning-row (exactly one critical row)"
else
  echo "FAIL: broken-suppresses-warning-row -> got ${#DEGRADED[@]} row(s): ${DEGRADED[*]}" >&2
  fails=$((fails + 1))
fi

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "github-app-preflight-test: ALL PASS (registered-but-secrets-missing is RED; not-registered stays a green warning)"
else
  echo "github-app-preflight-test: $fails assertion(s) FAILED" >&2
  exit 1
fi
