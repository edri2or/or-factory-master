#!/usr/bin/env bash
# Idempotent: creates or updates the protect-main ruleset on a target repo.
# Defaults to edri2or/or-factory-master for backward compatibility with
# .github/workflows/protect-main.yml. Override via env vars to apply the same
# ruleset to system repos — see .github/workflows/protect-system-main.yml.
#
# Required env: APP_TOKEN (administration:write on the target repo).
# Optional env:
#   TARGET_REPO              owner/repo (default: edri2or/or-factory-master)
#   REQUIRED_CONTEXTS_JSON   JSON array of required status-check contexts —
#                            either strings (["A","B"]) or {context} objects
#                            ([{"context":"A"}]). Default: the factory's 5 gates.
set -euo pipefail

REPO="${TARGET_REPO:-edri2or/or-factory-master}"
RULESET_NAME="protect-main"
API="https://api.github.com/repos/${REPO}/rulesets"

DEFAULT_CONTEXTS='[
  {"context":"Changelog gates"},
  {"context":"shellcheck + yamllint"},
  {"context":"Scan for committed secrets"},
  {"context":"Supply chain gates"},
  {"context":"Playground tests"},
  {"context":"E2E verification gate"}
]'

# Normalize REQUIRED_CONTEXTS_JSON to the [{context: ...}] form the rulesets
# API expects. Accept either a plain string array or the object form already.
if [ -n "${REQUIRED_CONTEXTS_JSON:-}" ]; then
  CONTEXTS=$(echo "${REQUIRED_CONTEXTS_JSON}" | jq -c '
    if length == 0 then []
    elif (.[0] | type) == "string" then map({context: .})
    else . end
  ')
else
  CONTEXTS=$(echo "${DEFAULT_CONTEXTS}" | jq -c '.')
fi

# Build the ruleset payload.
# strict_required_status_checks_policy:false = non-strict (branches don't need to
# be up-to-date before merging — merge queue is the right tool at higher throughput,
# not strict rebasing at current factory PR volume).
#
# The required_status_checks rule is included ONLY when there is at least one
# context. A repo with no factory CI (e.g. a plain target repo like
# edri2or/personal-life, REQUIRED_CONTEXTS_JSON='[]') still gets PR-required +
# no-force-push + no-deletion, but no status-check gate — emitting that rule with an
# empty list is both rejected by the rulesets API (HTTP 4xx) and, if it were
# accepted, would wedge the repo (a check that never runs never passes → no merge).
PAYLOAD=$(jq -cn --argjson contexts "${CONTEXTS}" '{
  name: "protect-main",
  target: "branch",
  enforcement: "active",
  conditions: {
    ref_name: {
      include: ["~DEFAULT_BRANCH"],
      exclude: []
    }
  },
  bypass_actors: [
    {
      actor_id: 5,
      actor_type: "RepositoryRole",
      bypass_mode: "always"
    }
  ],
  rules: (
    [
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          require_code_owner_review: false,
          require_last_push_approval: false,
          dismiss_stale_reviews_on_push: false,
          required_review_thread_resolution: false
        }
      }
    ]
    + (if ($contexts | length) > 0 then [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: $contexts,
            strict_required_status_checks_policy: false
          }
        }
      ] else [] end)
    + [
      {type: "non_fast_forward"},
      {type: "deletion"}
    ]
  )
}')

_api() {
  curl -sf \
    -H "Authorization: Bearer ${APP_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

# Like _api but returns ONLY the HTTP status code (no -f), for calls where a 4xx is an
# expected, handled outcome — e.g. the idempotent classic-protection cleanup below, where
# 404 means "already clean" and must not be treated as an error.
_api_code() {
  curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${APP_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

# List existing rulesets; find protect-main by name.
EXISTING=$(_api "${API}")
RULESET_ID=$(echo "${EXISTING}" | jq -r --arg name "${RULESET_NAME}" \
  '.[] | select(.name == $name) | .id // empty')

if [ -n "${RULESET_ID}" ]; then
  echo "Updating existing ruleset id=${RULESET_ID}..."
  RESULT=$(_api -X PUT -d "${PAYLOAD}" "${API}/${RULESET_ID}")
else
  echo "Creating new ruleset..."
  RESULT=$(_api -X POST -d "${PAYLOAD}" "${API}")
fi

NAME=$(echo "${RESULT}" | jq -r '.name // empty')
ENFORCEMENT=$(echo "${RESULT}" | jq -r '.enforcement // empty')
RULESET_ID_OUT=$(echo "${RESULT}" | jq -r '.id // empty')

if [ "${NAME}" = "protect-main" ] && [ "${ENFORCEMENT}" = "active" ]; then
  echo "PASS: protect-main ruleset active on ${REPO} (id=${RULESET_ID_OUT})"
else
  echo "FAIL: unexpected result on ${REPO} — name=${NAME} enforcement=${ENFORCEMENT}" >&2
  echo "${RESULT}" | jq . >&2
  exit 1
fi

# --- Reconcile: remove any leftover legacy CLASSIC branch protection -----------------
# Older repos — the factory before this change, and systems provisioned before the
# 2026-06 ruleset migration — had a CLASSIC branch protection set via the now-removed
# `PUT /branches/<branch>/protection` path (strict:true + the original 4 contexts +
# enforce_admins). GitHub enforces classic protection AND the ruleset *simultaneously*,
# so a leftover classic layer silently overrides the ruleset's intent (notably it forces
# strict "branch must be up to date before merge", defeating cheap parallel merges).
# The ruleset (asserted active just above) is the SOLE intended governor, so delete any
# classic protection now. Idempotent: 404 == already clean. Done ONLY AFTER the ruleset is
# confirmed active, so the branch is never left unprotected. Non-fatal: the ruleset already
# protects the branch, so a cleanup hiccup must never fail hardening.
BRANCH="main"   # every factory-managed repo (factory + systems) uses main as default
PROT_API="https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection"
DEL_CODE=$(_api_code -X DELETE "${PROT_API}" || echo "000")
case "${DEL_CODE}" in
  204) echo "Reconcile: removed leftover classic branch protection on ${REPO}@${BRANCH} — ruleset is now the sole governor." ;;
  404) echo "Reconcile: no classic branch protection on ${REPO}@${BRANCH} (already ruleset-only)." ;;
  *)   echo "WARN: unexpected HTTP ${DEL_CODE} deleting classic protection on ${REPO}@${BRANCH}; ruleset remains active (not failing)." >&2 ;;
esac
# Confirm it's gone — a clear verification surface in the protect-main run log.
VERIFY_CODE=$(_api_code "${PROT_API}" || echo "000")
if [ "${VERIFY_CODE}" = "404" ]; then
  echo "Reconcile: verified no classic branch protection on ${REPO}@${BRANCH} (ruleset-only)."
else
  echo "WARN: classic protection still reports HTTP ${VERIFY_CODE} on ${REPO}@${BRANCH} after delete." >&2
fi
