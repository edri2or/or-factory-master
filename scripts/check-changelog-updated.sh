#!/usr/bin/env bash
# Fails CI if code changes (.sh / .json / .yml / .yaml) were made without
# a matching CHANGELOG.md update in the same diff.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

CODE_FILES=$(get_code_files "$CHANGED")
if [ -n "$CODE_FILES" ]; then
  if ! echo "$CHANGED" | grep -q '^CHANGELOG\.md$'; then
    echo "ERROR: Code changes detected but CHANGELOG.md not updated." >&2
    echo "Changed code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  - /' >&2
    echo "Add an entry to CHANGELOG.md before merging." >&2
    exit 1
  fi
fi

echo "PASS: Changelog check passed."
