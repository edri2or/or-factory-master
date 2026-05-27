#!/usr/bin/env bash
# Creates a Better Stack uptime monitor for a newly-provisioned system.
# Soft-fail throughout (same philosophy as scripts/emit-event.sh): never aborts,
# always exits 0, and conveys its outcome via one structured [uptime-monitor]
# stdout line. The parent workflow's factory.provision.completed emit captures
# the resulting state.
#
# Usage:
#   bash scripts/create-uptime-monitor.sh \
#     --system="factory-test-26" \
#     --url="https://n8n-factory-test-26.or-infra.com/healthz"
set -uo pipefail

PROJECT="${BS_SM_PROJECT:-or-factory-master-control}"
SECRET_NAME="${BS_SECRET_NAME:-better-stack-api-key}"
API="https://uptime.betterstack.com/api/v2/monitors"
FREE_TIER_CAP=10

SYSTEM="" URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --system=*) SYSTEM="${1#*=}" ;;
    --url=*)    URL="${1#*=}" ;;
    *) echo "[uptime-monitor] action='rejected' reason='unknown-arg:${1%%=*}'"; exit 0 ;;
  esac
  shift
done

[ -n "$SYSTEM" ] || { echo "[uptime-monitor] action='rejected' reason='missing-system'"; exit 0; }
[ -n "$URL" ]    || { echo "[uptime-monitor] action='rejected' reason='missing-url'"; exit 0; }

# Read the Better Stack token; mask the instant it lands. A failed read just
# skips this system (never aborts the provision).
BS_TOKEN=""
if BS_TOKEN=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT" 2>/dev/null) && [ -n "$BS_TOKEN" ]; then
  echo "::add-mask::${BS_TOKEN}"
else
  echo "[uptime-monitor] action='skipped' reason='no-token'"
  exit 0
fi

# Idempotency: the Uptime API filters list_monitors by ?url=. If a monitor for
# this exact URL already exists, do nothing — a re-provision / re-run is a no-op.
url_enc=$(jq -rn --arg u "$URL" '$u|@uri' 2>/dev/null) || url_enc=""
list_body=$(mktemp)
http=$(curl -sS -m 15 -o "$list_body" -w '%{http_code}' \
  -H "Authorization: Bearer ${BS_TOKEN}" \
  "${API}?url=${url_enc}" 2>/dev/null) || http="000"

case "$http" in
  2*)
    existing_id=$(jq -r --arg u "$URL" 'first(.data[]? | select(.attributes.url == $u) | .id) // empty' "$list_body" 2>/dev/null) || existing_id=""
    if [ -n "$existing_id" ]; then
      echo "[uptime-monitor] action='already_exists' system='${SYSTEM}' monitor_id='${existing_id}'"
      rm -f "$list_body"
      exit 0
    fi
    ;;
  *)
    detail=$(tr -d '\r' < "$list_body" | tr '\n' ' ' | cut -c1-300)
    echo "[uptime-monitor] action='failed' system='${SYSTEM}' http='${http}' detail='${detail}'"
    rm -f "$list_body"
    exit 0
    ;;
esac
rm -f "$list_body"

# Free-tier cap: the Better Stack free plan allows 10 monitors. Count existing
# ones; if we're at/over the cap, skip gracefully rather than POST a guaranteed
# 4xx. A next-page link means there are already more than one page — past the cap.
count_body=$(mktemp)
http=$(curl -sS -m 15 -o "$count_body" -w '%{http_code}' \
  -H "Authorization: Bearer ${BS_TOKEN}" \
  "${API}?per_page=50" 2>/dev/null) || http="000"

monitor_count=0
case "$http" in
  2*)
    monitor_count=$(jq -r '.data | length' "$count_body" 2>/dev/null) || monitor_count=0
    [[ "$monitor_count" =~ ^[0-9]+$ ]] || monitor_count=0
    has_next=$(jq -r '.pagination.next // empty' "$count_body" 2>/dev/null) || has_next=""
    [ -n "$has_next" ] && monitor_count=$FREE_TIER_CAP
    ;;
esac
rm -f "$count_body"

if [ "$monitor_count" -ge "$FREE_TIER_CAP" ]; then
  echo "[uptime-monitor] action='skipped' reason='free_tier_cap' existing_count='${monitor_count}'"
  exit 0
fi

# Create the monitor: HTTP-status check (2xx from /healthz = healthy), 30s
# frequency (free-tier minimum), email-only alerts. Telegram/SMS stay on the
# 6h system-runtime-audit.yml layer; email is the sub-minute layer above it.
body=$(jq -cn --arg url "$URL" --arg name "n8n-${SYSTEM}" \
  '{monitor_type:"status", url:$url, pronounceable_name:$name, check_frequency:30, request_timeout:15, recovery_period:0, email:true, sms:false, call:false, push:false}')

create_body=$(mktemp)
http=$(curl -sS -m 15 -o "$create_body" -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${BS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$body" \
  "$API" 2>/dev/null) || http="000"

case "$http" in
  2*)
    monitor_id=$(jq -r '.data.id // empty' "$create_body" 2>/dev/null) || monitor_id=""
    echo "[uptime-monitor] action='created' system='${SYSTEM}' monitor_id='${monitor_id}'"
    ;;
  *)
    detail=$(tr -d '\r' < "$create_body" | tr '\n' ' ' | cut -c1-300)
    echo "[uptime-monitor] action='failed' system='${SYSTEM}' http='${http}' detail='${detail}'"
    ;;
esac
rm -f "$create_body"

exit 0
