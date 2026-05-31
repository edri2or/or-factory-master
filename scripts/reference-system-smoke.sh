#!/usr/bin/env bash
# End-to-end smoke test for the standing reference system (Layer A of the
# two-layer model). Run it by hand — or from the /dev-stage-factory skill —
# after applying a change to the standing system, to confirm it still works
# top to bottom before the change is promoted to template code.
#
# Endpoints come from reference-system/config.yml (overridable for testing via
# REF_HEALTH_URL / REF_PUBLIC_URL). Until the system is provisioned (Stage 0)
# and with no overrides, it is a clean SKIP — there is nothing live to probe.
#
# Checks (all must pass):
#   1. n8n is alive behind Caddy        — GET  <health_url>            -> 2xx
#   2. n8n UI is served through Caddy    — GET  <public_url>/          -> 200/302
#   3. Caddy's edge HMAC guard is in front of the webhook/router path —
#      POST <public_url>/webhook/<probe> with NO signature            -> 401/429
#
# Exit 0 only if every check passes; exit 1 on any failure.
set -uo pipefail

TIMEOUT="${REF_SMOKE_TIMEOUT:-15}"

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/reference-config.sh"

if [ -z "${REF_HEALTH_URL:-}" ] && [ -z "${REF_PUBLIC_URL:-}" ]; then
  if [ "$(ref_config_get provisioned)" != "true" ]; then
    echo "SKIP: reference system not provisioned yet — nothing to smoke."
    exit 0
  fi
fi

HEALTH_URL="${REF_HEALTH_URL:-$(ref_config_get health_url)}"
PUBLIC_URL="${REF_PUBLIC_URL:-$(ref_config_get public_url)}"
PUBLIC_URL="${PUBLIC_URL%/}"   # normalise: no trailing slash

PASS=0
FAIL=0

# check <name> <url> <method> <acceptable-codes-csv>
check() {
  local name="$1" url="$2" method="$3" want="$4" code
  code=$(curl -sS -m "$TIMEOUT" -o /dev/null -w '%{http_code}' -X "$method" "$url" 2>/dev/null) || true
  code="${code:-000}"
  if printf '%s' "$want" | tr ',' '\n' | grep -qx "$code"; then
    echo "  ✓ ${name}: HTTP ${code} (want ${want})"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${name}: HTTP ${code} (want ${want})" >&2
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke-testing reference system at ${PUBLIC_URL}"
check "n8n health behind Caddy" "${HEALTH_URL}"                "GET"  "200,204"
check "n8n UI via Caddy"        "${PUBLIC_URL}/"               "GET"  "200,302"
check "Caddy webhook HMAC guard" "${PUBLIC_URL}/webhook/smoke-probe" "POST" "401,429"

echo "----"
if [ "$FAIL" -eq 0 ]; then
  echo "PASS: reference system smoke OK (${PASS}/${PASS} checks)."
  exit 0
fi
echo "FAIL: reference system smoke failed (${FAIL} of $((PASS + FAIL)) checks)." >&2
exit 1
