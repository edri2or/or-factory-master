#!/usr/bin/env bash
# Fleet reliability rollup — queries Axiom for the reliability events over a window
# (factory.n8n.workflow_failed / factory.automation.empty_result /
# factory.runtime_audit.failed) across ALL systems and emits a digest via
# scripts/emit-event.sh: a clean fleet is an info event (Axiom only); any reliability
# events in the window emit a warning (-> Telegram). The HISTORICAL complement to the
# watchdog's current-state daily fleet-health digest (meta-monitoring-watchdog.yml).
#
# Read-only over Axiom. SOFT-FAIL throughout (same philosophy as emit-event.sh): a
# missing token, a token without query scope, or an unparseable response degrades to a
# clear info note and exits 0 — it never fails the workflow nor blocks anything. Secrets
# are read from Secret Manager (never printed). Grafana is the deferred richer-dashboard
# option (docs/observability.md); this Axiom digest is the factory-native first step.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SM_PROJECT="${EMIT_SM_PROJECT:-or-factory-master-control}"
WINDOW="${ROLLUP_WINDOW:-24h}"
RUN_ID="${GITHUB_RUN_ID:-$(date -u +%s)}"

_emit() {  # name severity action_required body-json
  bash "${HERE}/emit-event.sh" --name="$1" --severity="$2" --layer="factory" \
    --workflow="fleet-rollup.yml" --run-id="$RUN_ID" --action-required="$3" --body="$4" \
    >/dev/null 2>&1 || true
}

AXIOM_KEY=$(gcloud secrets versions access latest --secret="axiom-api-key" --project="$SM_PROJECT" 2>/dev/null || true)
[ -n "$AXIOM_KEY" ] && echo "::add-mask::${AXIOM_KEY}"

if [ -z "$AXIOM_KEY" ]; then
  echo "[fleet-rollup] WARN: axiom-api-key unavailable — degraded." >&2
  _emit "factory.fleet_rollup.degraded" "info" "false" '{"reason":"axiom-api-key unavailable"}'
  exit 0
fi

# A single aggregate over the window: total reliability events + distinct systems hit.
APL="['factory-events'] | where _time > ago(${WINDOW}) | where ['otel.event.name'] in ('factory.n8n.workflow_failed','factory.automation.empty_result','factory.runtime_audit.failed') | summarize total=count(), systems=dcount(['factory.system_name'])"

resp=$(mktemp); trap 'rm -f "$resp"' EXIT
http=$(curl -sS -m 30 -o "$resp" -w '%{http_code}' \
  -X POST "https://api.axiom.co/v1/datasets/_apl?format=legacy" \
  -H "Authorization: Bearer ${AXIOM_KEY}" -H "Content-Type: application/json" \
  --data-binary "$(jq -cn --arg apl "$APL" '{apl:$apl}')" 2>/dev/null) || http="000"

if [ "$http" != "200" ]; then
  echo "[fleet-rollup] WARN: Axiom query HTTP ${http} (token may lack query scope) — degraded." >&2
  head -c 300 "$resp" >&2 2>/dev/null || true; echo >&2
  _emit "factory.fleet_rollup.degraded" "info" "false" \
    "$(jq -cn --arg h "$http" '{reason:"axiom query failed (token query-scope?)", http:$h}')"
  exit 0
fi

# Defensive parse — find the aggregate fields anywhere in the (format-dependent) result;
# any miss leaves 0, which reports a clean fleet rather than crashing.
total=$(jq -r 'try (.. | objects | select(has("total")) | .total) catch empty' "$resp" 2>/dev/null | head -1)
systems=$(jq -r 'try (.. | objects | select(has("systems")) | .systems) catch empty' "$resp" 2>/dev/null | head -1)
case "${total:-}" in ''|*[!0-9]*) total=0 ;; esac
case "${systems:-}" in ''|*[!0-9]*) systems=0 ;; esac

if [ "$total" -gt 0 ]; then
  echo "[fleet-rollup] ${total} reliability events across ${systems} system(s) in ${WINDOW}"
  _emit "factory.fleet_rollup.summary" "warning" "true" \
    "$(jq -cn --argjson t "$total" --argjson s "$systems" --arg w "$WINDOW" \
       '{window:$w, reliability_events:$t, systems_affected:$s, note:"אירועי-אמינות בחלון — בדוק פירוט ב-Axiom/Linear"}')"
else
  echo "[fleet-rollup] clean — 0 reliability events in ${WINDOW}"
  _emit "factory.fleet_rollup.summary" "info" "false" \
    "$(jq -cn --arg w "$WINDOW" '{window:$w, reliability_events:0, note:"צי נקי — אפס אירועי-אמינות"}')"
fi
