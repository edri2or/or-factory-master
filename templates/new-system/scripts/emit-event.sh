#!/usr/bin/env bash
# Single, soft-fail event emitter for the factory observability foundation.
# Fans one OTel-SemConv-shaped event out to up to four destinations, each
# independently soft-fail (a dead destination never fails the caller):
#   - Axiom        : always (durable event store)
#   - Telegram     : severity warning|error|critical
#   - Linear       : severity error|critical OR action_required=true
#   - deploy-events: factory.deploy.* only, to a SYSTEM's own HMAC-signed
#                    /webhook/deploy-events sink (durable Postgres record; Gap A)
# Whatever happens, it prints one structured [event] safety-net line and
# exits 0, so an agent can always reconstruct the event from the GH Actions
# log even if every external call failed.
#
# Usage:
#   emit-event.sh --name=NAME --severity=info|warning|error|critical \
#                 --layer=factory|system --workflow=WF --run-id=RID \
#                 [--system=NAME] [--action-required=true|false] [--body=JSON] \
#                 [--git-sha=SHA] [--environment=ENV] [--exit-code=N] [--components=JSON]
#
# NOTE: set -u and pipefail, but deliberately NOT set -e — every external
# call's exit code is checked explicitly so one failure never aborts the rest.
set -uo pipefail

# Which Secret Manager project to read the destination secrets from. Defaults
# to the control project (factory-side callers). A deployed SYSTEM sets
# EMIT_SM_PROJECT to its own project, where copy-generic-secrets.sh placed
# axiom-api-key / telegram-* / linear-* at provision time.
PROJECT="${EMIT_SM_PROJECT:-or-factory-master-control}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/event-formatter.sh
. "${SCRIPT_DIR}/lib/event-formatter.sh"
# shellcheck source=scripts/lib/linear-issue.sh
. "${SCRIPT_DIR}/lib/linear-issue.sh"

NAME="" SEVERITY="" LAYER="" WORKFLOW="" RUN_ID=""
SYSTEM="" ACTION_REQUIRED="false" BODY="{}"
GIT_SHA="" ENVIRONMENT="" EXIT_CODE="" COMPONENTS="{}"

while [ $# -gt 0 ]; do
  case "$1" in
    --name=*)            NAME="${1#*=}" ;;
    --severity=*)        SEVERITY="${1#*=}" ;;
    --layer=*)           LAYER="${1#*=}" ;;
    --workflow=*)        WORKFLOW="${1#*=}" ;;
    --run-id=*)          RUN_ID="${1#*=}" ;;
    --system=*)          SYSTEM="${1#*=}" ;;
    --action-required=*) ACTION_REQUIRED="${1#*=}" ;;
    --body=*)            BODY="${1#*=}" ;;
    --git-sha=*)         GIT_SHA="${1#*=}" ;;
    --environment=*)     ENVIRONMENT="${1#*=}" ;;
    --exit-code=*)       EXIT_CODE="${1#*=}" ;;
    --components=*)      COMPONENTS="${1#*=}" ;;
    *) echo "[event] action='rejected' reason='unknown-arg:${1%%=*}'"; exit 0 ;;
  esac
  shift
done

# --- Validate (rejected => exit 0, never a hard failure) ---
for pair in "name:${NAME}" "severity:${SEVERITY}" "layer:${LAYER}" "workflow:${WORKFLOW}" "run-id:${RUN_ID}"; do
  if [ -z "${pair#*:}" ]; then
    echo "[event] action='rejected' reason='missing-${pair%%:*}'"; exit 0
  fi
done
case "$SEVERITY" in info|warning|error|critical) ;; *) echo "[event] action='rejected' reason='bad-severity'"; exit 0 ;; esac
case "$LAYER" in factory|system) ;; *) echo "[event] action='rejected' reason='bad-layer'"; exit 0 ;; esac
case "$ACTION_REQUIRED" in true) ACTION_REQUIRED="true" ;; *) ACTION_REQUIRED="false" ;; esac
[ -n "$BODY" ] || BODY="{}"

