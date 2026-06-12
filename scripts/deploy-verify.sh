#!/usr/bin/env bash
# deploy-verify.sh — drive the LIVE Caddy/HMAC security edge and assert it behaves.
# The proof producer for the "deploy-edge" surface (see docs/e2e-enforcement-standard.md).
#
# The deploy provisions a Caddy reverse proxy that, on /webhook/* (except the
# telegram-in/* bypass), verifies an HMAC-SHA256 signature over the request body
# (header `X-Hub-Signature-256: sha256=<hex>`, key = webhook-hmac-secret) and
# per-IP rate-limits — 401 on bad/missing signature, 429 on rate-limit. A /healthz
# 200 only proves the box is up; it does NOT prove the edge is enforcing. This
# driver drives the edge's REAL behavior so a regression that disables the HMAC
# check (200 instead of 401) is caught — the silent-failure analog for the edge.
#
# Secret-agnostic: the caller (deploy-verify.yml) reads webhook-hmac-secret from
# Secret Manager via WIF and passes it in env. Never reads SM, never prints it.
#
# Required env:
#   HMAC_SECRET          value of webhook-hmac-secret
# One of:
#   N8N_DOMAIN           e.g. n8n-or-edri-4.or-infra.com
#   SYSTEM_NAME          -> N8N_DOMAIN = n8n-<SYSTEM_NAME>.or-infra.com
# Optional env:
#   RL_BURST             rate-limit burst to exceed (default 50, the Caddyfile default)
#   E2E_RESULT_FILE      also write the JSON result here
#
# Output: a JSON result on stdout. Exit 0 = edge enforcing correctly, 1 = FAIL.
set -euo pipefail
fail() { echo "EDGE-FAIL: $*" >&2; }

: "${HMAC_SECRET:?HMAC_SECRET (webhook-hmac-secret) is required}"
if [ -z "${N8N_DOMAIN:-}" ]; then
  [ -n "${SYSTEM_NAME:-}" ] || { echo "EDGE-FAIL: set N8N_DOMAIN or SYSTEM_NAME" >&2; exit 2; }
  N8N_DOMAIN="n8n-${SYSTEM_NAME}.or-infra.com"
fi
RL_BURST="${RL_BURST:-50}"
BASE="https://${N8N_DOMAIN}"
# A generic /webhook/* path (NOT telegram-in/*, which is HMAC-exempt). Unique per run.
PROBE="/webhook/e2e-edge-$(date -u +%s)-${RANDOM}"
BODY='{"e2e":"deploy-edge-probe"}'

_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || echo 000; }

echo "EDGE: domain=${N8N_DOMAIN} probe=${PROBE}" >&2

# 1. The box is up (proxied to n8n through Caddy).
HC=$(_code "${BASE}/healthz")
# 2. No signature -> 401 (the security guarantee).
C_NOSIG=$(_code -X POST "${BASE}${PROBE}" -H 'Content-Type: application/json' --data-binary "$BODY")
# 3. Bad/garbage signature -> 401.
C_BADSIG=$(_code -X POST "${BASE}${PROBE}" -H 'Content-Type: application/json' \
  -H 'X-Hub-Signature-256: sha256=deadbeefdeadbeef' --data-binary "$BODY")
# 4. Valid signature -> NOT 401 (the edge lets legitimate signed traffic through;
#    n8n itself may 404 the unknown webhook path — that still proves Caddy passed it).
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | awk '{print $NF}')
C_GOODSIG=$(_code -X POST "${BASE}${PROBE}" -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=${SIG}" --data-binary "$BODY")
# 5. Rate-limit -> at least one 429 inside the burst window. Fire in PARALLEL so
#    we exceed RL_BURST within the (default 10s) window; sequential would age out.
N=$(( RL_BURST + 30 ))
RL_429=$(seq 1 "$N" | xargs -P 25 -I {} \
  curl -sS -o /dev/null -w '%{http_code}\n' --max-time 15 \
    -X POST "${BASE}${PROBE}" -H "X-Hub-Signature-256: sha256=${SIG}" --data-binary "$BODY" 2>/dev/null \
  | grep -c '^429$' || true)

ok=1; reasons=""
[ "$HC" = "200" ]       || { ok=0; reasons="${reasons}healthz=${HC}(want200);"; }
[ "$C_NOSIG" = "401" ]  || { ok=0; reasons="${reasons}no-signature=${C_NOSIG}(want401 — EDGE NOT ENFORCING HMAC);"; }
[ "$C_BADSIG" = "401" ] || { ok=0; reasons="${reasons}bad-signature=${C_BADSIG}(want401);"; }
[ "$C_GOODSIG" != "401" ] || { ok=0; reasons="${reasons}good-signature=401(edge REJECTED a valid signature);"; }
[ "${RL_429:-0}" -ge 1 ] || { ok=0; reasons="${reasons}rate-limit=no-429-in-burst(want >=1);"; }

RESULT=$([ "$ok" -eq 1 ] && echo pass || echo fail)
RESULT_JSON=$(jq -cn \
  --arg system "${SYSTEM_NAME:-${N8N_DOMAIN}}" --arg domain "${N8N_DOMAIN}" \
  --arg result "$RESULT" --arg probe "$PROBE" --arg reasons "$reasons" \
  --argjson hc "${HC:-0}" --argjson nosig "${C_NOSIG:-0}" --argjson badsig "${C_BADSIG:-0}" \
  --argjson goodsig "${C_GOODSIG:-0}" --argjson rl429 "${RL_429:-0}" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{result:$result, system:$system, domain:$domain, probe:$probe,
    checks:{healthz:$hc, no_signature:$nosig, bad_signature:$badsig,
            good_signature:$goodsig, rate_limit_429s:$rl429},
    fail_reasons:$reasons, executed_at:$at}')

echo "$RESULT_JSON"
[ -n "${E2E_RESULT_FILE:-}" ] && printf '%s\n' "$RESULT_JSON" > "$E2E_RESULT_FILE"

if [ "$ok" -eq 1 ]; then
  echo "EDGE-PASS: HMAC edge enforces (no-sig 401, bad-sig 401, valid-sig passed, rate-limit 429)." >&2
  exit 0
fi
fail "edge assertion failed: ${reasons}"
exit 1
