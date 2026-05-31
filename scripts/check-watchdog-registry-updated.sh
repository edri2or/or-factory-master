#!/usr/bin/env bash
# Fails CI when a PR adds or removes a MONITORABLE SURFACE — a GitHub Actions
# workflow (.github/workflows/*.yml), an n8n workflow template
# (templates/system/workflows/n8n/*.json), or a hook script — without updating
# the watchdog registry (monitoring/watchdog-registry.json) in the same diff.
#
# Twin of scripts/check-devplan-updated.sh: it gives the meta-monitoring
# watchdog its teeth, so a new automation can never silently escape coverage.
# Only structural ADD / DELETE / RENAME of a surface trips the gate — a plain
# edit (status M) to an existing workflow does NOT (that would be friction with
# no monitoring benefit). Surfaces deliberately left unmonitored are listed in
# monitoring/registry-exempt.txt (one-shots, internal verifiers, manual tools).
set -euo pipefail

REGISTRY="monitoring/watchdog-registry.json"
EXEMPT_FILE="monitoring/registry-exempt.txt"

# Surfaces the watchdog can monitor (and therefore must register).
is_surface() {
  case "$1" in
    .github/workflows/*.yml)            return 0 ;;
    templates/system/workflows/n8n/*.json) return 0 ;;
    .claude/hooks/*.sh)                 return 0 ;;
    scripts/*-hook.sh)                  return 0 ;;
    *) return 1 ;;
  esac
}

is_exempt() {
  [ -f "$EXEMPT_FILE" ] || return 1
  grep -vE '^[[:space:]]*#' "$EXEMPT_FILE" | grep -qxF "$1"
}

CHANGED_STATUS=$(git diff --name-status HEAD~1 HEAD 2>/dev/null || echo "")
CHANGED_NAMES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# Collect surfaces structurally added/removed/renamed in this diff.
TRIGGERS=()
while IFS=$'\t' read -r status rest; do
  [ -n "$status" ] || continue
  case "${status:0:1}" in
    A|D|R) ;;        # add / delete / rename touch the surface set
    *) continue ;;
  esac
  # `rest` holds one path (A/D) or two tab-separated paths (R: old<TAB>new).
  for path in $rest; do
    is_surface "$path" || continue
    is_exempt "$path"  && continue
    TRIGGERS+=("$path")
  done
done <<< "$CHANGED_STATUS"

if [ ${#TRIGGERS[@]} -eq 0 ]; then
  echo "PASS: no monitorable surface added/removed — watchdog registry check skipped."
  exit 0
fi

if echo "$CHANGED_NAMES" | grep -qxF "$REGISTRY"; then
  echo "PASS: monitorable surface change detected and the watchdog registry was updated."
  exit 0
fi

TRIGGER_LIST=$(printf '%s\n' "${TRIGGERS[@]}" | sort -u | sed 's/^/  - /')
echo "ERROR: נוספה/נמחקה אוטומציה ניתנת-לניטור בלי לעדכן את פנקס השומר." >&2
echo "ERROR: A monitorable automation was added/removed but ${REGISTRY} was not updated in this diff." >&2
echo "Surfaces that changed:" >&2
echo "$TRIGGER_LIST" >&2
echo "Fix: add/remove the matching entry in ${REGISTRY}, OR list the path in ${EXEMPT_FILE} if it is deliberately unmonitored." >&2
exit 1
