#!/usr/bin/env bash
# Bootstrap the sandbox "toy-key" tester identity on factory-test-25.
#
# Purpose: give a NON-main work branch a minimal, sandbox-only GCP identity so it can
# apply-and-prove a change on a live throwaway test system BEFORE merging ("prove -> merge"),
# WITHOUT ever exposing the powerful broker SA (which stays main-locked) to a branch.
#
# What this creates on factory-test-25 (and NOTHING anywhere else):
#   - sandbox-pool / github-sandbox-provider : a NEW, dedicated WIF pool + OIDC provider.
#       CEL pins the FACTORY repo by immutable owner-id + repo-id, ANY ref (deliberately NOT
#       pinned to main -- that is the whole point of the toy key). The existing main-locked
#       github-pool / github-provider (test_pool) is left byte-for-byte untouched.
#   - sandbox-tester-sa : a NEW service account whose ONLY power is reading the per-test
#       github-app-* secrets (via a conditioned project-level secretAccessor, below). It gets
#       NO owner, NO project/IAM admin, NO Railway/Cloudflare token access.
#   - workloadIdentityUser : binds the sandbox provider's factory-repo principalSet onto
#       sandbox-tester-sa (so the factory repo, on any ref, can impersonate ONLY this SA).
#   - secretmanager.secretAccessor (CONDITIONED) : at project level but restricted by an IAM
#       Condition to secret names starting with "github-app-", so the SA can read ONLY the
#       three per-test App-credential secrets and nothing else (Railway/Cloudflare/management
#       keys are unreachable). A project-level conditioned grant survives the per-provision
#       secret wipe+reseed, which a per-secret binding would not.
#
# Idempotent: re-running repairs/updates each resource to match this script. Reads or prints
# NO secret values.
set -euo pipefail

PROJECT="${1:-factory-test-25}"

# HARD GUARD: this identity is sandbox-only. Refuse to run against anything but the shared
# test backend -- never a control project, never a real system project.
if [ "$PROJECT" != "factory-test-25" ]; then
  echo "FAIL: bootstrap-sandbox-tester targets factory-test-25 only (got: '$PROJECT')" >&2
  exit 1
fi

POOL="sandbox-pool"
PROVIDER="github-sandbox-provider"
SA_ID="sandbox-tester-sa"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
ISSUER="https://token.actions.githubusercontent.com"

# Factory repo identity (immutable): edri2or (owner id) / or-factory-master (repo id).
OWNER_ID="259965754"
REPO_ID="1245681889"
FACTORY_REPO="edri2or/or-factory-master"

ATTR_MAP="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref"
# ANY ref of the factory repo -- branches included. That is the unlock.
ATTR_COND="assertion.repository_owner_id=='${OWNER_ID}' && assertion.repository_id=='${REPO_ID}'"

# Treat ALREADY_EXISTS as success for create-style commands.
_create_ok() {
  local desc="$1"; shift
  local out
  if out=$("$@" 2>&1); then echo "OK: ${desc} created."; return 0; fi
  if printf '%s' "$out" | grep -q "ALREADY_EXISTS"; then
    echo "OK: ${desc} already exists."; return 0
  fi
  printf '%s\n' "$out" >&2
  return 1
}

# Retry a binding that references a JUST-CREATED service account. IAM has eventual
# consistency between SA creation and the SA being visible as a policy member: an
# add-iam-policy-binding can fail with "does not exist" or PERMISSION_DENIED for up
# to ~60s (the documented "SA -> IAM policy member" window in CLAUDE.md). Retry only
# that class; surface anything else immediately.
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
    echo "Retry ${i}/12 for ${desc} (sleeping 10s — SA propagation)..." >&2
    sleep 10
  done
  echo "FAIL: ${desc} still failing after 12 attempts" >&2
  return 1
}

echo "== Bootstrapping sandbox tester identity on ${PROJECT} =="

# 1) Dedicated WIF pool.
_create_ok "pool ${POOL}" \
  gcloud iam workload-identity-pools create "$POOL" \
    --project="$PROJECT" --location=global \
    --display-name="Sandbox tester pool"

# 2) Dedicated OIDC provider (create if missing, then declaratively re-apply mapping+CEL).
_create_ok "provider ${PROVIDER}" \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project="$PROJECT" --location=global \
    --workload-identity-pool="$POOL" \
    --display-name="GitHub sandbox provider" \
    --issuer-uri="$ISSUER" \
    --attribute-mapping="$ATTR_MAP" \
    --attribute-condition="$ATTR_COND"

gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" \
  --project="$PROJECT" --location=global \
  --workload-identity-pool="$POOL" \
  --attribute-mapping="$ATTR_MAP" \
  --attribute-condition="$ATTR_COND"
echo "OK: provider ${PROVIDER} mapping + condition applied (factory repo, any ref)."

# 3) The toy-key service account.
_create_ok "service account ${SA_EMAIL}" \
  gcloud iam service-accounts create "$SA_ID" \
    --project="$PROJECT" \
    --display-name="Sandbox tester (toy key -- factory-test-25 only)"

# 4) Let the factory repo (via the sandbox provider) impersonate ONLY this SA.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${FACTORY_REPO}"
_bind_retry "workloadIdentityUser granted to ${SA_EMAIL} for ${FACTORY_REPO} (any ref)" \
  gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --project="$PROJECT" \
    --role="roles/iam.workloadIdentityUser" \
    --member="$PRINCIPAL" \
    --quiet

# 5) Minimal secret access: ONLY github-app-* secrets, via an IAM Condition. Project-level so
#    it survives the per-provision secret wipe+reseed; conditioned so it can never read the
#    Railway/Cloudflare/management secrets in the same project.
_bind_retry "conditioned secretAccessor (github-app-* only) granted to ${SA_EMAIL}" \
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition="expression=resource.name.startsWith(\"projects/${PROJECT_NUMBER}/secrets/github-app-\"),title=sandbox-github-app-only,description=Toy key may read ONLY github-app-* test secrets" \
    --quiet

echo "== Done. Sandbox tester identity is ready on ${PROJECT}. =="
echo "Provider: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "SA:       ${SA_EMAIL}"
