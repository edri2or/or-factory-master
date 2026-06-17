#!/usr/bin/env bash
# Bootstrap the SHARED agent-repo runtime identity — the "WIF door" that lets a GCP-LESS
# agent-repo (a private Claude-Code repo built by the factory's agent-repo product-type)
# obtain the shared anthropic-api-key at RUN TIME via GitHub OIDC -> WIF -> a minimal
# runtime SA, with NO standing secret in the repo. This is the credential model Or chose
# for the product (devplans/agent-repo-product.md, Stage 1a) — the research's short-lived
# "OIDC/WIF" intent (D6/D9). Twin in spirit of scripts/bootstrap-sandbox-tester.sh.
#
# WHY factory-test-25 (not the control project): the broker SA has secretmanager.admin on
# or-factory-master-control but NOT workloadIdentityPoolAdmin / serviceAccountAdmin /
# projectIamAdmin there, so it cannot create a pool/provider/SA in control. It CAN create
# WIF infra + SAs on factory-test-25 (proven by bootstrap-sandbox-tester.sh, which already
# hosts the sandbox identity there), and it CAN set IAM on a SINGLE control secret
# (secretmanager.admin -> secrets.setIamPolicy). So the SA lives on factory-test-25 and is
# granted secretAccessor on JUST the anthropic-api-key SECRET in control (cross-project,
# per-secret) — minimal exposure, broker-buildable.
#
# Creates (idempotent), on factory-test-25 unless noted:
#   - agent-repo-pool / github-agent-repo-provider : a NEW dedicated WIF pool + OIDC provider.
#       CEL pins the edri2or org (immutable owner-id) AND ref=refs/heads/main (agent-repos
#       run agent-main.yml on main, dispatched by the broker). The broker's own
#       github-pool/github-provider is left untouched.
#   - agent-repo-runtime-sa : a NEW service account whose ONLY power is reading the shared
#       anthropic-api-key secret. NO owner, NO project admin, NO Railway/Cloudflare access.
#   - workloadIdentityUser : per agent-repo, binds the provider's
#       attribute.repository/edri2or/<repo> principalSet onto the SA, so ONLY explicitly
#       bound agent-repos can impersonate it (an unbound org repo gets a useless pool token).
#   - secretmanager.secretAccessor on or-factory-master-control's anthropic-api-key SECRET
#       (per-secret, NOT project-level): the SA can read ONLY that one secret in control.
#
# Reads or prints NO secret values.
#
# Usage:
#   bootstrap-agent-repo-identity.sh [wif_project=factory-test-25] [control_project=or-factory-master-control] [bind_repo ...]
#     bind_repo: "owner/repo" or bare "repo" (assumed under edri2or). Optional/repeatable.
set -euo pipefail

WIF_PROJECT="${1:-factory-test-25}"
CONTROL_PROJECT="${2:-or-factory-master-control}"
shift || true
shift || true
BIND_REPOS=("$@")

# HARD GUARDS — build WIF infra ONLY on the shared test backend, touch ONLY the one control
# secret. Refuse anything else so this can never escalate.
if [ "$WIF_PROJECT" != "factory-test-25" ]; then
  echo "FAIL: agent-repo WIF identity is hosted on factory-test-25 only (got: '$WIF_PROJECT')" >&2
  exit 1
fi
if [ "$CONTROL_PROJECT" != "or-factory-master-control" ]; then
  echo "FAIL: the anthropic-api-key secret lives in or-factory-master-control only (got: '$CONTROL_PROJECT')" >&2
  exit 1
fi

POOL="agent-repo-pool"
PROVIDER="github-agent-repo-provider"
SA_ID="agent-repo-runtime-sa"
SA_EMAIL="${SA_ID}@${WIF_PROJECT}.iam.gserviceaccount.com"
ISSUER="https://token.actions.githubusercontent.com"
SECRET_NAME="anthropic-api-key"

# edri2or org id (immutable). Agent-repos run agent-main.yml on main (broker dispatches --ref main).
OWNER_ID="259965754"

ATTR_MAP="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref"
ATTR_COND="assertion.repository_owner_id=='${OWNER_ID}' && assertion.ref=='refs/heads/main'"

