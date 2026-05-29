#!/usr/bin/env bash
# Checks that all third-party GitHub Actions are pinned to full-length commit SHAs.
set -euo pipefail

FAIL=0
WORKFLOW_DIR=".github/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "No workflows directory found. Skipping."
  exit 0
fi

for workflow in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [ -f "$workflow" ] || continue
  while IFS= read -r line; do
    # Match "uses: owner/repo@ref" lines in BOTH forms — the step form
    # "      - uses: owner/repo@ref" (list-item dash) and the reusable-workflow
    # caller form "    uses: owner/repo@ref" (no dash). Skip local actions
    # (uses: ./...). The optional "(-\s+)?" is what lets the common step form
    # be inspected at all; without it the leading-whitespace anchor only ever
    # matched the dash-less caller form.
    if echo "$line" | grep -qE '^\s+(-\s+)?uses:\s+[^.][^/]+/'; then
      ref=$(echo "$line" | sed -E 's/.*uses:\s+[^@]+@([^ #]+).*/\1/')
      # A full-length commit SHA is exactly 40 hex characters
      if ! echo "$ref" | grep -qE '^[0-9a-f]{40}$'; then
        echo "FAIL: $workflow — unpinned action: $(echo "$line" | xargs)"
        FAIL=1
      fi
    fi
  done < "$workflow"
done

if [ $FAIL -eq 0 ]; then
  echo "PASS: All third-party actions are pinned to full-length commit SHAs."
  exit 0
else
  echo ""
  echo "FAIL: Unpinned actions found. Pin all third-party actions to full-length commit SHAs to mitigate supply-chain attacks (tag/branch refs can be rewritten by the action author)."
  exit 1
fi
