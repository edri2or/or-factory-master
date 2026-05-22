#!/usr/bin/env bash
# Forbids permissions: write-all in any workflow. Workflow-level grants must
# enumerate specific permissions instead of granting all writes at once.
set -euo pipefail

FAIL=0
WORKFLOW_DIR=".github/workflows"

[ -d "$WORKFLOW_DIR" ] || { echo "No workflows dir. Skipping."; exit 0; }

for workflow in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [ -f "$workflow" ] || continue
  if grep -qE '^\s*permissions:\s*write-all' "$workflow"; then
    echo "FAIL: $workflow — permissions: write-all is forbidden"
    FAIL=1
  fi
done

[ $FAIL -eq 0 ] && echo "PASS: No write-all permissions found." || exit 1
