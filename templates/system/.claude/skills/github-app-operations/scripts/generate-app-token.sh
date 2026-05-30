#!/usr/bin/env bash
# Generate a GitHub App installation token.
# Usage: PRIVATE_KEY="$(...)" generate-app-token.sh <app-id> <install-id> [repo-ids-json] [permissions-json] [repo-names-json]
# The App private key is passed via the PRIVATE_KEY env var (never a file on disk):
# it is fed to openssl through process substitution so it never touches the filesystem.
# Optional $3/$4/$5 scope the token to specific repos/permissions (passed as JSON):
#   - $3 repo-ids-json    e.g. '[1231185105]'    (uses repository_ids)
#   - $4 permissions-json e.g. '{"contents":"write"}'
#   - $5 repo-names-json  e.g. '["or-test-16"]'  (uses repositories — names; mutually exclusive with $3)
# Prints the token to stdout. Callers are responsible for masking via ::add-mask::.
set -euo pipefail

APP_ID="${1:-}"
INSTALL_ID="${2:-}"
REPO_IDS_JSON="${3:-}"
PERMISSIONS_JSON="${4:-}"
REPO_NAMES_JSON="${5:-}"

[ -n "${PRIVATE_KEY:-}" ] || { echo "generate-app-token: missing PRIVATE_KEY env var" >&2; exit 1; }
[ -n "$APP_ID" ]     || { echo "generate-app-token: missing app-id argument" >&2;     exit 1; }
[ -n "$INSTALL_ID" ] || { echo "generate-app-token: missing install-id argument" >&2; exit 1; }
if [ -n "$REPO_IDS_JSON" ] && [ -n "$REPO_NAMES_JSON" ]; then
  echo "generate-app-token: pass either repo-ids-json (\$3) or repo-names-json (\$5), not both" >&2
  exit 1
fi

base64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
iat=$((now - 60))
exp=$((now + 540))

HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | base64url)
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$APP_ID" | base64url)
# Sign with the key from PRIVATE_KEY via process substitution — the key never hits disk.
SIG=$(printf '%s' "${HEADER}.${PAYLOAD}" | openssl dgst -sha256 -sign <(printf '%s' "$PRIVATE_KEY") | base64url)
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
