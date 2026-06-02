#!/usr/bin/env bash
# Delete Linear webhooks that point at *.or-infra.com hosts whose backing
# system no longer exists (decommissioned test systems leave behind orphan
# webhooks in Linear that Linear keeps retrying and eventually disables —
# decommission-test-system.yml doesn't currently delete them).
#
# Two modes, both default to --dry-run (must pass --apply to delete):
#
#   --mode=scan-all                         # list all webhooks, mark any whose
#                                           # URL host is "<repo>.or-infra.com"
#                                           # or "n8n-<repo>.or-infra.com" where
#                                           # edri2or/<repo> is missing or
#                                           # archived. Needs --github-token.
#
#   --mode=single --system=<system_name>    # delete every webhook whose URL host
#                                           # matches "<system>.or-infra.com" or
#                                           # "n8n-<system>.or-infra.com". Run
#                                           # this from decommission-test-system.yml.
#
# Hard safety: this script ONLY touches webhooks whose URL host ends with
# ".or-infra.com" — webhooks pointing at run.app (the OIL webhook on the MCP
# server) or anywhere else are NEVER deleted.
#
# Reads the Linear API key via --api-key=<key> or env LINEAR_API_KEY.

set -euo pipefail

MODE=""
SYSTEM=""
APPLY="false"
API_KEY="${LINEAR_API_KEY:-}"
GH_TOKEN="${GITHUB_TOKEN:-}"
GH_ORG="edri2or"

usage() {
  cat >&2 <<EOF
Usage: $0 --mode=scan-all|single [--system=<name>] [--apply] [--api-key=<key>] [--github-token=<token>]

Default is --dry-run (no deletions). Pass --apply to actually delete.
EOF
  exit 2
}

for arg in "$@"; do
  case "$arg" in
    --mode=*)         MODE="${arg#*=}" ;;
    --system=*)       SYSTEM="${arg#*=}" ;;
    --apply)          APPLY="true" ;;
    --dry-run)        APPLY="false" ;;
    --api-key=*)      API_KEY="${arg#*=}" ;;
    --github-token=*) GH_TOKEN="${arg#*=}" ;;
    -h|--help)        usage ;;
    *) echo "Unknown arg: $arg" >&2; usage ;;
  esac
done

[ -n "$API_KEY" ] || { echo "FAIL: missing Linear API key (--api-key or LINEAR_API_KEY)" >&2; exit 1; }
case "$MODE" in
  scan-all)
    [ -n "$GH_TOKEN" ] || { echo "FAIL: --mode=scan-all needs --github-token or GITHUB_TOKEN" >&2; exit 1; } ;;
  single)
    [ -n "$SYSTEM" ] || { echo "FAIL: --mode=single needs --system=<name>" >&2; exit 1; }
    # Validate the system name shape so a stray value can't match too broadly.
    [[ "$SYSTEM" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || { echo "FAIL: invalid --system='$SYSTEM'" >&2; exit 1; } ;;
  *) usage ;;
esac

LINEAR_API="https://api.linear.app/graphql"

_linear_gql() {
  local query="$1" variables="${2:-{\}}"
  curl -sS --max-time 30 -X POST "$LINEAR_API" \
    -H "Authorization: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -cn --arg q "$query" --argjson v "$variables" '{query:$q,variables:$v}')"
}

# Repo existence check — orphan if the repo is 404 OR archived.
# Returns: "orphan" | "live" | "unknown".
_repo_status() {
  local repo="$1"
  local http
  http=$(curl -sS -o /tmp/repo-$$.json -w '%{http_code}' --max-time 15 \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GH_ORG}/${repo}" || echo "000")
  if [ "$http" = "404" ]; then rm -f /tmp/repo-$$.json; echo "orphan"; return; fi
  if [ "$http" = "200" ]; then
    local arch
    arch=$(jq -r '.archived // false' /tmp/repo-$$.json 2>/dev/null || echo "false")
    rm -f /tmp/repo-$$.json
    [ "$arch" = "true" ] && echo "orphan" || echo "live"
    return
  fi
  rm -f /tmp/repo-$$.json
  echo "unknown"
}

# List all webhooks (paginated up to 250 — Linear's max per page; the factory
# never had close to that many).
RESP=$(_linear_gql 'query{ webhooks(first:250){ nodes{ id url enabled label } } }')
if ! printf '%s' "$RESP" | jq empty >/dev/null 2>&1; then
  echo "FAIL: Linear API did not return valid JSON (auth failure?): $(printf '%s' "$RESP" | head -c 200)" >&2
  exit 1
fi
ERR=$(printf '%s' "$RESP" | jq -r '.errors // empty')
if [ -n "$ERR" ] && [ "$ERR" != "null" ]; then
  echo "FAIL: Linear webhooks query errored: $ERR" >&2
  exit 1
fi

TOTAL=$(printf '%s' "$RESP" | jq '.data.webhooks.nodes | length')
echo "INFO: ${TOTAL} webhooks found in workspace (mode=${MODE}, apply=${APPLY})"

DELETED=0
SKIPPED=0
LIVE=0
NON_INFRA=0

# Iterate. Bash subshell-safe: read each node line as compact JSON.
while IFS= read -r row; do
  ID=$(printf '%s' "$row" | jq -r '.id')
  URL=$(printf '%s' "$row" | jq -r '.url')
  LABEL=$(printf '%s' "$row" | jq -r '.label // ""')
  HOST=$(printf '%s' "$URL" | awk -F[/:] '{print $4}')

  # HARD SAFETY GATE — never delete anything that isn't *.or-infra.com.
  case "$HOST" in
    *.or-infra.com) : ;;
    *) NON_INFRA=$((NON_INFRA+1)); continue ;;
  esac

  # Derive the repo name embedded in the host.
  # Patterns: <repo>.or-infra.com  OR  n8n-<repo>.or-infra.com
  STEM="${HOST%.or-infra.com}"
  REPO="${STEM#n8n-}"

  MATCH="false"
  if [ "$MODE" = "single" ]; then
    [ "$REPO" = "$SYSTEM" ] && MATCH="true"
  else
    case "$(_repo_status "$REPO")" in
      orphan)  MATCH="true" ;;
      live)    LIVE=$((LIVE+1)) ;;
      unknown) echo "WARN: github status unknown for repo '${REPO}' (host '${HOST}') — skipping" >&2 ;;
    esac
  fi

  if [ "$MATCH" != "true" ]; then
    SKIPPED=$((SKIPPED+1))
    continue
  fi

  if [ "$APPLY" != "true" ]; then
    echo "DRY-RUN would delete: id=${ID} host=${HOST} label='${LABEL}'"
    DELETED=$((DELETED+1))
    continue
  fi

  DRESP=$(_linear_gql 'mutation($id:String!){ webhookDelete(id:$id){ success } }' \
    "$(jq -cn --arg id "$ID" '{id:$id}')")
  OK=$(printf '%s' "$DRESP" | jq -r '.data.webhookDelete.success // false')
  if [ "$OK" = "true" ]; then
    echo "DELETED: id=${ID} host=${HOST} label='${LABEL}'"
    DELETED=$((DELETED+1))
  else
    echo "WARN: webhookDelete failed for id=${ID} host=${HOST}: $(printf '%s' "$DRESP" | jq -c '.errors // .')" >&2
  fi
done < <(printf '%s' "$RESP" | jq -c '.data.webhooks.nodes[]')

echo "SUMMARY: deleted_or_would_delete=${DELETED} skipped=${SKIPPED} live=${LIVE} non_infra=${NON_INFRA} total=${TOTAL} apply=${APPLY}"
