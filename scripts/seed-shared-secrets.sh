#!/usr/bin/env bash
# Seed shared secret VALUES from a source system's Secret Manager into the factory
# CONTROL Secret Manager (the shared vault that scripts/copy-generic-secrets.sh
# propagates to every newly provisioned system) and, optionally, into named
# EXISTING system projects right now (provisioning does not back-fill already-built
# systems).
#
# Auth: broker SA via WIF (the workflow runs on main). Each value is read into a
# 0600 temp file and is NEVER echoed or logged. Idempotent: a destination that
# already holds an enabled version for a secret is left untouched.
#
# Usage (env-driven, set by .github/workflows/seed-shared-secrets.yml):
#   SOURCE_PROJECT=factory-test-7 \
#   SECRET_NAMES="gmail-oauth-client-id,gmail-oauth-client-secret" \
#   DEST_PROJECTS="factory-test-23" \
#   SEED_CONTROL=true \
#   bash scripts/seed-shared-secrets.sh
set -euo pipefail

CONTROL_PROJECT="or-factory-master-control"
SOURCE_PROJECT="${SOURCE_PROJECT:-}"
SECRET_NAMES="${SECRET_NAMES:-}"
DEST_PROJECTS="${DEST_PROJECTS:-}"
SEED_CONTROL="${SEED_CONTROL:-true}"

[ -n "$SOURCE_PROJECT" ] || { echo "FAIL: SOURCE_PROJECT is required" >&2; exit 1; }
[ -n "$SECRET_NAMES" ] || { echo "FAIL: SECRET_NAMES is required" >&2; exit 1; }

# Guard: the source must be a real system project — never a control project
# (holds the broker's own keys) or the shared sandbox backend.
case "$SOURCE_PROJECT" in
  or-factory-master-control|factory-control-9piybr)
    echo "FAIL: SOURCE_PROJECT must not be a control project" >&2; exit 1 ;;
  factory-test-25)
    echo "FAIL: SOURCE_PROJECT must not be factory-test-25 (shared sandbox backend)" >&2; exit 1 ;;
esac
if ! [[ "$SOURCE_PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
  echo "FAIL: SOURCE_PROJECT '$SOURCE_PROJECT' is not a valid GCP project id (6-30 chars)" >&2
  exit 1
fi

# Build the destination list: the control vault (optional) + named system projects.
DESTS=()
if [ "$SEED_CONTROL" = "true" ]; then
  DESTS+=("$CONTROL_PROJECT")
fi
if [ -n "$DEST_PROJECTS" ]; then
  IFS=',' read -ra DP <<< "$DEST_PROJECTS"
  for p in "${DP[@]}"; do
    p="$(echo "$p" | xargs)"
    [ -z "$p" ] && continue
    case "$p" in
      factory-test-25)
        echo "FAIL: destination must not be factory-test-25 (shared sandbox backend)" >&2; exit 1 ;;
      factory-control-9piybr)
        echo "FAIL: destination must not be the legacy control project" >&2; exit 1 ;;
    esac
    if ! [[ "$p" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
      echo "FAIL: destination '$p' is not a valid GCP project id" >&2; exit 1
    fi
    DESTS+=("$p")
  done
fi
if [ "${#DESTS[@]}" -eq 0 ]; then
  echo "FAIL: no destinations — set SEED_CONTROL=true and/or DEST_PROJECTS" >&2; exit 1
fi

echo "=== Seed Shared Secrets ==="
echo "Source        : $SOURCE_PROJECT"
echo "Destinations  : ${DESTS[*]}"
echo "Secrets       : $SECRET_NAMES"
echo ""

TMP_FILE="$(mktemp)"
chmod 600 "$TMP_FILE"
trap 'shred -u "$TMP_FILE" 2>/dev/null || rm -f "$TMP_FILE"' EXIT

# add-iam-policy-binding can hit a brief eventual-consistency window; retry only
# the known transient classes (~30s), surface anything else immediately.
_grant() {
  local secret="$1" project="$2" member="$3" i err
  for i in 1 2 3 4 5 6; do
    if err=$(gcloud secrets add-iam-policy-binding "$secret" \
               --project="$project" \
               --role="roles/secretmanager.secretAccessor" \
               --member="serviceAccount:${member}" \
               --quiet 2>&1); then
      echo "PASS: secretAccessor on $secret granted to $member in $project"
      return 0
    fi
    if echo "$err" | grep -qE 'PERMISSION_DENIED|does not exist|NOT_FOUND'; then
      echo "INFO: transient on attempt $i granting $member; retrying in 5s…" >&2
      sleep 5
      continue
    fi
    echo "FAIL: could not grant secretAccessor to $member in $project:" >&2
    echo "$err" >&2
    return 1
  done
  echo "FAIL: exhausted retries granting secretAccessor to $member in $project" >&2
  return 1
}

IFS=',' read -ra NAMES <<< "$SECRET_NAMES"
for raw in "${NAMES[@]}"; do
  SECRET="$(echo "$raw" | xargs)"
  [ -z "$SECRET" ] && continue
  if ! [[ "$SECRET" =~ ^[a-zA-Z0-9_-]{1,255}$ ]]; then
    echo "FAIL: secret name '$SECRET' is not a valid secret id" >&2; exit 1
  fi
  echo "--- $SECRET ---"

  # Read the value from the source — it must have an accessible enabled version.
  if ! gcloud secrets versions access latest \
         --secret="$SECRET" --project="$SOURCE_PROJECT" > "$TMP_FILE" 2>/dev/null; then
    echo "WARN: '$SECRET' has no accessible value in $SOURCE_PROJECT — nothing to seed, skipping" >&2
    : > "$TMP_FILE"
    echo ""
    continue
  fi

  for DEST in "${DESTS[@]}"; do
    # Create the secret shell if absent.
    if ! gcloud secrets describe "$SECRET" --project="$DEST" >/dev/null 2>&1; then
      gcloud secrets create "$SECRET" \
        --project="$DEST" \
        --replication-policy="automatic" \
        --labels="managed-by=or-factory-master,seeded-shared=true" \
        --quiet
      echo "PASS: created secret shell $SECRET in $DEST"
    else
      echo "INFO: $SECRET already exists in $DEST"
    fi

    # Grant the system's runtime + deploy SAs read access (the control vault has
    # no per-system SAs and the broker already reads it, so skip it there).
    if [ "$DEST" != "$CONTROL_PROJECT" ]; then
      _grant "$SECRET" "$DEST" "runtime-sa@${DEST}.iam.gserviceaccount.com"
      _grant "$SECRET" "$DEST" "deploy-sa@${DEST}.iam.gserviceaccount.com"
    fi

    # Idempotent value copy: only add a version if the destination has none.
    if gcloud secrets versions access latest \
         --secret="$SECRET" --project="$DEST" >/dev/null 2>&1; then
      echo "INFO: $SECRET already has a value in $DEST — leaving it as-is"
    else
      gcloud secrets versions add "$SECRET" --project="$DEST" --data-file="$TMP_FILE" --quiet
      echo "PASS: seeded value of $SECRET into $DEST"
    fi
  done

  : > "$TMP_FILE"
  echo ""
done

echo "=== Seed Shared Secrets complete ==="
