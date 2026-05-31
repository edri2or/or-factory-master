#!/usr/bin/env bash
# One-time setup of the meta-monitoring watchdog's external dead-man's-switch:
# a Better Stack HEARTBEAT monitor. The watchdog pings it every run; if the
# pings stop (watchdog dead / disabled / cron halted), Better Stack alerts via
# its OWN external channel — independent of the factory. The resulting ping URL
# is stored in Secret Manager as `watchdog-heartbeat-url`.
#
# Soft-fail throughout (same philosophy as scripts/create-uptime-monitor.sh):
# never aborts, always exits 0, conveys outcome via one [watchdog-heartbeat]
# stdout line. Idempotent by monitor name — re-running is a no-op that just
# re-reads the existing heartbeat URL.
#
# Run via meta-monitoring-watchdog.yml with input setup_heartbeat=true (it has
# the WIF auth + gcloud the secret read/write needs).
set -uo pipefail

PROJECT="${BS_SM_PROJECT:-or-factory-master-control}"
SECRET_NAME="${BS_SECRET_NAME:-better-stack-api-key}"
URL_SECRET="${HEARTBEAT_URL_SECRET:-watchdog-heartbeat-url}"
HB_NAME="${HEARTBEAT_NAME:-factory-meta-monitoring-watchdog}"
API="https://uptime.betterstack.com/api/v2/heartbeats"
PERIOD="${HEARTBEAT_PERIOD:-86400}"   # expect a ping at least daily
GRACE="${HEARTBEAT_GRACE:-14400}"     # 4h slack for cron jitter + retries

BS_TOKEN=""
if BS_TOKEN=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT" 2>/dev/null) && [ -n "$BS_TOKEN" ]; then
  echo "::add-mask::${BS_TOKEN}"
else
  echo "[watchdog-heartbeat] action='skipped' reason='no-better-stack-token'"
  exit 0
fi

# Idempotency: look for an existing heartbeat with our name.
list_body=$(mktemp)
http=$(curl -sS -m 15 -o "$list_body" -w '%{http_code}' \
  -H "Authorization: Bearer ${BS_TOKEN}" \
  "${API}?per_page=50" 2>/dev/null) || http="000"

HB_URL=""
case "$http" in
  2*)
    HB_URL=$(jq -r --arg n "$HB_NAME" 'first(.data[]? | select(.attributes.name == $n) | .attributes.url) // empty' "$list_body" 2>/dev/null) || HB_URL=""
    ;;
  *)
    detail=$(tr -d '\r' < "$list_body" | tr '\n' ' ' | cut -c1-300)
    echo "[watchdog-heartbeat] action='failed' stage='list' http='${http}' detail='${detail}'"
    rm -f "$list_body"
    exit 0
    ;;
esac
rm -f "$list_body"

if [ -z "$HB_URL" ]; then
  # Create the heartbeat.
  body=$(jq -cn --arg name "$HB_NAME" --argjson period "$PERIOD" --argjson grace "$GRACE" \
    '{name:$name, period:$period, grace:$grace, email:true, sms:false, call:false, push:false}')
  create_body=$(mktemp)
  http=$(curl -sS -m 15 -o "$create_body" -w '%{http_code}' -X POST \
    -H "Authorization: Bearer ${BS_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$body" \
    "$API" 2>/dev/null) || http="000"
  case "$http" in
    2*) HB_URL=$(jq -r '.data.attributes.url // empty' "$create_body" 2>/dev/null) || HB_URL="" ;;
    *)
      detail=$(tr -d '\r' < "$create_body" | tr '\n' ' ' | cut -c1-300)
      echo "[watchdog-heartbeat] action='failed' stage='create' http='${http}' detail='${detail}'"
      rm -f "$create_body"
      exit 0
      ;;
  esac
  rm -f "$create_body"
  CREATED="created"
else
  CREATED="already_exists"
fi

[ -n "$HB_URL" ] || { echo "[watchdog-heartbeat] action='failed' reason='no-url-returned'"; exit 0; }
echo "::add-mask::${HB_URL}"

# Store the URL in Secret Manager (create or add a new version).
if gcloud secrets describe "$URL_SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  if printf '%s' "$HB_URL" | gcloud secrets versions add "$URL_SECRET" --project="$PROJECT" --data-file=- >/dev/null 2>&1; then
    SM="version_added"
  else
    SM="sm_write_failed"
  fi
elif printf '%s' "$HB_URL" | gcloud secrets create "$URL_SECRET" --project="$PROJECT" --replication-policy="automatic" --data-file=- >/dev/null 2>&1; then
  SM="secret_created"
else
  SM="sm_write_failed"
fi

echo "[watchdog-heartbeat] action='${CREATED}' secret='${URL_SECRET}' sm='${SM}'"
exit 0