# --- Read secrets; mask each the instant it lands; a failed read just
#     disables that one destination (never aborts). ---
_read_secret() {  # _read_secret VARNAME secret-name
  local __var="$1" __name="$2" __val
  if __val=$(gcloud secrets versions access latest --secret="$__name" --project="$PROJECT" 2>/dev/null) && [ -n "$__val" ]; then
    echo "::add-mask::${__val}"
    printf -v "$__var" '%s' "$__val"
  else
    printf -v "$__var" '%s' ""
    echo "[event] secret='${__name}' read='failed'"
  fi
}

AXIOM_API_KEY="" ; LINEAR_API_KEY=""
LINEAR_TEAM_ID="" ; TELEGRAM_BOT_TOKEN="" ; TELEGRAM_CHAT_ID=""
_read_secret AXIOM_API_KEY        axiom-api-key
_read_secret LINEAR_API_KEY       linear-api-key
_read_secret LINEAR_TEAM_ID       linear-team-id
# Telegram: prefer THIS system's own bot (n8n-telegram-bot-token); fall back to
# the legacy factory-copied telegram-bot-token only if the system one is absent
# (unification transition — see docs/telegram-bot-detail.md).
_read_secret TELEGRAM_BOT_TOKEN   n8n-telegram-bot-token
[ -n "$TELEGRAM_BOT_TOKEN" ] || _read_secret TELEGRAM_BOT_TOKEN telegram-bot-token
_read_secret TELEGRAM_CHAT_ID     n8n-telegram-chat-id
[ -n "$TELEGRAM_CHAT_ID" ] || _read_secret TELEGRAM_CHAT_ID telegram-chat-id

# --- Build the event document ---
EVENT_JSON=$(format_otel_event "$NAME" "$SEVERITY" "$LAYER" "$WORKFLOW" "$RUN_ID" "$SYSTEM" "$ACTION_REQUIRED" "$BODY") \
  || { echo "[event] action='rejected' reason='formatter'"; exit 0; }

# --- Axiom: always. The factory-events dataset lives on the EU edge deployment
#     (cloud.eu-central-1.aws), so ingest uses the edge host + the
#     /v1/ingest/<dataset> path — verified live (ingested:1). NOT api.eu.axiom.co
#     (403) or api.axiom.co (400 region), and NOT /v1/datasets/<ds>/ingest (404 at
#     the edge). Needs an API token (xaat-); PATs cannot ingest. ---
if [ -n "$AXIOM_API_KEY" ]; then
  axiom_body=$(mktemp)
  axiom_http=$(curl -sS -m 10 -o "$axiom_body" -w '%{http_code}' -X POST \
    "https://eu-central-1.aws.edge.axiom.co/v1/ingest/factory-events" \
    -H "Authorization: Bearer ${AXIOM_API_KEY}" \
    -H "Content-Type: application/json" \
    --data "[${EVENT_JSON}]" 2>/dev/null) || axiom_http="000"
  case "$axiom_http" in
    2*) echo "[event] axiom='ok' http='${axiom_http}'" ;;
    *)
      # Surface Axiom's error body (no secret — the token is in the header) on
      # one truncated line, so a 4xx is diagnosable from the GH Actions log.
      axiom_detail=$(tr -d '\r' < "$axiom_body" | tr '\n' ' ' | cut -c1-300)
      echo "[event] axiom='failed' http='${axiom_http}' detail='${axiom_detail}'"
      ;;
  esac
  rm -f "$axiom_body"
else
  echo "[event] axiom='skipped' reason='no-key'"
fi

