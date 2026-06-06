#!/usr/bin/env bash
# fulfill-system-request.sh — the privileged broker-side action of the system
# resource-request channel (Stage 2). Run ONLY by fulfill-system-request.yml,
# authenticated as the broker SA via WIF, AFTER scripts/validate-system-request.sh
# has allowed the request AND after Or approved it on Telegram.
#
# It performs exactly one of:
#   * secret : create a new Secret Manager secret SHELL in the system's project
#              + grant secretAccessor to the system's runtime-sa + deploy-sa.
#              (The system fills the value itself afterwards — it already holds
#              secretVersionManager. This script NEVER reads or writes a value.)
#   * iam    : grant one allowlisted, non-escalating PROJECT role to the system's
#              own deploy-sa + runtime-sa.
#
# Idempotent: re-running is a no-op (describe-guard on create; add-iam-policy-binding
# is set semantics). Defense-in-depth: re-asserts the control-project / sandbox
# refusal even though the gate already ran.
#
# Inputs (environment variables):
#   REQUEST_TYPE   secret | iam                                   (required)
#   GCP_PROJECT    the system's own GCP project id                (required)
#   SECRET_NAME    secret id to create        (required for type=secret)
#   ROLE           roles/... to grant         (required for type=iam)
#   MEMBERS        comma-separated SA emails  (optional; default = the system's
#                  deploy-sa + runtime-sa in GCP_PROJECT)
#
# Exit: 0 = fulfilled; non-zero = failed (the workflow leaves the request open).

set -euo pipefail

REQUEST_TYPE="${REQUEST_TYPE:-}"
GCP_PROJECT="${GCP_PROJECT:-}"
SECRET_NAME="${SECRET_NAME:-}"
ROLE="${ROLE:-}"
MEMBERS="${MEMBERS:-}"

[ -n "$REQUEST_TYPE" ] || { echo "FAIL: no request_type" >&2; exit 2; }
[ -n "$GCP_PROJECT" ]  || { echo "FAIL: no gcp_project" >&2; exit 2; }

# Hard backstop — never act on a control project or the shared sandbox backend,
# regardless of what the gate did. Mirrors grant-secret-accessor.yml.
case "$GCP_PROJECT" in
  or-factory-master-control|factory-control-9piybr)
    echo "FAIL: refusing to act on a control project" >&2; exit 2 ;;
  factory-test-25)
    echo "FAIL: refusing to act on factory-test-25 (shared sandbox backend)" >&2; exit 2 ;;
esac

DEPLOY_SA="deploy-sa@${GCP_PROJECT}.iam.gserviceaccount.com"
RUNTIME_SA="runtime-sa@${GCP_PROJECT}.iam.gserviceaccount.com"

if [ -n "$MEMBERS" ]; then
  IFS=',' read -ra MEMBER_ARR <<< "$MEMBERS"
else
  MEMBER_ARR=("$DEPLOY_SA" "$RUNTIME_SA")
fi

# add-iam-policy-binding can hit a brief eventual-consistency window after the
# project/SA was created; retry only the known transient classes (~30s), surface
# anything else. Mirrors grant-secret-accessor.yml's _grant.
_grant_secret() {
  local member="$1" i err
  for i in 1 2 3 4 5 6; do
    if err=$(gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
               --project="$GCP_PROJECT" \
               --role="roles/secretmanager.secretAccessor" \
               --member="serviceAccount:${member}" \
               --quiet 2>&1); then
      echo "PASS: granted secretAccessor on $SECRET_NAME to $member"
      return 0
    fi
    if echo "$err" | grep -qE 'PERMISSION_DENIED|does not exist|NOT_FOUND'; then
      echo "INFO: transient on attempt $i for $member; retrying in 5s…" >&2
      sleep 5; continue
    fi
    echo "FAIL: could not grant secretAccessor to $member:" >&2; echo "$err" >&2
    return 1
  done
  echo "FAIL: exhausted retries granting secretAccessor to $member" >&2
  return 1
}

_grant_project_role() {
  local member="$1" i err
  for i in 1 2 3 4 5 6; do
    if err=$(gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
               --role="$ROLE" \
               --member="serviceAccount:${member}" \
               --condition=None \
               --quiet 2>&1); then
      echo "PASS: granted $ROLE on $GCP_PROJECT to $member"
      return 0
    fi
    if echo "$err" | grep -qE 'PERMISSION_DENIED|does not exist|NOT_FOUND'; then
      echo "INFO: transient on attempt $i for $member; retrying in 5s…" >&2
      sleep 5; continue
    fi
    echo "FAIL: could not grant $ROLE to $member:" >&2; echo "$err" >&2
    return 1
  done
  echo "FAIL: exhausted retries granting $ROLE to $member" >&2
  return 1
}

case "$REQUEST_TYPE" in
  secret)
    [ -n "$SECRET_NAME" ] || { echo "FAIL: type=secret but no secret_name" >&2; exit 2; }
    # Create the shell idempotently (broker SA = roles/owner). Never a version.
    if ! gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT" >/dev/null 2>&1; then
      gcloud secrets create "$SECRET_NAME" \
        --project="$GCP_PROJECT" \
        --replication-policy=automatic \
        --labels="managed-by=or-factory-master,system=${GCP_PROJECT},runtime-shell=true,requested=true" \
        --quiet
      echo "PASS: secret shell created: $SECRET_NAME"
    else
      echo "INFO: secret $SECRET_NAME already exists — granting accessor only"
    fi
    for m in "${MEMBER_ARR[@]}"; do
      m="$(echo "$m" | xargs)"; [ -n "$m" ] || continue
      _grant_secret "$m"
    done
    echo "PASS: secret request fulfilled ($SECRET_NAME in $GCP_PROJECT)."
    ;;

  iam)
    [ -n "$ROLE" ] || { echo "FAIL: type=iam but no role" >&2; exit 2; }
    for m in "${MEMBER_ARR[@]}"; do
      m="$(echo "$m" | xargs)"; [ -n "$m" ] || continue
      _grant_project_role "$m"
    done
    echo "PASS: iam request fulfilled ($ROLE in $GCP_PROJECT)."
    ;;

  *)
    echo "FAIL: unknown request_type '$REQUEST_TYPE'" >&2; exit 2 ;;
esac
