#!/usr/bin/env bash
# Fails CI if CHANGELOG.md grows past MAX_BYTES. Rotate older entries to
# docs/changelog-archive/ when the cap is reached.
set -euo pipefail

CHANGELOG="CHANGELOG.md"
MAX_BYTES=20480  # 20KB

if [ ! -f "$CHANGELOG" ]; then
  echo "SKIP: $CHANGELOG not found."
  exit 0
fi

BYTES=$(wc -c < "$CHANGELOG")

if [ "$BYTES" -gt "$MAX_BYTES" ]; then
  echo "ERROR: CHANGELOG.md is ${BYTES} bytes — exceeds ${MAX_BYTES} bytes." >&2
  echo "Move older entries to docs/changelog-archive/ to keep the file scannable." >&2
  exit 1
fi

echo "PASS: CHANGELOG.md is ${BYTES} bytes (limit: ${MAX_BYTES} bytes)."
