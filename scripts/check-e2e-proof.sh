#!/usr/bin/env bash
# check-e2e-proof.sh — the enforceable E2E verification gate.
#
# Twin of check-devplan-updated.sh: it gives the E2E discipline its teeth. When a
# diff touches BEHAVIOR-BEARING files (the bot's n8n workflows or the installer
# that wires them) it REQUIRES a fresh, real E2E proof in the SAME diff — a proof
# that an agent cannot forge by "deciding it works". When no behavior file changed
# it is a no-op, so ordinary work is never affected.
#
# A valid proof must satisfy ALL of:
#   1. it is present in this diff (e2e-proofs/*.json), schema e2e-proof/v1, result "pass";
#   2. its content_hash equals a freshly recomputed hash of the repo's behavior
#      files (edit any behavior file AFTER proving -> mismatch -> red);
#   3. it is fresh (executed_at within the freshness window);
#   4. (CI) its run_id is a SUCCESSFUL e2e-verify.yml run on THIS repo, and the
#      e2e-proof artifact that run uploaded matches the committed proof — so the
#      proof provably came from a real live E2E run, not a hand-written file.
#
# Wired into the dedicated "E2E verification gate" CI job (e2e-gate.yml), which is
# a required status check in the protect-main ruleset — server-enforced, unskippable.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

PROOF_DIR_RE='^e2e-proofs/.+\.json$'
MAX_AGE_DAYS="${E2E_PROOF_MAX_AGE_DAYS:-14}"

