#!/usr/bin/env bash
# Thin wrapper used by a system's deploy-railway-cloudflare.yml to emit a
# factory.deploy.<phase> event via the shipped emit-event.sh, reading the
# system's OWN Secret Manager (EMIT_SM_PROJECT). The logic lives here, not in
# the deploy workflow, because that workflow is near GitHub's 128 KiB per-file
# cap (a workflow over 131072 bytes is silently never registered). Soft-fail:
# never affects the deploy. Reads GCP_PROJECT_ID / SYSTEM_NAME / GITHUB_RUN_ID
# from the environment (the calling step passes the first two).
#
# Usage: emit-deploy.sh started|completed|failed
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${DIR}/emit-event.sh" ] || { echo "[emit-deploy] emit-event.sh not present — skipping"; exit 0; }

case "${1:-}" in
  started)   name="factory.deploy.started";   sev="info";  ar="false" ;;
  completed) name="factory.deploy.completed"; sev="info";  ar="false" ;;
  failed)    name="factory.deploy.failed";    sev="error"; ar="true" ;;
  *) echo "[emit-deploy] unknown phase '${1:-}' — skipping"; exit 0 ;;
esac

EMIT_SM_PROJECT="${GCP_PROJECT_ID:-}" bash "${DIR}/emit-event.sh" \
  --name="$name" --severity="$sev" --layer="system" \
  --workflow="deploy-railway-cloudflare.yml" --run-id="${GITHUB_RUN_ID:-0}" \
  --system="${SYSTEM_NAME:-}" --action-required="$ar" || true
