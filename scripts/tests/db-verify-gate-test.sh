#!/usr/bin/env bash
# B1 proof — db-setup table-verification gate (master-system-integrity).
#
# Proves that the verdict logic used by configure-agent-router.yml's db-setup
# verification returns the right answer on real-shaped n8n execution-detail JSON:
#   - all 10 expected tables present              -> "ok"        (job stays green)
#   - fewer than expected present                 -> "fail:<n>"  (job goes RED)
#   - Verify Tables never ran / count unreadable  -> "inconclusive" (loud WARN, never RED)
#
# `_db_verdict` below is a verbatim MIRROR of the function in
# templates/system/.github/workflows/configure-agent-router.yml — keep the two in
# sync (v1: the mirror is maintained by hand; drift would let this test pass while
# the workflow regressed). The execution "data" field is stringified JSON in real
# n8n responses, so the fixtures use escaped quotes to match production.
set -euo pipefail

DB_EXPECTED_TABLES=10

# --- MIRROR of _db_verdict in configure-agent-router.yml ---------------------
_db_verdict() {
  local f="$1" n=""
  [ -s "$f" ] || { echo inconclusive; return; }
  grep -qE 'lastNodeExecuted.{0,8}Verify Tables' "$f" 2>/dev/null || { echo inconclusive; return; }
  n=$(grep -oE 'present_count[^0-9]{0,6}[0-9]+' "$f" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || true)
  [ -n "$n" ] || { echo inconclusive; return; }
  if [ "$n" -ge "$DB_EXPECTED_TABLES" ]; then echo ok; else echo "fail:$n"; fi
}
# -----------------------------------------------------------------------------

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0
assert() {  # assert <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    echo "PASS: $1 -> $3"
  else
    echo "FAIL: $1 -> expected '$2', got '$3'" >&2
    fails=$((fails + 1))
  fi
}

# Fixture 1: all 10 present (stringified/escaped data, as n8n returns it) -> ok
printf '%s' '{"id":"55","finished":true,"data":"{\"resultData\":{\"lastNodeExecuted\":\"Verify Tables\",\"runData\":{\"Verify Tables\":[{\"data\":{\"main\":[[{\"json\":{\"present_tables\":\"agent_trace_events,audit_log,events,file_catalog,n8n_chat_histories,pending_actions,spend_log,spend_track_state,style_profile,tg_updates_seen\",\"present_count\":10}}]]}}]}}}"}' > "$TMP/ok.json"
assert "all-10-present" "ok" "$(_db_verdict "$TMP/ok.json")"

# Fixture 2: only 7 present -> fail:7 (this is the RED path)
printf '%s' '{"id":"56","finished":true,"data":"{\"resultData\":{\"lastNodeExecuted\":\"Verify Tables\",\"runData\":{\"Verify Tables\":[{\"data\":{\"main\":[[{\"json\":{\"present_tables\":\"audit_log,events,n8n_chat_histories,pending_actions,spend_log,style_profile,tg_updates_seen\",\"present_count\":7}}]]}}]}}}"}' > "$TMP/fail.json"
assert "only-7-present-goes-RED" "fail:7" "$(_db_verdict "$TMP/fail.json")"

# Fixture 3: a CONCURRENT foreign workflow's execution (the old false-negative
# source) — Verify Tables never ran -> inconclusive (loud WARN, NOT a false RED)
printf '%s' '{"id":"57","finished":true,"data":"{\"resultData\":{\"lastNodeExecuted\":\"Send Reply\",\"runData\":{\"Send Reply\":[{\"data\":{\"main\":[[{\"json\":{\"ok\":true}}]]}}]}}}"}' > "$TMP/foreign.json"
assert "foreign-execution-inconclusive" "inconclusive" "$(_db_verdict "$TMP/foreign.json")"

# Fixture 4: Verify Tables ran but no parseable count -> inconclusive
printf '%s' '{"id":"58","finished":true,"data":"{\"resultData\":{\"lastNodeExecuted\":\"Verify Tables\",\"runData\":{\"Verify Tables\":[{\"data\":{\"main\":[[{\"json\":{\"present_tables\":null}}]]}}]}}}"}' > "$TMP/nocount.json"
assert "verify-ran-no-count-inconclusive" "inconclusive" "$(_db_verdict "$TMP/nocount.json")"

# Fixture 5: empty file -> inconclusive
: > "$TMP/empty.json"
assert "empty-inconclusive" "inconclusive" "$(_db_verdict "$TMP/empty.json")"

# Fixture 6: exactly at the boundary, count 9 (one short) -> fail:9
printf '%s' '{"data":"{\"resultData\":{\"lastNodeExecuted\":\"Verify Tables\",\"runData\":{\"Verify Tables\":[{\"data\":{\"main\":[[{\"json\":{\"present_count\":9}}]]}}]}}}"}' > "$TMP/nine.json"
assert "count-9-goes-RED" "fail:9" "$(_db_verdict "$TMP/nine.json")"

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "db-verify-gate-test: ALL PASS (RED triggers on a real table shortfall; inconclusive never false-REDs)"
else
  echo "db-verify-gate-test: $fails assertion(s) FAILED" >&2
  exit 1
fi