# --- Telegram: warning|error|critical ---
case "$SEVERITY" in
  warning|error|critical)
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
      emoji="⚠️"
      case "$SEVERITY" in error) emoji="🚨" ;; critical) emoji="🔥" ;; esac
      msg="${emoji} ${NAME}"$'\n'"System: ${SYSTEM:-control plane}"$'\n'"Workflow: ${WORKFLOW} (run ${RUN_ID})"$'\n'"Severity: ${SEVERITY}"
      tg_http=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
        --data-urlencode "text=${msg}" 2>/dev/null) || tg_http="000"
      case "$tg_http" in
        2*) echo "[event] telegram='ok'" ;;
        *)  echo "[event] telegram='failed' http='${tg_http}'" ;;
      esac
    else
      echo "[event] telegram='skipped' reason='no-secret'"
    fi
    ;;
esac

# --- Linear: error|critical OR action_required ---
if [ "$SEVERITY" = "error" ] || [ "$SEVERITY" = "critical" ] || [ "$ACTION_REQUIRED" = "true" ]; then
  if [ -n "$LINEAR_API_KEY" ] && [ -n "$LINEAR_TEAM_ID" ]; then
    create_or_update_linear_issue "$EVENT_JSON" "$LINEAR_API_KEY" "$LINEAR_TEAM_ID"
  else
    echo "[event] linear='skipped' reason='no-secret'"
  fi
fi

# --- deploy-events sink: durable Postgres record of factory.deploy.* lifecycle
#     events (zero-miss-recording, Gap A). Per-system + HMAC-signed to the SYSTEM's
#     own /webhook/deploy-events (Caddy validates X-Hub-Signature-256) — the durable
#     home the 90-day Actions log otherwise lost. Soft-fail, and ONLY for a deployed
#     SYSTEM emitting a factory.deploy.* event (status = the phase after the prefix). ---
case "$NAME" in
  factory.deploy.*)
    if [ -n "$SYSTEM" ]; then
      DEPLOY_STATUS="${NAME#factory.deploy.}"
      WEBHOOK_HMAC_SECRET=""
      _read_secret WEBHOOK_HMAC_SECRET webhook-hmac-secret
      if [ -n "$WEBHOOK_HMAC_SECRET" ]; then
        de_ec="null"; case "$EXIT_CODE" in ''|*[!0-9]*) de_ec="null" ;; *) de_ec="$EXIT_CODE" ;; esac
        de_comp="$COMPONENTS"; printf '%s' "$de_comp" | jq -e . >/dev/null 2>&1 || de_comp="{}"
        de_payload=$(jq -cn --arg r "$RUN_ID" --arg s "$GIT_SHA" --arg st "$DEPLOY_STATUS" \
          --arg e "$ENVIRONMENT" --argjson ec "$de_ec" --argjson comp "$de_comp" \
          '{run_id:$r,git_sha:$s,status:$st,environment:$e,exit_code:$ec,components:$comp}' 2>/dev/null) || de_payload=""
        if [ -n "$de_payload" ]; then
          de_sig=$(printf '%s' "$de_payload" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
          de_http=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST \
            "https://n8n-${SYSTEM}.or-infra.com/webhook/deploy-events" \
            -H "Content-Type: application/json" \
            -H "X-Hub-Signature-256: sha256=${de_sig}" \
            --data-binary "$de_payload" 2>/dev/null) || de_http="000"
          case "$de_http" in
            2*) echo "[event] deploy_events='ok' http='${de_http}'" ;;
            *)  echo "[event] deploy_events='failed' http='${de_http}'" ;;
          esac
        else
          echo "[event] deploy_events='skipped' reason='payload-build'"
        fi
      else
        echo "[event] deploy_events='skipped' reason='no-hmac-secret'"
      fi
    fi
    ;;
esac

# --- Safety net: always, last, greppable ---
echo "[event] name='${NAME}' severity='${SEVERITY}' layer='${LAYER}' system='${SYSTEM:-_global_}' workflow='${WORKFLOW}' run_id='${RUN_ID}' action_required='${ACTION_REQUIRED}'"
exit 0
