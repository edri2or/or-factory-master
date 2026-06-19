#!/usr/bin/env bash
# builder-apply.sh — the broker's "apply a builder-soldier proposal as a scoped draft PR" step.
#
# Context (devplans/builder-soldier.md): the builder-soldier is the first WRITE-capable worker.
# It holds NO GitHub key — it only PROPOSES files (sandboxed Write/Edit into result/out/). THIS
# script, run by the broker (agent-action.yml, execute phase, AFTER Or's Telegram ✅), takes that
# proposed file tree and lands it as a DRAFT pull request into an allowlisted target repo, using a
# token scoped to that ONE repo. The factory's single-door invariant holds: only the broker writes.
#
# Three-layer allowlist (defense-in-depth): L3 (hard, external) = the TOKEN passed in is scoped to
# the one target repo, so GitHub rejects any other repo at the API; L1 (here) = TARGET_REPO must be
# in `builder_allowed_targets` in the policy, fail-closed; L2 = the builder's AGENTS.md forbids any
# other target. Plus a hard size brake (`builder_limits`) against a runaway / poisoned proposal.
#
# Inputs (env):
#   TARGET_REPO   required — owner/repo or bare repo (normalised to edri2or/<repo>)
#   CORR          required — correlation id (also the branch suffix: builder/<corr>)
#   OUT_DIR       required — dir holding the proposed file tree (the broker's dl/out)
#   TOKEN         required UNLESS DRY_RUN=true — a GitHub App token scoped to TARGET_REPO with
#                 {contents:write, pull_requests:write}
#   POLICY_FILE   optional — defaults to ../policy/agent-risk-tiers.yml
#   DRY_RUN       optional — "true" → validate + enumerate only, NO network, NO writes
#   SUMMARY       optional — one-line human summary for the PR body
#
# Output: one JSON line to stdout describing the outcome
#   dry-run : {"status":"dry_run","target":"edri2or/<r>","file_count":N,"total_bytes":B,"files":[...]}
#   applied : {"status":"pending_review","target":"...","branch":"builder/<corr>","pr_url":"...","pr_number":N,"file_count":N,"total_bytes":B}
# On any guard violation: prints an error to stderr and exits 1 (the broker fails the run).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${POLICY_FILE:-$SCRIPT_DIR/../policy/agent-risk-tiers.yml}"
TARGET_REPO="${TARGET_REPO:-}"
CORR="${CORR:-}"
OUT_DIR="${OUT_DIR:-}"
TOKEN="${TOKEN:-}"
DRY_RUN="${DRY_RUN:-false}"
SUMMARY="${SUMMARY:-}"
API="https://api.github.com"

die() { echo "builder-apply: $1" >&2; exit 1; }

[ -n "$TARGET_REPO" ] || die "TARGET_REPO is required"
[ -n "$CORR" ]        || die "CORR is required"
[ -n "$OUT_DIR" ]     || die "OUT_DIR is required"
[ -r "$POLICY_FILE" ] || die "policy file not readable: $POLICY_FILE"
[ -d "$OUT_DIR" ]     || die "OUT_DIR is not a directory: $OUT_DIR"
printf '%s' "$CORR" | grep -Eq '^[A-Za-z0-9-]{1,40}$' || die "CORR has a bad shape: $CORR"

# Normalise the target to edri2or/<repo>. Accept "owner/repo" or bare "repo"; force owner edri2or
# (the only org the broker serves) so the allowlist match and the API path are unambiguous.
repo_bare="${TARGET_REPO##*/}"
printf '%s' "$repo_bare" | grep -Eq '^[a-z][a-z0-9._-]{2,38}[a-z0-9]$' || die "target repo '$repo_bare' has a bad shape"
case "$repo_bare" in
  or-factory-master|or-factory-master-control|*-control) die "refusing control/factory repo '$repo_bare'" ;;
esac
TARGET_FULL="edri2or/${repo_bare}"

# --- L1: target must be in builder_allowed_targets (fail-closed) ----------------------------
allowed=0
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  # compare on the bare repo name (entries are like edri2or/personal-life)
  [ "${entry##*/}" = "$repo_bare" ] && { allowed=1; break; }
