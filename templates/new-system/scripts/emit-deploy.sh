#!/usr/bin/env bash
# Thin wrapper used by a system's deploy-railway-cloudflare.yml to emit a
# factory.deploy.<phase> event via the shipped emit-event.sh, reading the
# system's OWN Secret Manager (EMIT_SM_PROJECT). The logic lives here, not in
# the deploy workflow, because that workflow is near GitHub's 128 KiB per-file
# cap (a workflow over 131072 bytes is silently never registered). Soft-fail:
# never affects the deploy. Reads GCP_PROJECT_ID / SYSTEM_NAME / GITHUB_RUN_ID
# from the environment (the calling step passes the first two).
#
# Usage: emit-deploy.sh started|completed|failed [exit_code]
#   exit_code (optional) is the deploy job's real exit status, forwarded into the
#   deploy_events record. started/completed default to 0; failed defaults to 1 when
#   the caller does not pass the precise code (the deploy workflow passes "$?").
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${DIR}/emit-event.sh" ] || { echo "[emit-deploy] emit-event.sh not present — skipping"; exit 0; }

case "${1:-}" in
  started)   name="factory.deploy.started";   sev="info";  ar="false"; ec="${2:-0}" ;;
  completed) name="factory.deploy.completed"; sev="info";  ar="false"; ec="${2:-0}" ;;
  failed)    name="factory.deploy.failed";    sev="error"; ar="true";  ec="${2:-1}" ;;
  *) echo "[emit-deploy] unknown phase '${1:-}' — skipping"; exit 0 ;;
esac
# Forward only a clean non-negative integer; otherwise fall back (0 ok / 1 failed).
case "$ec" in ''|*[!0-9]*) [ "${1:-}" = failed ] && ec=1 || ec=0 ;; esac

# On failure, record WHICH step broke (the deploy workflow is too large to instrument
# per-step, and a numeric exit code isn't exposed to an if:failure() handler). Soft-fail:
# if it can't resolve, components falls back to {} and the record still lands.
COMPONENTS_JSON="${DEPLOY_COMPONENTS:-{}}"
if [ "${1:-}" = failed ]; then
  fstep="$(bash "${DIR}/resolve-failed-step.sh" 2>/dev/null || true)"
  if [ -n "$fstep" ]; then
    COMPONENTS_JSON=$(jq -cn --arg s "$fstep" '{failed_step:$s}' 2>/dev/null || printf '{}')
    echo "[emit-deploy] failed_step='${fstep}'"
  fi
fi

EMIT_SM_PROJECT="${GCP_PROJECT_ID:-}" bash "${DIR}/emit-event.sh" \
  --name="$name" --severity="$sev" --layer="system" \
  --workflow="deploy-railway-cloudflare.yml" --run-id="${GITHUB_RUN_ID:-0}" \
  --system="${SYSTEM_NAME:-}" --action-required="$ar" \
  --git-sha="${GITHUB_SHA:-}" --environment="${DEPLOY_ENVIRONMENT:-production}" \
  --exit-code="$ec" --components="$COMPONENTS_JSON" || true
