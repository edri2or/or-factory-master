#!/usr/bin/env bash
# Fails CI if code changes (.sh / .json / .yml / .yaml) were made while a
# development is active — a root DEVPLAN.md (or a devplans/*.md) carrying
# `status: active` — without touching at least one devplan file in the same diff.
#
# Twin of check-changelog-updated.sh (same shape: "code changed ⇒ a tracking
# file must be touched"): it gives the /dev-stage flow its teeth. When no plan
# is active it is a no-op, so it never affects ordinary factory work. Detection
# is path-scoped on purpose (only DEVPLAN.md / devplans/*.md) so the seed
# template under templates/devplan/ — which also carries `status: active` —
# never triggers the gate.
#
# Parallel-development support: collects ALL active plans (so enforcement is not
# silently lost when multiple developments run simultaneously), and credits a
# touch of ANY devplan file — active or just-closed — as the progress signal, so
# closing one plan in a code PR while another stays active no longer mis-fires.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

# OIL auto-fix PRs (branch oil-autofix/*) are EXEMPT: they are automated, safety-gated
# fixes — not dev stages — so they correctly never touch a devplan, and the gate must not
# block them even while a development is active (this is how OIL-49 stalled — follow-up #9).
# Factory template-refresh PRs (branch refresh-system-*, opened by refresh-system-agents.yml)
# are EXEMPT for the SAME reason: an automated sync of the factory's current templates into a
# live system is not a /dev-stage development stage, so it correctly never touches a devplan —
# yet on a system carrying active devplans the gate would otherwise block the refresh merge
# forever (the request-factory-resource backfill to or-aios stalled exactly here). The refresh
# already ships a changelog.d fragment to satisfy the twin CHANGELOG gate; this is its devplan
# twin. GitHub sets GITHUB_HEAD_REF on pull_request (the source branch) and GITHUB_REF_NAME on
# push; either identifies the branch without any workflow change.
BRANCH="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
case "$BRANCH" in
  oil-autofix/*)
    echo "PASS: oil-autofix branch ('$BRANCH') — devplan check skipped (automated safety-gated fix)."
    exit 0
    ;;
  refresh-system-*)
    echo "PASS: factory template-refresh branch ('$BRANCH') — devplan check skipped (automated refresh from or-factory-master, not a dev stage)."
    exit 0
    ;;
esac

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# Collect ALL active development plans (not just the first).
ACTIVE_PLANS=()
for f in DEVPLAN.md devplans/*.md; do
  [ -f "$f" ] || continue
  if grep -qE '^status:[[:space:]]*active([[:space:]]|$)' "$f"; then
    ACTIVE_PLANS+=("$f")
  fi
done

if [ ${#ACTIVE_PLANS[@]} -eq 0 ]; then
  echo "PASS: no active DEVPLAN — devplan check skipped."
  exit 0
fi

CODE_FILES=$(get_code_files "$CHANGED")
if [ -n "$CODE_FILES" ]; then
  # A valid progress signal is that the diff TOUCHED at least one devplan file
  # (root DEVPLAN.md or a devplans/*.md) — whether that plan ended this change
  # still `active` or was flipped to `completed`. Closing a plan IS progress, so
  # a PR that closes plan A while an untouched plan B stays active no longer trips
  # the gate (the multi-development closing-while-parallel case). This is the
  # structural twin of check-changelog-updated.sh; the path-scoping mirrors the
  # active-plan scan above (templates/devplan/ never counts).
  if ! echo "$CHANGED" | grep -qE '^(DEVPLAN\.md|devplans/[^/]+\.md)$'; then
    PLANS_LIST=$(printf '%s\n' "${ACTIVE_PLANS[@]}" | sed 's/^/  - /')
    echo "ERROR: פיתוח פעיל זוהה — שונה קוד בלי לגעת באף תוכנית פיתוח (עדכון או סגירה) באותו דיף." >&2
    echo "ERROR: Active development(s) detected but no devplan file was touched in this diff." >&2
    echo "Active plans:" >&2
    echo "$PLANS_LIST" >&2
    echo "Changed code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  - /' >&2
    echo "Touch at least one devplan (DEVPLAN.md or devplans/*.md) in the same change — update its progress, or set status: completed to close it." >&2
    exit 1
  fi
fi

PLANS_STR=$(printf '%s, ' "${ACTIVE_PLANS[@]}" | sed 's/, $//')
echo "PASS: devplan check passed (active plan(s): $PLANS_STR)."