done < <(awk '
  /^builder_allowed_targets:[[:space:]]*$/ { inlist=1; next }
  inlist && /^[[:space:]]*#/               { next }
  inlist && /^[^[:space:]]/                { inlist=0 }
  inlist && /^[[:space:]]*-[[:space:]]+/ {
    v=$0; sub(/^[[:space:]]*-[[:space:]]+/,"",v); gsub(/"/,"",v); sub(/[[:space:]]+$/,"",v); print v
  }
' "$POLICY_FILE")
[ "$allowed" = "1" ] || die "target '${TARGET_FULL}' is NOT in builder_allowed_targets (fail-closed)"

# --- builder_limits (hard size brake) -------------------------------------------------------
read_limit() {  # read_limit <key> <fallback>
  local key="$1" fb="$2" v
  v="$(awk -v k="$key" '
    /^builder_limits:[[:space:]]*$/ { inmap=1; next }
    inmap && /^[[:space:]]*#/        { next }
    inmap && /^[^[:space:]]/         { inmap=0 }
    inmap {
      line=$0; sub(/#.*/,"",line)
      if (line ~ "^[[:space:]]+" k ":") { sub("^[[:space:]]+" k ":[[:space:]]*","",line); gsub(/[[:space:]]/,"",line); print line; exit }
    }
  ' "$POLICY_FILE")"
  case "$v" in ''|*[!0-9]*) printf '%s' "$fb" ;; *) printf '%s' "$v" ;; esac
}
MAX_FILES="$(read_limit max_files 50)"
MAX_BYTES="$(read_limit max_total_bytes 262144)"

# --- enumerate the proposed files + enforce the brake ---------------------------------------
mapfile -t FILES < <(cd "$OUT_DIR" && find . -type f -printf '%P\n' | LC_ALL=C sort)
FILE_COUNT="${#FILES[@]}"
[ "$FILE_COUNT" -gt 0 ] || die "proposal is empty (no files under ${OUT_DIR})"

TOTAL_BYTES=0
for rel in "${FILES[@]}"; do
  # refuse path traversal / absolute / .git writes — the broker must never apply these
  case "$rel" in
    ../*|*/../*|*/..|/*) die "refusing unsafe path in proposal: '$rel'" ;;
    .git/*|*/.git/*)     die "refusing .git path in proposal: '$rel'" ;;
  esac
  sz=$(wc -c < "${OUT_DIR}/${rel}" | tr -d ' ')
  TOTAL_BYTES=$((TOTAL_BYTES + sz))
done

[ "$FILE_COUNT" -le "$MAX_FILES" ] || die "proposal touches ${FILE_COUNT} files > max_files ${MAX_FILES} (runaway/poisoned brake)"
[ "$TOTAL_BYTES" -le "$MAX_BYTES" ] || die "proposal total ${TOTAL_BYTES}B > max_total_bytes ${MAX_BYTES} (runaway/poisoned brake)"

files_json=$(printf '%s\n' "${FILES[@]}" | jq -R . | jq -cs .)

echo "builder-apply: target=${TARGET_FULL} files=${FILE_COUNT} bytes=${TOTAL_BYTES} (limits ${MAX_FILES}/${MAX_BYTES})" >&2
printf 'builder-apply: proposed files:\n' >&2
printf '  - %s\n' "${FILES[@]}" >&2

# --- DRY_RUN: stop here, no network, no writes ----------------------------------------------
if [ "$DRY_RUN" = "true" ]; then
  jq -cn --arg t "$TARGET_FULL" --argjson n "$FILE_COUNT" --argjson b "$TOTAL_BYTES" --argjson f "$files_json" \
    '{status:"dry_run", target:$t, file_count:$n, total_bytes:$b, files:$f}'
  exit 0
fi

# --- apply (network) ------------------------------------------------------------------------
[ -n "$TOKEN" ] || die "TOKEN is required to apply (set DRY_RUN=true to validate only)"
BRANCH="builder/${CORR}"

gh_api() {  # gh_api <method> <path> [data] ; prints body, sets GH_CODE
  local method="$1" path="$2" data="${3:-}" code
  if [ -n "$data" ]; then
    code=$(curl -sS -m 30 -o /tmp/ba.body -w '%{http_code}' -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" --data "$data" || echo "000")
  else
    code=$(curl -sS -m 30 -o /tmp/ba.body -w '%{http_code}' -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" || echo "000")
  fi
  GH_CODE="$code"
  cat /tmp/ba.body
}

# default branch + its head sha
repo_body=$(gh_api GET "/repos/${TARGET_FULL}")
[ "$GH_CODE" = "200" ] || die "GET repo ${TARGET_FULL} -> HTTP ${GH_CODE}: $(printf '%s' "$repo_body" | jq -r '.message // empty')"
BASE=$(printf '%s' "$repo_body" | jq -r '.default_branch // "main"')

ref_body=$(gh_api GET "/repos/${TARGET_FULL}/git/ref/heads/${BASE}")
[ "$GH_CODE" = "200" ] || die "GET base ref ${BASE} -> HTTP ${GH_CODE}: $(printf '%s' "$ref_body" | jq -r '.message // empty')"
BASE_SHA=$(printf '%s' "$ref_body" | jq -r '.object.sha // empty')
[ -n "$BASE_SHA" ] || die "could not resolve base sha for ${BASE}"

# create the builder branch (idempotent: 422 'Reference already exists' is OK — reuse it)
mk_body=$(gh_api POST "/repos/${TARGET_FULL}/git/refs" \
  "$(jq -cn --arg r "refs/heads/${BRANCH}" --arg s "$BASE_SHA" '{ref:$r, sha:$s}')")
case "$GH_CODE" in
  201) echo "builder-apply: created branch ${BRANCH}" >&2 ;;
  422) echo "builder-apply: branch ${BRANCH} already exists — reusing" >&2 ;;
  *)   die "create branch ${BRANCH} -> HTTP ${GH_CODE}: $(printf '%s' "$mk_body" | jq -r '.message // empty')" ;;
esac

# push each proposed file onto the branch (commit trailer [builder-agent])
for rel in "${FILES[@]}"; do
  b64=$(base64 -w0 < "${OUT_DIR}/${rel}")
  # existing file on the branch needs its blob sha for an update
  cur=$(gh_api GET "/repos/${TARGET_FULL}/contents/${rel}?ref=${BRANCH}")
  sha=""
  [ "$GH_CODE" = "200" ] && sha=$(printf '%s' "$cur" | jq -r '.sha // empty')
  if [ -n "$sha" ]; then
    put=$(jq -cn --arg m "builder: ${CORR} — ${rel}"$'\n\n'"[builder-agent]" --arg c "$b64" --arg br "$BRANCH" --arg s "$sha" \
      '{message:$m, content:$c, branch:$br, sha:$s}')
  else
    put=$(jq -cn --arg m "builder: ${CORR} — ${rel}"$'\n\n'"[builder-agent]" --arg c "$b64" --arg br "$BRANCH" \
      '{message:$m, content:$c, branch:$br}')
  fi
  pb=$(gh_api PUT "/repos/${TARGET_FULL}/contents/${rel}" "$put")
  case "$GH_CODE" in
    200|201) ;;
    *) die "PUT ${rel} -> HTTP ${GH_CODE}: $(printf '%s' "$pb" | jq -r '.message // empty')" ;;
  esac
done
echo "builder-apply: pushed ${FILE_COUNT} file(s) to ${BRANCH}" >&2

# open the DRAFT PR (idempotent: if one already exists head→base, reuse it)
title="builder: ${CORR} — automated proposal (draft, review before merge)"
body=$(printf '🤖 **builder-soldier** draft proposal — correlation `%s`.\n\n%s\n\n**Files (%s, %s bytes):**\n%s\n\n_Review the files and **merge manually**. The builder cannot merge._' \
  "$CORR" "${SUMMARY:-Automated scaffold proposed by the builder-soldier via the broker.}" "$FILE_COUNT" "$TOTAL_BYTES" \
  "$(printf -- '- `%s`\n' "${FILES[@]}")")
pr_body=$(gh_api POST "/repos/${TARGET_FULL}/pulls" \
  "$(jq -cn --arg t "$title" --arg h "$BRANCH" --arg b "$BASE" --arg bd "$body" '{title:$t, head:$h, base:$b, body:$bd, draft:true}')")
PR_URL=""; PR_NUM=""
case "$GH_CODE" in
  201)
    PR_URL=$(printf '%s' "$pr_body" | jq -r '.html_url // empty')
    PR_NUM=$(printf '%s' "$pr_body" | jq -r '.number // empty')
    echo "builder-apply: opened draft PR ${PR_URL}" >&2 ;;
  422)
    # likely a PR already exists for this head — find it
    existing=$(gh_api GET "/repos/${TARGET_FULL}/pulls?head=edri2or:${BRANCH}&state=open")
    PR_URL=$(printf '%s' "$existing" | jq -r '.[0].html_url // empty')
    PR_NUM=$(printf '%s' "$existing" | jq -r '.[0].number // empty')
    [ -n "$PR_URL" ] || die "open PR -> HTTP 422 and no existing PR found: $(printf '%s' "$pr_body" | jq -r '.message // empty')"
    echo "builder-apply: reusing existing PR ${PR_URL}" >&2 ;;
  *) die "open draft PR -> HTTP ${GH_CODE}: $(printf '%s' "$pr_body" | jq -r '.message // empty')" ;;
esac
rm -f /tmp/ba.body

jq -cn --arg t "$TARGET_FULL" --arg br "$BRANCH" --arg u "$PR_URL" --arg pn "$PR_NUM" \
  --argjson n "$FILE_COUNT" --argjson b "$TOTAL_BYTES" \
  '{status:"pending_review", target:$t, branch:$br, pr_url:$u, pr_number:($pn|tonumber? // $pn), file_count:$n, total_bytes:$b}'
