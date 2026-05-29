#!/usr/bin/env bash
# Fails CI if code changes (.sh / .json / .yml / .yaml) were made without
# a matching changelog update in the same diff.
#
# Satisfied by EITHER:
#   - a touch to CHANGELOG.md (the normal, single-development path), OR
#   - a changelog.d/<YYYY-MM-DD>-<slug>.md fragment (the parallel-development
#     path, written by /dev-stage when another development is active so two
#     parallel PRs never fight over the head of CHANGELOG.md).
# Mirrors how the devplan twin (check-devplan-updated.sh) accepts devplans/*.md.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

CODE_FILES=$(get_code_files "$CHANGED")
if [ -n "$CODE_FILES" ]; then
  if ! echo "$CHANGED" | grep -qE '^(CHANGELOG\.md|changelog\.d/.+\.md)$'; then
    echo "ERROR: Code changes detected but neither CHANGELOG.md nor a changelog.d/ fragment was updated." >&2
    echo "Changed code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  - /' >&2
    echo "Add an entry to CHANGELOG.md (or a changelog.d/<date>-<slug>.md fragment) before merging." >&2
    exit 1
  fi
fi

echo "PASS: Changelog check passed."