# OIL auto-fix PRs (branch oil-autofix/*) are EXEMPT, exactly as the devplan gate
# exempts them: they are automated, safety-gated, human-✅'d fixes with their own
# post-merge reproducer verification (oil-verify.sh), and cannot stand up a live
# system inside their flow.
BRANCH="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
case "$BRANCH" in
  oil-autofix/*)
    echo "PASS: oil-autofix branch ('$BRANCH') — E2E gate skipped (automated safety-gated fix, own verify path)."
    exit 0
    ;;
esac

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
BEHAVIOR_CHANGED=$(e2e_changed_behavior_files "$CHANGED")

if [ -z "$BEHAVIOR_CHANGED" ]; then
  echo "PASS: no behavior-bearing file changed — E2E gate is a no-op."
  exit 0
fi

echo "Behavior-bearing files changed in this diff:"
echo "$BEHAVIOR_CHANGED" | sed 's/^/  - /'

PROOFS_IN_DIFF=$(echo "$CHANGED" | grep -E "$PROOF_DIR_RE" || true)
if [ -z "$PROOFS_IN_DIFF" ]; then
  echo "ERROR: שונה קוד-התנהגות של הבוט בלי הוכחת E2E אמיתית באותו דיף." >&2
  echo "ERROR: behavior-bearing files changed but NO e2e-proofs/*.json is in this diff." >&2
  echo "Run the e2e-verify workflow against a live system; it sends a real message through" >&2
  echo "the inbound path, asserts on the reply, and commits e2e-proofs/<slug>.json here." >&2
  exit 1
fi

CURRENT_HASH=$(e2e_behavior_hash)
echo "Current behavior hash: ${CURRENT_HASH}"

# Verify one proof file. Echoes a reason on failure; returns 0 only if fully valid.
verify_proof() {
  local p="$1"
  [ -f "$p" ] || { echo "  $p: file missing"; return 1; }
  jq -e . "$p" >/dev/null 2>&1 || { echo "  $p: not valid JSON"; return 1; }

  local schema result chash at run_id
  schema=$(jq -r '.schema // ""' "$p")
  result=$(jq -r '.result // ""' "$p")
  chash=$(jq -r '.content_hash // ""' "$p")
  at=$(jq -r '.executed_at // ""' "$p")
  run_id=$(jq -r '.run_id // ""' "$p")

  [ "$schema" = "e2e-proof/v1" ] || { echo "  $p: schema='$schema' (want e2e-proof/v1)"; return 1; }
  [ "$result" = "pass" ] || { echo "  $p: result='$result' (want pass)"; return 1; }
  [ "$chash" = "$CURRENT_HASH" ] || {
    echo "  $p: content_hash mismatch — proof attests '$chash' but behavior files now hash '$CURRENT_HASH'."
    echo "       (a behavior file was edited after the proof was produced — re-run e2e-verify.)"; return 1; }

  # Freshness.
  if [ -n "$at" ]; then
    local at_s now_s age_d
    at_s=$(date -u -d "$at" +%s 2>/dev/null || echo 0)
    now_s=$(date -u +%s)
    if [ "$at_s" -gt 0 ]; then
      age_d=$(( (now_s - at_s) / 86400 ))
      [ "$age_d" -le "$MAX_AGE_DAYS" ] || { echo "  $p: stale (executed ${age_d}d ago > ${MAX_AGE_DAYS}d)"; return 1; }
    fi
  fi

  # CI-only: prove the proof came from a REAL successful e2e-verify run on this repo.
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    local repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required in CI}"
    : "${GITHUB_TOKEN:?GITHUB_TOKEN (actions:read) required for the E2E gate run cross-check}"
    [ -n "$run_id" ] || { echo "  $p: no run_id to cross-check"; return 1; }

    local run_json conclusion wf_path head_repo
    run_json=$(_gh_api "/repos/${repo}/actions/runs/${run_id}") || { echo "  $p: cannot read run ${run_id}"; return 1; }
    conclusion=$(echo "$run_json" | jq -r '.conclusion // ""')
    wf_path=$(echo "$run_json" | jq -r '.path // ""')
    head_repo=$(echo "$run_json" | jq -r '.head_repository.full_name // ""')

    [ "$conclusion" = "success" ] || { echo "  $p: run ${run_id} conclusion='$conclusion' (want success)"; return 1; }
    [ "$wf_path" = ".github/workflows/e2e-verify.yml" ] || { echo "  $p: run ${run_id} is '$wf_path' (want e2e-verify.yml)"; return 1; }
    [ "$head_repo" = "$repo" ] || { echo "  $p: run ${run_id} head_repository='$head_repo' (want $repo — no foreign runs)"; return 1; }

    _verify_artifact_matches "$repo" "$run_id" "$p" || return 1
    echo "  $p: VALID (result=pass, content_hash matches, run ${run_id} cross-checked)."
  else
    echo "  NOTE: not in CI — skipping the run/artifact cross-check (enforced in the CI gate job)."
    echo "  $p: structurally VALID (result=pass, content_hash matches; run cross-check is CI-only)."
  fi
  return 0
}

_gh_api() {
  curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$1"
}

# Download the run's `e2e-proof` artifact and assert it matches the committed proof
# (canonical JSON compare). The artifact is fetched from GitHub for that run_id, so
# it cannot be hand-forged: only a real e2e-verify run could have produced it.
_verify_artifact_matches() {
  local repo="$1" run_id="$2" committed="$3"
  local arts dl tmp
  arts=$(_gh_api "/repos/${repo}/actions/runs/${run_id}/artifacts") || { echo "  cannot list artifacts for run ${run_id}"; return 1; }
  dl=$(echo "$arts" | jq -r '.artifacts[]? | select(.name=="e2e-proof") | .archive_download_url' | head -n1)
  [ -n "$dl" ] || { echo "  run ${run_id} has no 'e2e-proof' artifact"; return 1; }

  tmp=$(mktemp -d)
  # archive_download_url 302-redirects to a signed blob; -L follows it.
  if ! curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" "$dl" -o "$tmp/a.zip"; then
    echo "  could not download e2e-proof artifact"; rm -rf "$tmp"; return 1
  fi
  ( cd "$tmp" && unzip -qo a.zip ) || { echo "  could not unzip artifact"; rm -rf "$tmp"; return 1; }
  local art_json
  art_json=$(find "$tmp" -name '*.json' ! -name 'a.zip' | head -n1)
  [ -n "$art_json" ] || { echo "  artifact contains no JSON proof"; rm -rf "$tmp"; return 1; }

  if jq -S . "$art_json" >/dev/null 2>&1 && jq -S . "$committed" >/dev/null 2>&1 \
     && [ "$(jq -S -c . "$art_json")" = "$(jq -S -c . "$committed")" ]; then
    rm -rf "$tmp"; return 0
  fi
  echo "  committed proof does NOT match the e2e-verify run's uploaded artifact"
  rm -rf "$tmp"; return 1
}

VALID=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  if verify_proof "$p"; then VALID=1; break; fi
done <<< "$PROOFS_IN_DIFF"

if [ "$VALID" -eq 1 ]; then
  echo "PASS: E2E verification gate — a fresh, real behavioral proof covers this change."
  exit 0
fi

echo "ERROR: no valid E2E proof in this diff covers the behavior change." >&2
echo "ERROR: אין הוכחת E2E תקפה שמכסה את שינוי-ההתנהגות." >&2
exit 1
