#!/usr/bin/env bash
# Deletes Secret Manager secrets in a shared TEST project.
#
# Modes:
#   default  — deletes ALL secrets (full wipe; each test run starts clean).
#   --reuse  — targeted delete: keeps secrets labeled copied-from-factory=true
#              (the 40 generic API keys that are identical every test round) and
#              deletes only the test-specific ones (runtime-shell, openrouter-mint,
#              github-app-*). Saves ~160 API calls (~3-5 min) per reuse provision.
#   --adopt  — one-time full wipe of a REAL system's recovered/adopted project.
#
# Usage: bash scripts/clean-project-secrets.sh [--adopt | --reuse] <gcp-project-id>
#
# Requires: gcloud authenticated as factory-master-broker (via WIF in CI).
#
# HARD GUARD: refuses to run against a control project.  Default and --reuse
# modes only accept the test-system patterns (factory-test-*/v2-test-*/or-test-*).
# --adopt allows any non-control project except factory-test-25.
set -euo pipefail

ADOPT=false
REUSE=false
while [[ "${1:-}" = --* ]]; do
  case "${1}" in
    --adopt) ADOPT=true;  shift ;;
    --reuse) REUSE=true;  shift ;;
    *) echo "FAIL: unknown flag '${1}'" >&2; exit 1 ;;
  esac
done

if [ "$ADOPT" = true ] && [ "$REUSE" = true ]; then
  echo "FAIL: --adopt and --reuse are mutually exclusive" >&2; exit 1
fi

PROJECT="${1:-}"
[ -n "$PROJECT" ] || { echo "Usage: $0 [--adopt | --reuse] <gcp-project-id>" >&2; exit 1; }

# Absolute refusal in ALL modes: never wipe a control project's broker creds.
case "$PROJECT" in
  or-factory-master-control|factory-control-9piybr)
    echo "FAIL: refusing to wipe secrets in control project '$PROJECT'" >&2; exit 1 ;;
esac

if [ "$ADOPT" = true ]; then
  # Adopt mode: protect the active shared reuse backend, and require a valid
  # GCP project-id shape — but allow any (non-control) project to be repurposed.
  case "$PROJECT" in
    factory-test-25)
      echo "FAIL: refusing to wipe factory-test-25 (active shared reuse backend)" >&2; exit 1 ;;
  esac
  if ! [[ "$PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
    echo "FAIL: '$PROJECT' is not a valid GCP project id (6-30 chars, ^[a-z][a-z0-9-]{4,28}[a-z0-9]\$)" >&2
    exit 1
  fi
else
  # Default and --reuse: restricted to test project patterns.
  if ! [[ "$PROJECT" =~ ^(factory-test-|v2-test-|or-test-)[a-z0-9-]+$ ]]; then
    echo "FAIL: '$PROJECT' is not an allowed test project (factory-test-*/v2-test-*/or-test-*)" >&2
    exit 1
  fi
fi

echo "=== Clean secrets: $PROJECT ==="

if [ "$REUSE" = true ]; then
  echo "Mode: targeted (reuse) — keeping copied-from-factory secrets intact."
  mapfile -t SECRETS < <(
    gcloud secrets list \
      --project="$PROJECT" \
      --format="value(name)" \
      --filter="NOT labels.copied-from-factory:true" \
    | awk -F'/' '{print $NF}'
  )
else
  echo "Mode: full wipe — deleting all secrets."
  mapfile -t SECRETS < <(
    gcloud secrets list --project="$PROJECT" --format="value(name)" \
    | awk -F'/' '{print $NF}'
  )
fi

echo "Found ${#SECRETS[@]} secret(s) to delete."

DELETED=0
for secret in "${SECRETS[@]}"; do
  [ -n "$secret" ] || continue
  gcloud secrets delete "$secret" --project="$PROJECT" --quiet
  echo "deleted: $secret"
  DELETED=$((DELETED + 1))
done

echo "=== Done: ${DELETED} secret(s) deleted from $PROJECT ==="
