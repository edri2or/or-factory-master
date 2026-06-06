#!/usr/bin/env bash
# validate-system-request.sh — deterministic gate for a system → broker
# resource-request (Stage 1 of the system resource-request channel).
#
# A provisioned system can RAISE a request (via scripts/emit-event.sh →
# a Linear ticket); the MCP triage dispatches the broker-side fulfillment
# workflow. THIS script — run by that workflow BEFORE it sends the Telegram
# approval card AND again BEFORE it applies anything — decides whether the
# request is legitimate enough to act on. It is pure (no network, no cloud,
# no gcloud), so it is fully unit-testable and identical in both phases.
#
# It enforces ALL of the following; any failure exits non-zero = REFUSE:
#   * request_type is one of the supported types (secret | iam)
#   * the target GCP project is a real per-system project — never a control
#     project and never the shared sandbox backend (factory-test-25)
#   * system_name + gcp_project match the factory's id shape
#   * secret type: secret name is a safe id AND not a super-credential
#     (mirrors the EXCLUDE set in scripts/copy-generic-secrets.sh) and carries
#     no privileged substring; the role is always secretAccessor
#   * iam type: the role is on a curated, non-escalating allowlist
#     (default-deny) — owner/editor/iam.*/admin/serviceusage.* are hard-refused
#   * members (the grant targets) are ONLY the system's own deploy-sa +
#     runtime-sa in that project — never an external or cross-project SA
#
# The broker side (NOT this script) is responsible for resolving GCP_PROJECT
# authoritatively from the system repo's GCP_PROJECT_ID variable, so a
# self-asserted project in the request body cannot target another system.
#
# Inputs (environment variables):
#   REQUEST_TYPE   secret | iam                                   (required)
#   SYSTEM_NAME    the system repo name                           (required)
#   GCP_PROJECT    the system's own GCP project id                (required)
#   SECRET_NAME    secret id to create        (required for type=secret)
#   ROLE           roles/... to grant         (required for type=iam)
#   MEMBERS        comma-separated SA emails  (optional; default = the
#                  system's deploy-sa + runtime-sa in GCP_PROJECT)
#
# Prints: one "VERDICT: allow ..." or "VERDICT: refuse — <reason>" line.
# Exit:   0 = allow; 1 = refuse; 2 = internal/usage error.

set -uo pipefail

# Curated allowlist of non-escalating, own-project IAM roles a system may
# request on its OWN runtime-sa/deploy-sa. Default-deny: anything not listed
# is refused. Expanding this list is a gated change (PR + Or review).
ALLOWED_IAM_ROLES="
roles/cloudsql.client
roles/pubsub.publisher
roles/pubsub.subscriber
roles/storage.objectViewer
roles/storage.objectAdmin
roles/aiplatform.user
roles/datastore.user
roles/cloudtasks.enqueuer
"

# Id shape shared by GCP project ids and system (repo) names: 6-30 chars,
# lowercase alnum + hyphen, no leading/trailing hyphen.
ID_RE='^[a-z][a-z0-9-]{4,28}[a-z0-9]$'

REQUEST_TYPE="${REQUEST_TYPE:-}"
SYSTEM_NAME="${SYSTEM_NAME:-}"
GCP_PROJECT="${GCP_PROJECT:-}"
SECRET_NAME="${SECRET_NAME:-}"
ROLE="${ROLE:-}"
MEMBERS="${MEMBERS:-}"

refuse() { echo "VERDICT: refuse — $1"; exit 1; }

# --- common validation --------------------------------------------------------

[ -n "$REQUEST_TYPE" ] || refuse "no request_type"
[ -n "$SYSTEM_NAME" ]  || refuse "no system_name"
[ -n "$GCP_PROJECT" ]  || refuse "no gcp_project"

