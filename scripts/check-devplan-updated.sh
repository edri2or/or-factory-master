#!/usr/bin/env bash
# Fails CI if code changes (.sh / .json / .yml / .yaml) were made while a
# development is active — a root DEVPLAN.md (or a devplans/*.md) carrying
# `status: active` — without updating that plan in the same diff.
#
# Twin of check-changelog-updated.sh: it gives the /dev-stage flow its teeth.
# When no plan is active it is a no-op, so it never affects ordinary factory
# work. Detection is path-scoped on purpose (only DEVPLAN.md / devplans/*.md)
# so the seed template under templates/devplan/ — which also carries
# `status: active` — never triggers the gate.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# Find an active development plan, if any.
ACTIVE_PLAN=""
for f in DEVPLAN.md devplans/*.md; do
  [ -f "$f" ] || continue
  if grep -qE '^status:[[:space:]]*active([[:space:]]|$)' "$f"; then
    ACTIVE_PLAN="$f"
    break
  fi
done

if [ -z "$ACTIVE_PLAN" ]; then
  echo "PASS: no active DEVPLAN — devplan check skipped."
  exit 0
fi

CODE_FILES=$(get_code_files "$CHANGED")
if [ -n "$CODE_FILES" ]; then
  if ! echo "$CHANGED" | grep -qxF "$ACTIVE_PLAN"; then
    echo "ERROR: פיתוח פעיל זוהה ($ACTIVE_PLAN) — שונה קוד בלי לעדכן את תוכנית הפיתוח." >&2
    echo "ERROR: Active development detected ($ACTIVE_PLAN) but it was not updated in this diff." >&2
    echo "Changed code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  - /' >&2
    echo "Update $ACTIVE_PLAN in the same change before merging (or set status: completed to close it)." >&2
    exit 1
  fi
fi

echo "PASS: devplan check passed (active plan: $ACTIVE_PLAN)."