# Treat "already exists" as success (idempotent). gcloud phrases it differently per resource:
# WIF pools/providers return ALREADY_EXISTS; service-accounts create returns "... is the
# subject of a conflict ... already exists". Match both, case-insensitive.
_create_ok() {
  local desc="$1"; shift
  local out
  if out=$("$@" 2>&1); then echo "OK: ${desc} created."; return 0; fi
  if printf '%s' "$out" | grep -qiE "ALREADY_EXISTS|already exists|subject of a conflict"; then
    echo "OK: ${desc} already exists."; return 0
  fi
  printf '%s\n' "$out" >&2
  return 1
}

# Retry a binding that references a JUST-CREATED service account. IAM has eventual
# consistency between SA creation and the SA being usable as a policy member: an
# add-iam-policy-binding can fail with "does not exist" or PERMISSION_DENIED for up to ~60s
# (the documented "SA -> IAM policy member" window in CLAUDE.md). Retry only that class.
_bind_retry() {
  local desc="$1"; shift
  local out i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if out=$("$@" 2>&1); then
      printf '%s\n' "$out"
      echo "OK: ${desc}."
      return 0
    fi
    printf '%s\n' "$out" >&2
    if ! printf '%s' "$out" | grep -qE "does not exist|PERMISSION_DENIED"; then
      return 1
    fi
    echo "Retry ${i}/12 for ${desc} (sleeping 10s — IAM propagation)..." >&2
    sleep 10
  done
  echo "FAIL: ${desc} still failing after 12 attempts" >&2
  return 1
}

echo "== Bootstrapping shared agent-repo runtime identity on ${WIF_PROJECT} =="

# 1) Dedicated WIF pool.
_create_ok "pool ${POOL}" \
  gcloud iam workload-identity-pools create "$POOL" \
    --project="$WIF_PROJECT" --location=global \
    --display-name="Agent-repo runtime pool"

# 2) Dedicated OIDC provider (create if missing, then declaratively re-apply mapping+CEL).
_create_ok "provider ${PROVIDER}" \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project="$WIF_PROJECT" --location=global \
    --workload-identity-pool="$POOL" \
    --display-name="GitHub agent-repo provider" \
    --issuer-uri="$ISSUER" \
    --attribute-mapping="$ATTR_MAP" \
    --attribute-condition="$ATTR_COND"

gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" \
  --project="$WIF_PROJECT" --location=global \
  --workload-identity-pool="$POOL" \
  --attribute-mapping="$ATTR_MAP" \
  --attribute-condition="$ATTR_COND"
echo "OK: provider ${PROVIDER} mapping + condition applied (edri2or org, main only)."

# 3) The minimal runtime service account.
_create_ok "service account ${SA_EMAIL}" \
  gcloud iam service-accounts create "$SA_ID" \
    --project="$WIF_PROJECT" \
    --display-name="Agent-repo runtime (reads anthropic-api-key only)"

# 4) Per-repo workloadIdentityUser: bind ONLY the explicitly-listed agent-repos onto the SA.
PROJECT_NUMBER=$(gcloud projects describe "$WIF_PROJECT" --format="value(projectNumber)")
if [ "${#BIND_REPOS[@]}" -eq 0 ]; then
  echo "INFO: no bind_repos passed — pool/provider/SA ready, but no repo can impersonate the SA yet."
fi
for repo in "${BIND_REPOS[@]}"; do
  [ -n "$repo" ] || continue
  case "$repo" in */*) full="$repo" ;; *) full="edri2or/${repo}" ;; esac
  PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${full}"
  _bind_retry "workloadIdentityUser granted to ${SA_EMAIL} for ${full} (main)" \
    gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
      --project="$WIF_PROJECT" \
      --role="roles/iam.workloadIdentityUser" \
      --member="$PRINCIPAL" \
      --quiet
done

# 5) Cross-project per-secret read: ONLY control's anthropic-api-key (within the broker's
#    secretmanager.admin on control). The SA lives in factory-test-25; the member is global.
_bind_retry "secretAccessor on ${CONTROL_PROJECT}/${SECRET_NAME} granted to ${SA_EMAIL}" \
  gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --project="$CONTROL_PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet

echo "== Done. Shared agent-repo runtime identity is ready. =="
echo "Provider: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "SA:       ${SA_EMAIL}"
echo "Secret:   ${CONTROL_PROJECT}/${SECRET_NAME} (read-only, this SA)"
