#!/usr/bin/env bash
# Deletes ALL Secret Manager secrets in a shared TEST project, so each test run
# starts from a clean slate (generics are re-copied and runtime shells re-created
# by provision-system.yml right after this runs; the deploy workflow regenerates
# n8n-encryption-key / n8n-owner-password / railway-* on first deploy).
#
# Usage: bash scripts/clean-project-secrets.sh <gcp-project-id>
#
# Requires: gcloud authenticated as factory-master-broker (via WIF in CI).
#
# HARD GUARD: refuses to run against a control project, and only accepts the
# test-system patterns (factory-test-*/v2-test-*/or-test-*). This is the only
# destructive secret operation in the factory — the guard mirrors
# decommission-test-projects.yml so a stray project id can never wipe the
# control project's broker App credentials.
set -euo pipefail

# --adopt: one-time clean of a REAL system's recovered/adopted project (a
# deliberate repurpose, gated upstream by provision-system.yml's adopt mode).
# Allows any non-control project except factory-test-25; the default (no flag)
# stays locked to the test patterns.
ADOPT=false
if [ "${1:-}" = "--adopt" ]; then
  ADOPT=true
  shift
fi

PROJECT="${1:-}"
[ -n "$PROJECT" ] || { echo "Usage: $0 [--adopt] <gcp-project-id>" >&2; exit 1; }

# Absolute refusal in BOTH modes: never wipe a control project's broker creds.
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
  if ! [[ "$PROJECT" =~ ^(factory-test-|v2-test-|or-test-)[a-z0-9-]+$ ]]; then
    echo "FAIL: '$PROJECT' is not an allowed test project (factory-test-*/v2-test-*/or-test-*)" >&2
    exit 1
  fi
fi

echo "=== Clean secrets: $PROJECT ==="

mapfile -t SECRETS < <(
  gcloud secrets list --project="$PROJECT" --format="value(name)" \
  | awk -F'/' '{print $NF}'
)

echo "Found ${#SECRETS[@]} secret(s)."

DELETED=0
for secret in "${SECRETS[@]}"; do
  [ -n "$secret" ] || continue
  gcloud secrets delete "$secret" --project="$PROJECT" --quiet
  echo "deleted: $secret"
  DELETED=$((DELETED + 1))
done

echo "=== Done: ${DELETED} secret(s) deleted from $PROJECT ==="
