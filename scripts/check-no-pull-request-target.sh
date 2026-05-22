#!/usr/bin/env bash
# Forbids pull_request_target: trigger anywhere under .github/workflows/.
# That trigger gives PR code access to repo secrets; must use pull_request only.
set -euo pipefail

FAIL=0
WORKFLOW_DIR=".github/workflows"

[ -d "$WORKFLOW_DIR" ] || { echo "No workflows dir. Skipping."; exit 0; }

for workflow in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [ -f "$workflow" ] || continue
  # Match only as a trigger declaration (pull_request_target:), not in step names or comments
  if grep -qE '^\s+pull_request_target:|^  pull_request_target:' "$workflow"; then
    echo "FAIL: $workflow — pull_request_target trigger is forbidden (use pull_request)"
    FAIL=1
  fi
done

[ $FAIL -eq 0 ] && echo "PASS: No pull_request_target triggers found." || exit 1
