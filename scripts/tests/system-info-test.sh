#!/usr/bin/env bash
# B5 proof — the SYSTEM-INFO capabilities reflect REALITY (master-system-integrity).
#
# Proves that the SYSTEM_INFO_JSON builder in templates/system/.github/workflows/
# configure-agent-router.yml emits valid JSON whose `capabilities.live_read_sources`
# lists exactly the tools whose CRED_* gating var is set, and whose
# `capabilities.degraded` lists the absent ones — so the bot never advertises a
# source it doesn't have.
#
# `_build` below is a faithful MIRROR of the builder (the array logic + the jq
# assembly), run under the same `set -euo pipefail` so an unbound-array / set-e
# regression in the workflow shape is caught here. Keep the two in sync.
set -euo pipefail

SYSTEM_NAME="or-edri-4"; N8N_DOMAIN="n8n-or-edri-4.or-infra.com"
PROJECT_ID="factory-test-21"; RUNTIME_DESC="Railway (n8n 2.25.7 + Postgres + Caddy)"

# --- MIRROR of the B5 SYSTEM_INFO_JSON builder -------------------------------
_build() {  # reads CRED_POSTGRES_ID/CRED_GITHUB_JWT_ID/CRED_RAILWAY_ID/CRED_GOOGLE_MCP_ID/OR_DEAD/SKIP_TELEGRAM
  local LIVE_SOURCES DEGRADED_CAPS SRC_JSON DEG_JSON
  LIVE_SOURCES=("n8n workflows + recent executions/errors (n8n Public API)")
  DEGRADED_CAPS=()
  if [ -n "${CRED_POSTGRES_ID:-}" ]; then LIVE_SOURCES+=("Postgres fixed-query set"); else DEGRADED_CAPS+=("postgres memory/style/trace"); fi
  if [ -n "${CRED_GITHUB_JWT_ID:-}" ]; then LIVE_SOURCES+=("GitHub for THIS repo (edri2or/${SYSTEM_NAME})"); else DEGRADED_CAPS+=("github_readonly"); fi
  if [ -n "${CRED_RAILWAY_ID:-}" ]; then LIVE_SOURCES+=("Railway: latest deploy status + recent deployment logs"); else DEGRADED_CAPS+=("railway_readonly"); fi
  [ -n "${CRED_GOOGLE_MCP_ID:-}" ] || DEGRADED_CAPS+=("google_workspace (gmail/calendar/drive/docs)")
  [ -n "${OR_DEAD:-}" ] && DEGRADED_CAPS+=("openrouter LLM — answers may be a fallback")
  [ "${SKIP_TELEGRAM:-}" = "yes" ] && DEGRADED_CAPS+=("telegram chat bot")
  SRC_JSON=$(printf '%s\n' "${LIVE_SOURCES[@]}" | jq -R . | jq -sc . 2>/dev/null || echo '[]')
  DEG_JSON=$(printf '%s\n' "${DEGRADED_CAPS[@]+"${DEGRADED_CAPS[@]}"}" | jq -R 'select(length>0)' | jq -sc . 2>/dev/null || echo '[]')
  jq -cn --arg sys "$SYSTEM_NAME" --arg dom "$N8N_DOMAIN" --arg proj "$PROJECT_ID" \
    --arg rt "$RUNTIME_DESC" --argjson src "$SRC_JSON" --argjson deg "$DEG_JSON" \
    '{system_name:$sys, n8n_domain:$dom, gcp_project_id:$proj, gcp_region:"me-west1", runtime:$rt,
      capabilities:{read_only:false, write:"approved-only", live_read_sources:$src, degraded:$deg, hitl_required_for_writes:true}}' \
    2>/dev/null || echo '{}'
}
# -----------------------------------------------------------------------------

fails=0
assert_has() {  # assert_has <name> <jq-path> <needle-substr> <want present:1/absent:0>
  local name="$1" path="$2" needle="$3" want="$4" got
  got=$(printf '%s' "$JSON" | jq -r "$path | map(select(test(\"$needle\")))|length>0" 2>/dev/null || echo "ERR")
  local present=0; [ "$got" = "true" ] && present=1
  if [ "$present" = "$want" ]; then echo "PASS: $name"; else echo "FAIL: $name (want present=$want, got '$got')" >&2; fails=$((fails+1)); fi
}
assert_valid() { printf '%s' "$JSON" | jq -e . >/dev/null 2>&1 && echo "PASS: $1 valid JSON" || { echo "FAIL: $1 not valid JSON" >&2; fails=$((fails+1)); }; }

# Case 1: everything present -> all 4 sources, degraded empty (the healthy or-edri-4 shape)
CRED_POSTGRES_ID=x CRED_GITHUB_JWT_ID=x CRED_RAILWAY_ID=x CRED_GOOGLE_MCP_ID=x OR_DEAD="" SKIP_TELEGRAM=no
JSON="$(_build)"
assert_valid "all-present"
assert_has "all: github IS a source" ".capabilities.live_read_sources" "GitHub" 1
assert_has "all: railway IS a source" ".capabilities.live_read_sources" "Railway" 1
assert_has "all: degraded is empty" ".capabilities.degraded" "." 0

# Case 2: github + postgres stripped -> NOT in sources, ARE in degraded
CRED_POSTGRES_ID="" CRED_GITHUB_JWT_ID="" CRED_RAILWAY_ID=x CRED_GOOGLE_MCP_ID=x OR_DEAD="" SKIP_TELEGRAM=no
JSON="$(_build)"
assert_valid "github-postgres-stripped"
assert_has "stripped: github NOT a source" ".capabilities.live_read_sources" "GitHub" 0
assert_has "stripped: github IN degraded" ".capabilities.degraded" "github_readonly" 1
assert_has "stripped: postgres IN degraded" ".capabilities.degraded" "postgres" 1
assert_has "stripped: railway still a source" ".capabilities.live_read_sources" "Railway" 1

# Case 3: openrouter dead -> degraded; n8n always a source even when all else off
CRED_POSTGRES_ID="" CRED_GITHUB_JWT_ID="" CRED_RAILWAY_ID="" CRED_GOOGLE_MCP_ID="" OR_DEAD="HTTP 401" SKIP_TELEGRAM=yes
JSON="$(_build)"
assert_valid "all-off"
assert_has "off: n8n still a source" ".capabilities.live_read_sources" "n8n Public API" 1
assert_has "off: openrouter IN degraded" ".capabilities.degraded" "openrouter" 1
assert_has "off: telegram IN degraded" ".capabilities.degraded" "telegram" 1

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "system-info-test: ALL PASS (capabilities reflect the installed tools; no over-claiming)"
else
  echo "system-info-test: $fails assertion(s) FAILED" >&2
  exit 1
fi
