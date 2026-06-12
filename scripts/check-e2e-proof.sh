#!/usr/bin/env bash
# check-e2e-proof.sh — the enforceable, surface-aware E2E verification gate.
#
# Generalized from the bot-only gate (see docs/e2e-enforcement-standard.md): it
# reads the surface registry (e2e-surfaces.json via scripts/lib.sh) and, for EACH
# ENFORCED surface whose trigger paths the diff touched, REQUIRES a fresh, real
# E2E proof in the SAME diff. A no-op when no enforced surface was touched, so
# ordinary work is never affected. With one registered surface (the telegram bot)
# this behaves exactly as the original gate.
#
# A valid proof for a surface must satisfy ALL of:
#   1. it is in this diff and matches the surface's proof_glob, schema e2e-proof/v1, result "pass";
#   2. its content_hash equals a freshly recomputed hash of the surface's hash_inputs
#      (edit a behavior file AFTER proving -> mismatch -> red);
#   3. it is fresh (executed_at within the surface's freshness_days);
#   4. (CI) its run_id is a SUCCESSFUL run of the surface's proof_producer on THIS
#      repo, and the e2e-proof artifact that run uploaded matches the committed proof.
#
# Wired into the dedicated "E2E verification gate" CI job (e2e-gate.yml), a required
# status check in the protect-main ruleset — server-enforced, unskippable.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

# OIL auto-fix PRs (branch oil-autofix/*) are EXEMPT, exactly as the devplan gate
# exempts them: automated, safety-gated, human-✅'d fixes with their own post-merge
# reproducer verification, which cannot stand up a live system inside their flow.
BRANCH="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
case "$BRANCH" in
  oil-autofix/*)
    echo "PASS: oil-autofix branch ('$BRANCH') — E2E gate skipped (automated safety-gated fix, own verify path)."
    exit 0
    ;;
esac

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

_gh_api() {
  curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$1"
}

# Download the run's `e2e-proof` artifact and assert it matches the committed proof
# (canonical JSON compare). Fetched from GitHub for that run_id, so it cannot be
# hand-forged: only a real proof-producer run could have produced it.
_verify_artifact_matches() {
  local repo="$1" run_id="$2" committed="$3"
  local arts dl tmp art_json
  arts=$(_gh_api "/repos/${repo}/actions/runs/${run_id}/artifacts") || { echo "  cannot list artifacts for run ${run_id}"; return 1; }
  dl=$(echo "$arts" | jq -r '.artifacts[]? | select(.name=="e2e-proof") | .archive_download_url' | head -n1)
  [ -n "$dl" ] || { echo "  run ${run_id} has no 'e2e-proof' artifact"; return 1; }
  tmp=$(mktemp -d)
  if ! curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" "$dl" -o "$tmp/a.zip"; then
    echo "  could not download e2e-proof artifact"; rm -rf "$tmp"; return 1
  fi
  ( cd "$tmp" && unzip -qo a.zip ) || { echo "  could not unzip artifact"; rm -rf "$tmp"; return 1; }
  art_json=$(find "$tmp" -name '*.json' ! -name 'a.zip' | head -n1)
  [ -n "$art_json" ] || { echo "  artifact contains no JSON proof"; rm -rf "$tmp"; return 1; }
  if [ "$(jq -S -c . "$art_json")" = "$(jq -S -c . "$committed")" ]; then
    rm -rf "$tmp"; return 0
  fi
  echo "  committed proof does NOT match the producing run's uploaded artifact"
  rm -rf "$tmp"; return 1
}

# verify_proof <proof_path> <expected_hash> <max_age_days> <proof_producer>
verify_proof() {
  local p="$1" exp_hash="$2" max_age="$3" producer="$4"
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
  [ "$chash" = "$exp_hash" ] || {
    echo "  $p: content_hash mismatch — proof attests '$chash' but the surface now hashes '$exp_hash'."
    echo "       (a behavior file was edited after the proof was produced — re-run the proof producer.)"; return 1; }

  if [ -n "$at" ]; then
    local at_s now_s age_d
    at_s=$(date -u -d "$at" +%s 2>/dev/null || echo 0)
    now_s=$(date -u +%s)
    if [ "$at_s" -gt 0 ]; then
      age_d=$(( (now_s - at_s) / 86400 ))
      [ "$age_d" -le "$max_age" ] || { echo "  $p: stale (executed ${age_d}d ago > ${max_age}d)"; return 1; }
    fi
  fi

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
    [ "$wf_path" = ".github/workflows/${producer}" ] || { echo "  $p: run ${run_id} is '$wf_path' (want .github/workflows/${producer})"; return 1; }
    [ "$head_repo" = "$repo" ] || { echo "  $p: run ${run_id} head_repository='$head_repo' (want $repo — no foreign runs)"; return 1; }
    _verify_artifact_matches "$repo" "$run_id" "$p" || return 1
    echo "  $p: VALID (result=pass, content_hash matches, run ${run_id} cross-checked)."
  else
    echo "  NOTE: not in CI — skipping the run/artifact cross-check (enforced in the CI gate job)."
    echo "  $p: structurally VALID (result=pass, content_hash matches; run cross-check is CI-only)."
  fi
  return 0
}

ANY_TOUCHED=0
OVERALL_FAIL=0

while IFS= read -r id; do
  [ -n "$id" ] || continue
  TOUCHED=$(e2e_changed_surface_files "$id" "$CHANGED")
  [ -z "$TOUCHED" ] && continue
  ANY_TOUCHED=1
  name_he=$(e2e_surface_get "$id" name_he)
  echo "Surface '${id}' (${name_he}) — behavior-bearing files changed:"
  echo "$TOUCHED" | sed 's/^/  - /'

  proof_glob=$(e2e_surface_get "$id" proof_glob)
  proof_re="^$(_e2e_glob_to_regex "$proof_glob")$"
  PROOFS_IN_DIFF=$(echo "$CHANGED" | grep -E "$proof_re" || true)
  if [ -z "$PROOFS_IN_DIFF" ]; then
    echo "ERROR: שונה קוד-התנהגות של המשטח '${id}' בלי הוכחת E2E אמיתית באותו דיף." >&2
    echo "ERROR: surface '${id}' behavior changed but NO proof matching '${proof_glob}' is in this diff." >&2
    echo "Run its proof producer ($(e2e_surface_get "$id" proof_producer)) against a live system; it drives the" >&2
    echo "surface's REAL behavior, asserts on it, and commits the proof here." >&2
    OVERALL_FAIL=1
    continue
  fi

  exp_hash=$(e2e_surface_hash "$id")
  max_age=$(e2e_surface_get "$id" freshness_days); max_age=${max_age:-14}
  producer=$(e2e_surface_get "$id" proof_producer)
  echo "  expected content_hash: ${exp_hash}"

  valid=0
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if verify_proof "$p" "$exp_hash" "$max_age" "$producer"; then valid=1; break; fi
  done <<< "$PROOFS_IN_DIFF"

  if [ "$valid" -ne 1 ]; then
    echo "ERROR: no valid E2E proof in this diff covers surface '${id}'." >&2
    OVERALL_FAIL=1
  fi
done < <(e2e_enforced_surface_ids)

if [ "$ANY_TOUCHED" -eq 0 ]; then
  echo "PASS: no enforced E2E surface changed — E2E gate is a no-op."
  exit 0
fi
if [ "$OVERALL_FAIL" -ne 0 ]; then
  echo "ERROR: אין הוכחת E2E תקפה לכל המשטחים שהשתנו." >&2
  exit 1
fi
echo "PASS: E2E verification gate — every changed enforced surface has a fresh, real proof."
exit 0
