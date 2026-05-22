#!/usr/bin/env bash
# Fails if any pull_request-triggered workflow requests id-token: write.
# A WIF-capable token in a PR workflow is exploitable from a fork PR.
set -euo pipefail

FAIL=0
WORKFLOW_DIR=".github/workflows"

[ -d "$WORKFLOW_DIR" ] || { echo "No workflows dir. Skipping."; exit 0; }

for workflow in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [ -f "$workflow" ] || continue
  if grep -q 'pull_request:' "$workflow" || grep -qE 'on:\s*pull_request' "$workflow"; then
    # Skip YAML comment lines (`# id-token: write` in prose).
    if grep -qE '^[^#]*id-token:\s+write' "$workflow"; then
      echo "FAIL: $workflow — pull_request workflow has id-token: write (forbidden)"
      FAIL=1
    fi
  fi
done

[ $FAIL -eq 0 ] && echo "PASS: No privileged pull_request workflows found." || exit 1
