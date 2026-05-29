#!/usr/bin/env bash
# Fails CI if code changes (.sh / .json / .yml / .yaml) were made while a
# development is active — a root DEVPLAN.md (or a devplans/*.md) carrying
# `status: active` — without updating at least one active plan in the same diff.
#
# Twin of check-changelog-updated.sh: it gives the /dev-stage flow its teeth.
# When no plan is active it is a no-op, so it never affects ordinary factory
# work. Detection is path-scoped on purpose (only DEVPLAN.md / devplans/*.md)
# so the seed template under templates/devplan/ — which also carries
# `status: active` — never triggers the gate.
#
# Parallel-development support: collects ALL active plans so enforcement is
# not silently lost when multiple developments run simultaneously.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

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
  # At least one active plan must have been updated in this diff.
  PLAN_UPDATED=0
  for plan in "${ACTIVE_PLANS[@]}"; do
    if echo "$CHANGED" | grep -qxF "$plan"; then
      PLAN_UPDATED=1
      break
    fi
  done

  if [ "$PLAN_UPDATED" -eq 0 ]; then
    PLANS_LIST=$(printf '%s\n' "${ACTIVE_PLANS[@]}" | sed 's/^/  - /')
    echo "ERROR: פיתוח פעיל זוהה — שונה קוד בלי לעדכן אף אחת מתוכניות הפיתוח הפעילות." >&2
    echo "ERROR: Active development(s) detected but none were updated in this diff." >&2
    echo "Active plans:" >&2
    echo "$PLANS_LIST" >&2
    echo "Changed code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  - /' >&2
    echo "Update at least one active plan in the same change before merging (or set status: completed to close it)." >&2
    exit 1
  fi
fi

PLANS_STR=$(printf '%s, ' "${ACTIVE_PLANS[@]}" | sed 's/, $//')
echo "PASS: devplan check passed (active plan(s): $PLANS_STR)."
