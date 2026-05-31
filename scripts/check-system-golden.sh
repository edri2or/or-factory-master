#!/usr/bin/env bash
# Static golden gate: re-render the system template mould and compare it to the
# committed golden under tests/golden/system/. Fails on any drift — the visible
# half of the anti-drift mechanism (the twin CI gate in changelog-check.yml
# forces a golden update whenever templates/system changes).
#
#   scripts/check-system-golden.sh            # compare; exit 1 on drift
#   scripts/check-system-golden.sh --update   # regenerate the committed golden
#
# Refresh the golden only for a DELIBERATE template change, and commit the diff
# in the same PR so a human reviews it.
set -euo pipefail

GOLDEN_DIR="${GOLDEN_DIR:-tests/golden/system}"
RENDER="$(cd "$(dirname "$0")" && pwd)/render-system-golden.sh"

if [ "${1:-}" = "--update" ]; then
  rm -rf "$GOLDEN_DIR"
  mkdir -p "$GOLDEN_DIR"
  bash "$RENDER" "$GOLDEN_DIR"
  echo "golden updated at $GOLDEN_DIR — review the diff and commit it."
  exit 0
fi

if [ ! -f "$GOLDEN_DIR/MANIFEST.sha256" ]; then
  echo "FAIL: golden manifest missing ($GOLDEN_DIR/MANIFEST.sha256)." >&2
  echo "      run: bash scripts/check-system-golden.sh --update" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
bash "$RENDER" "$TMP" >/dev/null

rc=0
if ! diff -u "$GOLDEN_DIR/MANIFEST.sha256" "$TMP/MANIFEST.sha256"; then
  echo "FAIL: system golden manifest drift — templates/system render changed." >&2
  rc=1
fi
for f in rendered/AGENTS.md rendered/CLAUDE.md; do
  if ! diff -u "$GOLDEN_DIR/$f" "$TMP/$f"; then
    echo "FAIL: rendered $f drift." >&2
    rc=1
  fi
done

if [ "$rc" -ne 0 ]; then
  echo "" >&2
  echo "Golden mismatch. If this change to templates/system is intentional, run:" >&2
  echo "    bash scripts/check-system-golden.sh --update" >&2
  echo "and commit tests/golden/system/ in the same PR." >&2
  exit 1
fi

echo "PASS: system golden matches the templates/system render."
