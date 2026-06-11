#!/usr/bin/env bash
# e2e-verify-inbound.sh — drive a REAL message through the system's inbound path
# (Telegram webhook -> Caddy -> tg-inbound -> agent-router) and assert on the
# ACTUAL reply. This is the behavioral proof the E2E verification gate requires:
# config logs and `tools/list` do NOT prove the bot answers; sending a message
# and reading the reply does. It is what catches a "silent tool death".
#
# This script is generic and secret-agnostic: the CALLER (e2e-verify.yml) sources
# the secrets from Secret Manager via WIF and passes them in env. The script never
# reads SM and never prints secret values.
#
# Required env:
#   N8N_DOMAIN            e.g. n8n-or-edri-4.or-infra.com   (or set SYSTEM_NAME)
#   N8N_WEBHOOK_SECRET    value of n8n-telegram-webhook-secret (X-Telegram-Bot-Api-Secret-Token)
#   N8N_CHAT_ID           value of n8n-telegram-chat-id (the operator chat the bot answers)
#   N8N_API_KEY           value of n8n-api-key (n8n Public API)
# Optional env:
#   SYSTEM_NAME           used to derive N8N_DOMAIN as n8n-<SYSTEM_NAME>.or-infra.com
#   PROBE_TEXT            the probe question (default: a tool-exercising system-info ask)
#   EXPECT_SUBSTR         if set, the reply MUST contain this substring (stronger assert)
#   POLL_TIMEOUT_S        seconds to wait for the execution to finish (default 120)
#   POLL_INTERVAL_S       seconds between polls (default 6)
#   TGINBOUND_WF_NAME     tg-inbound workflow name (default "factory-master: tg-inbound")
#   E2E_RESULT_FILE       if set, the JSON result is also written here
#
# Output: a JSON result object on stdout. Exit 0 = behavioral PASS, 1 = FAIL.
set -euo pipefail

fail() { echo "E2E-FAIL: $*" >&2; }

# --- 0. Resolve inputs -------------------------------------------------------
: "${N8N_WEBHOOK_SECRET:?N8N_WEBHOOK_SECRET is required}"
: "${N8N_CHAT_ID:?N8N_CHAT_ID is required}"
: "${N8N_API_KEY:?N8N_API_KEY is required}"

if [ -z "${N8N_DOMAIN:-}" ]; then
  if [ -n "${SYSTEM_NAME:-}" ]; then
    N8N_DOMAIN="n8n-${SYSTEM_NAME}.or-infra.com"
  else
    echo "E2E-FAIL: set N8N_DOMAIN or SYSTEM_NAME" >&2; exit 2
  fi
fi

PROBE_TEXT="${PROBE_TEXT:-מה שם המערכת שלי? (system name)}"
POLL_TIMEOUT_S="${POLL_TIMEOUT_S:-120}"
POLL_INTERVAL_S="${POLL_INTERVAL_S:-6}"
TGINBOUND_WF_NAME="${TGINBOUND_WF_NAME:-factory-master: tg-inbound}"

BASE="https://${N8N_DOMAIN}"
API="${BASE}/api/v1"

# A unique correlation nonce + update_id so we can find OUR execution and so the
# dedup guard (tg_updates_seen) never drops us as a repeat.
NONCE="e2e-$(date -u +%Y%m%d%H%M%S)-${RANDOM}"
UPDATE_ID="$(date -u +%s)${RANDOM}"
FULL_PROBE="[${NONCE}] ${PROBE_TEXT}"

echo "E2E: domain=${N8N_DOMAIN} nonce=${NONCE} update_id=${UPDATE_ID}" >&2

