#!/usr/bin/env bash
# Copies all generic secrets from or-factory-master-control Secret Manager
# to a new system's Secret Manager.
#
# Usage: bash scripts/copy-generic-secrets.sh <system-name>
#
# Requires: gcloud authenticated as factory-master-broker (via WIF in CI).
# Idempotent: safe to re-run — creates secret shell if not exists, then adds
# version if absent. IAM grants are idempotent (add-iam-policy-binding is
# set semantics on GCP).
set -euo pipefail

SYSTEM_NAME="${1:-}"
[ -n "$SYSTEM_NAME" ] || { echo "Usage: $0 <system-name>" >&2; exit 1; }

# Validate system-name format — same rule the workflow enforces upstream.
[[ "$SYSTEM_NAME" =~ ^[a-z][a-z0-9-]{2,28}[a-z0-9]$ ]] || {
  echo "FAIL: system-name '$SYSTEM_NAME' must match ^[a-z][a-z0-9-]{2,28}[a-z0-9]\$" >&2
  exit 1
}

FACTORY_PROJECT="or-factory-master-control"
SYSTEM_PROJECT="$SYSTEM_NAME"
RUNTIME_SA_EMAIL="runtime-sa@${SYSTEM_PROJECT}.iam.gserviceaccount.com"
DEPLOY_SA_EMAIL="deploy-sa@${SYSTEM_PROJECT}.iam.gserviceaccount.com"

echo "=== Copy Generic Secrets ==="
echo "Factory project : $FACTORY_PROJECT"
echo "System project  : $SYSTEM_PROJECT"
echo "Runtime SA      : $RUNTIME_SA_EMAIL"
echo "Deploy SA       : $DEPLOY_SA_EMAIL"
echo ""

# Super-credentials belong exclusively to or-factory-master-control — never copied.
# Covers the broker App creds plus any management/provisioning/master key (e.g.
# openrouter-management-key, which can mint/revoke inference keys account-wide).
# Pattern-based so future *-management-key / *-provisioning-key / *-master-key
# secrets are excluded without a point fix.
# n8n-telegram-bot-token-test is the durable default for the per-system test bot:
# provision-system.yml reads it directly from control SM and seeds it into the
# test system's n8n-telegram-bot-token, so it must never be bulk-copied here.
# preserved-* are per-system teardown backups staged in control by
# preserve-secret-to-control.yml and re-injected explicitly by
# restore-secret-from-control.yml — never bulk-copy them into every new system.
EXCLUDE="^(factory-master-broker-app-.*|.*-management-key|.*-provisioning-key|.*-master-key|n8n-telegram-bot-token-test|preserved-.*)$"

# Secrets present in factory SM but intentionally NOT copied (shell + IAM only).
# Empty for now — kept as a hook for future policy.
SHELL_ONLY_SECRETS="^$"

mapfile -t GENERIC_SECRETS < <(
  gcloud secrets list \
    --project="$FACTORY_PROJECT" \
    --format="value(name)" \
  | awk -F'/' '{print $NF}' \
  | grep -vE "$EXCLUDE" || true
)

echo "Generic secrets found: ${#GENERIC_SECRETS[@]}"
echo ""

TMP_FILE=$(mktemp /tmp/factory_secret_XXXXXX)
trap 'shred -u "$TMP_FILE" 2>/dev/null || rm -f "$TMP_FILE"' EXIT

COPIED=0
SHELL_ONLY_COUNT=0
SKIPPED=0

for secret in "${GENERIC_SECRETS[@]}"; do
  echo "--- Processing: $secret ---"

  if ! gcloud secrets describe "$secret" --project="$SYSTEM_PROJECT" > /dev/null 2>&1; then
    gcloud secrets create "$secret" \
      --project="$SYSTEM_PROJECT" \
      --replication-policy="automatic" \
      --labels="copied-from-factory=true,managed-by=or-factory-master" \
      --quiet
    echo "PASS: Secret shell created: $secret"
  else
    echo "INFO: $secret already exists in $SYSTEM_PROJECT"
  fi

  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$SYSTEM_PROJECT" \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
    --quiet
  echo "PASS: secretAccessor granted to $RUNTIME_SA_EMAIL on $secret"

  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$SYSTEM_PROJECT" \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --quiet
  echo "PASS: secretAccessor granted to $DEPLOY_SA_EMAIL on $secret"

  if gcloud secrets versions access latest --secret="$secret" --project="$SYSTEM_PROJECT" \
       > /dev/null 2>&1; then
    echo "INFO: $secret already has a version in $SYSTEM_PROJECT — skipping copy"
    SKIPPED=$((SKIPPED + 1))
    echo ""
    continue
  fi

  if [[ $secret =~ $SHELL_ONLY_SECRETS ]]; then
    echo "INFO: $secret is shell-only by policy — no version copied"
    SHELL_ONLY_COUNT=$((SHELL_ONLY_COUNT + 1))
    echo ""
    continue
  fi

  if gcloud secrets versions access latest \
       --secret="$secret" \
       --project="$FACTORY_PROJECT" \
       > "$TMP_FILE" 2>/dev/null; then
    gcloud secrets versions add "$secret" \
      --project="$SYSTEM_PROJECT" \
      --data-file="$TMP_FILE" \
      --quiet
    : > "$TMP_FILE"
    echo "PASS: Version copied: $secret"
    COPIED=$((COPIED + 1))
  else
    echo "INFO: $secret has no version in factory SM — shell created, no version added"
    SHELL_ONLY_COUNT=$((SHELL_ONLY_COUNT + 1))
  fi

  echo ""
done

echo "=== Copy Generic Secrets Complete ==="
echo "Copied with value          : $COPIED"
echo "Shell only (no version)    : $SHELL_ONLY_COUNT"
echo "Already had version (skip) : $SKIPPED"
