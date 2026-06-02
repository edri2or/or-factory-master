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
  {"context":"Playground tests"}
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
  rules: [
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0,
        require_code_owner_review: false,
        require_last_push_approval: false,
        dismiss_stale_reviews_on_push: false,
        required_review_thread_resolution: false
      }
    },
    {
      type: "required_status_checks",
      parameters: {
        required_status_checks: $contexts,
        strict_required_status_checks_policy: false
      }
    },
    {type: "non_fast_forward"},
    {type: "deletion"}
  ]
}')

_api() {
  curl -sf \
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