# --- 1. POST a synthetic Telegram update to the REAL inbound webhook ----------
# Shape mirrors what Telegram delivers; tg-inbound's Webhook node reads .body and
# its Extract&Normalize filters on message.chat.id == @@CHAT_ID@@.
UPDATE_JSON=$(jq -cn \
  --argjson uid "${UPDATE_ID}" \
  --arg chat "${N8N_CHAT_ID}" \
  --arg text "${FULL_PROBE}" \
  --argjson now "$(date -u +%s)" \
  '{
     update_id: $uid,
     message: {
       message_id: $uid,
       date: $now,
       text: $text,
       chat: { id: ($chat|tonumber? // $chat), type: "private" },
       from: { id: ($chat|tonumber? // $chat), is_bot: false, first_name: "e2e" }
     }
   }')

POST_HTTP=$(curl -sS -o /tmp/e2e-inbound-resp.txt -w '%{http_code}' \
  -X POST "${BASE}/webhook/telegram-in/inbound" \
  -H 'Content-Type: application/json' \
  -H "X-Telegram-Bot-Api-Secret-Token: ${N8N_WEBHOOK_SECRET}" \
  --data-binary "${UPDATE_JSON}" || echo "000")

if [ "${POST_HTTP}" != "200" ] && [ "${POST_HTTP}" != "201" ] && [ "${POST_HTTP}" != "204" ]; then
  fail "inbound webhook POST returned HTTP ${POST_HTTP} (expected 2xx). A 401 means the Caddy/Telegram secret header was rejected; a 404 means tg-inbound is not active."
  exit 1
fi
echo "E2E: inbound POST accepted (HTTP ${POST_HTTP}) — note onReceived means received, not processed." >&2

# --- 2. Resolve the tg-inbound workflow id (to scope the executions query) ----
WF_LIST=$(curl -sS -H "X-N8N-API-KEY: ${N8N_API_KEY}" "${API}/workflows?limit=200" || echo '{}')
WF_ID=$(echo "${WF_LIST}" | jq -r --arg n "${TGINBOUND_WF_NAME}" \
  '.data[]? | select(.name == $n) | .id' | head -n1)
if [ -z "${WF_ID}" ] || [ "${WF_ID}" = "null" ]; then
  fail "could not find workflow named '${TGINBOUND_WF_NAME}' via the n8n API (is N8N_API_KEY valid / the workflow imported?)."
  exit 1
fi
echo "E2E: tg-inbound workflow id=${WF_ID}" >&2

# --- 3. Poll executions for OUR run (correlate by the nonce in the run data) ---
# n8n 2.x Public API: GET /executions?workflowId=&includeData=true returns runData
# with each node's output. We find the execution whose serialized data contains
# our unique nonce, then read its finished/status and the agent reply.
deadline=$(( $(date +%s) + POLL_TIMEOUT_S ))
EXEC_JSON=""
EXEC_ID=""
while [ "$(date +%s)" -lt "${deadline}" ]; do
  EXECS=$(curl -sS -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    "${API}/executions?workflowId=${WF_ID}&includeData=true&limit=20" || echo '{}')
  # Pick the execution whose data mentions our nonce.
  EXEC_ID=$(echo "${EXECS}" | jq -r --arg nonce "${NONCE}" \
    '[.data[]? | select((.data|tostring) | contains($nonce))] | .[0].id // empty')
  if [ -n "${EXEC_ID}" ]; then
    EXEC_JSON=$(echo "${EXECS}" | jq -c --arg id "${EXEC_ID}" '.data[]? | select((.id|tostring)==$id)')
    FIN=$(echo "${EXEC_JSON}" | jq -r '.finished // false')
    if [ "${FIN}" = "true" ]; then
      break
    fi
  fi
  sleep "${POLL_INTERVAL_S}"
done

if [ -z "${EXEC_ID}" ]; then
  fail "no tg-inbound execution carrying our nonce appeared within ${POLL_TIMEOUT_S}s. The message was accepted at the edge but never processed (chat-id filter dropped it, dedup, or tg-inbound errored before producing run data)."
  exit 1
fi

# --- 4. Assert on REAL behavior ----------------------------------------------
STATUS=$(echo "${EXEC_JSON}" | jq -r '.status // "unknown"')
FINISHED=$(echo "${EXEC_JSON}" | jq -r '.finished // false')

# Collect node-level errors (the silent-failure catch). Any node that errored
# leaves an `.error` object in runData[node][run].
ERRORED_NODES=$(echo "${EXEC_JSON}" | jq -r '
  (.data.resultData.runData // {}) | to_entries[]
  | select((.value[]? | has("error")))
  | .key' 2>/dev/null | paste -sd, - || true)

# Extract a reply string from the agent path. Defensive: try the known reply
# carriers (agent-router HTTP response, an AI Agent "output", a Telegram
# sendMessage "text"), then fall back to any reply/answer/text/output string in
# the run data. The EXACT carrier name is confirmed on the live system (Stage 6).
REPLY=$(echo "${EXEC_JSON}" | jq -r '
  def strings_of(x): [x | .. | strings];
  (.data.resultData.runData // {}) as $rd
  | ( [ $rd | to_entries[]
        | .value[]?.data.main[]?[]?.json
        | (.reply? // .text? // .output? // .answer? // .message?)
        | select(type=="string" and (.|length>0)) ] ) as $cands
  | ($cands | map(select((ascii_downcase|test("error|❌|failed|exception"))|not))) as $clean
  | ( ($clean[-1] // $cands[-1]) // "" )' 2>/dev/null || echo "")

REPLY_TRIM=$(printf '%s' "${REPLY}" | tr '\n' ' ' | sed 's/  */ /g')
REPLY_EXCERPT=$(printf '%s' "${REPLY_TRIM}" | cut -c1-240)

ok=1
reasons=""
if [ "${FINISHED}" != "true" ]; then ok=0; reasons="${reasons}execution-not-finished;"; fi
if [ "${STATUS}" = "error" ]; then ok=0; reasons="${reasons}execution-status-error;"; fi
if [ -n "${ERRORED_NODES}" ]; then ok=0; reasons="${reasons}errored-nodes(${ERRORED_NODES});"; fi
if [ -z "${REPLY_TRIM}" ]; then ok=0; reasons="${reasons}empty-reply;"; fi
if printf '%s' "${REPLY_TRIM}" | grep -qiE 'error|❌|failed|exception'; then
  ok=0; reasons="${reasons}reply-looks-like-error;"
fi
if [ -n "${EXPECT_SUBSTR:-}" ] && ! printf '%s' "${REPLY_TRIM}" | grep -qF "${EXPECT_SUBSTR}"; then
  ok=0; reasons="${reasons}missing-expected-substr;"
fi

RESULT=$([ "${ok}" -eq 1 ] && echo "pass" || echo "fail")

RESULT_JSON=$(jq -cn \
  --arg system "${SYSTEM_NAME:-${N8N_DOMAIN}}" \
  --arg domain "${N8N_DOMAIN}" \
  --arg result "${RESULT}" \
  --arg exec_id "${EXEC_ID}" \
  --arg status "${STATUS}" \
  --arg nonce "${NONCE}" \
  --arg probe "${FULL_PROBE}" \
  --arg reply "${REPLY_EXCERPT}" \
  --arg errored "${ERRORED_NODES}" \
  --arg reasons "${reasons}" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{result:$result, system:$system, domain:$domain, execution_id:$exec_id,
    execution_status:$status, nonce:$nonce, probe:$probe, reply_excerpt:$reply,
    errored_nodes:$errored, fail_reasons:$reasons, executed_at:$at}')

echo "${RESULT_JSON}"
[ -n "${E2E_RESULT_FILE:-}" ] && printf '%s\n' "${RESULT_JSON}" > "${E2E_RESULT_FILE}"

if [ "${ok}" -eq 1 ]; then
  echo "E2E-PASS: real reply observed via inbound path (exec ${EXEC_ID})." >&2
  exit 0
fi
fail "behavioral assertion failed: ${reasons}"
exit 1