# Never touch a control project (holds the broker's own keys) or the shared
# sandbox backend (its IAM is deliberately minimal). Mirrors the guard in
# .github/workflows/grant-secret-accessor.yml.
case "$GCP_PROJECT" in
  or-factory-master-control|factory-control-9piybr)
    refuse "gcp_project is a control project" ;;
  factory-test-25)
    refuse "gcp_project is factory-test-25 (shared sandbox backend)" ;;
esac

[[ "$GCP_PROJECT" =~ $ID_RE ]] || refuse "gcp_project '$GCP_PROJECT' is not a valid project id (6-30 chars)"
[[ "$SYSTEM_NAME" =~ $ID_RE ]] || refuse "system_name '$SYSTEM_NAME' is not a valid system name (6-30 chars)"

# Members default to the system's own two SAs; if supplied, every entry must be
# exactly one of those two — never an external or cross-project service account.
DEPLOY_SA="deploy-sa@${GCP_PROJECT}.iam.gserviceaccount.com"
RUNTIME_SA="runtime-sa@${GCP_PROJECT}.iam.gserviceaccount.com"
if [ -n "$MEMBERS" ]; then
  IFS=',' read -ra _members <<< "$MEMBERS"
  for m in "${_members[@]}"; do
    m="$(echo "$m" | xargs)"   # trim surrounding whitespace
    [ -n "$m" ] || continue
    if [ "$m" != "$DEPLOY_SA" ] && [ "$m" != "$RUNTIME_SA" ]; then
      refuse "member '$m' is not the system's own deploy-sa/runtime-sa in $GCP_PROJECT"
    fi
  done
fi

# --- per-type validation ------------------------------------------------------

case "$REQUEST_TYPE" in
  secret)
    [ -n "$SECRET_NAME" ] || refuse "type=secret but no secret_name"
    # Safe secret id: lowercase letter, then alnum/hyphen, 2-63 chars total.
    [[ "$SECRET_NAME" =~ ^[a-z][a-z0-9-]{1,62}$ ]] \
      || refuse "secret_name '$SECRET_NAME' is not a safe secret id"
    # Never let a system request creation of a super-credential. Mirrors the
    # EXCLUDE set in scripts/copy-generic-secrets.sh, plus privileged substrings.
    case "$SECRET_NAME" in
      *-management-key|*-provisioning-key|*-master-key|factory-master-broker-app-*|n8n-telegram-bot-token-test)
        refuse "secret_name '$SECRET_NAME' is a protected super-credential" ;;
      *broker*|*master*|*wif*|*private-key*|*app-private*)
        refuse "secret_name '$SECRET_NAME' contains a privileged keyword" ;;
    esac
    echo "VERDICT: allow (type=secret secret='$SECRET_NAME' project='$GCP_PROJECT' role=secretAccessor)"
    exit 0
    ;;

  iam)
    [ -n "$ROLE" ] || refuse "type=iam but no role"
    [[ "$ROLE" =~ ^roles/[a-zA-Z0-9._-]+$ ]] || refuse "role '$ROLE' is not a valid role id"
    # Hard-refuse escalating roles up front (clear message + defense in depth),
    # even before the allowlist check.
    case "$ROLE" in
      roles/owner|roles/editor|roles/iam.*|roles/resourcemanager.*|roles/serviceusage.*|roles/secretmanager.admin|*.admin)
        refuse "role '$ROLE' is privilege-escalating and never grantable" ;;
    esac
    # Default-deny: the role must be an exact member of the curated allowlist.
    _allowed=""
    while IFS= read -r r; do
      r="$(echo "$r" | xargs)"
      [ -n "$r" ] || continue
      if [ "$r" = "$ROLE" ]; then _allowed=1; break; fi
    done <<< "$ALLOWED_IAM_ROLES"
    [ -n "$_allowed" ] || refuse "role '$ROLE' is not on the IAM allowlist"
    echo "VERDICT: allow (type=iam role='$ROLE' project='$GCP_PROJECT')"
    exit 0
    ;;

  *)
    refuse "unknown request_type '$REQUEST_TYPE'"
    ;;
esac
