#!/usr/bin/env bash
# Generate a GitHub App installation token.
# Usage: generate-app-token.sh <key-file> <app-id> <install-id> [repo-ids-json] [permissions-json] [repo-names-json]
# Optional $4/$5/$6 scope the token to specific repos/permissions (passed as JSON):
#   - $4 repo-ids-json    e.g. '[1231185105]'    (uses repository_ids)
#   - $5 permissions-json e.g. '{"contents":"write"}'
#   - $6 repo-names-json  e.g. '["or-test-16"]'  (uses repositories — names; mutually exclusive with $4)
# Prints the token to stdout. Callers are responsible for masking via ::add-mask::.
set -euo pipefail

KEY_FILE="${1:-}"
APP_ID="${2:-}"
INSTALL_ID="${3:-}"
REPO_IDS_JSON="${4:-}"
PERMISSIONS_JSON="${5:-}"
REPO_NAMES_JSON="${6:-}"

[ -n "$KEY_FILE" ]   || { echo "generate-app-token: missing key-file argument" >&2;   exit 1; }
[ -n "$APP_ID" ]     || { echo "generate-app-token: missing app-id argument" >&2;     exit 1; }
[ -n "$INSTALL_ID" ] || { echo "generate-app-token: missing install-id argument" >&2; exit 1; }
[ -f "$KEY_FILE" ]   || { echo "generate-app-token: key file not found: $KEY_FILE" >&2; exit 1; }
if [ -n "$REPO_IDS_JSON" ] && [ -n "$REPO_NAMES_JSON" ]; then
  echo "generate-app-token: pass either repo-ids-json (\$4) or repo-names-json (\$6), not both" >&2
  exit 1
fi

base64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
iat=$((now - 60))
exp=$((now + 540))

HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | base64url)
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$APP_ID" | base64url)
SIG=$(printf '%s' "${HEADER}.${PAYLOAD}" | openssl dgst -sha256 -sign "$KEY_FILE" | base64url)
JWT="${HEADER}.${PAYLOAD}.${SIG}"

CURL_BODY_ARGS=()
if [ -n "$REPO_NAMES_JSON" ] && [ -n "$PERMISSIONS_JSON" ]; then
  BODY="{\"repositories\":${REPO_NAMES_JSON},\"permissions\":${PERMISSIONS_JSON}}"
  CURL_BODY_ARGS=(-d "$BODY")
elif [ -n "$REPO_IDS_JSON" ] && [ -n "$PERMISSIONS_JSON" ]; then
  BODY="{\"repository_ids\":${REPO_IDS_JSON},\"permissions\":${PERMISSIONS_JSON}}"
  CURL_BODY_ARGS=(-d "$BODY")
fi

TOKEN=$(curl -sf -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "${CURL_BODY_ARGS[@]}" \
  "https://api.github.com/app/installations/${INSTALL_ID}/access_tokens" \
  | jq -r '.token // empty')
[ -n "$TOKEN" ] || { echo "generate-app-token: could not obtain installation token" >&2; exit 1; }

printf '%s' "$TOKEN"
