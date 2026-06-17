#!/usr/bin/env bash
# Static golden gate for the agent-repo mould: re-render templates/agent-repo/ and compare
# to the committed golden under tests/golden/agent-repo/. Fails on any drift. Twin of
# scripts/check-system-golden.sh (the twin sync gate in changelog-check.yml forces a golden
# update whenever templates/agent-repo/ changes).
#
#   scripts/check-agent-repo-golden.sh            # compare; exit 1 on drift
#   scripts/check-agent-repo-golden.sh --update   # regenerate the committed golden
#
# Refresh the golden only for a DELIBERATE template change, and commit the diff in the same PR.
set -euo pipefail

GOLDEN_DIR="${GOLDEN_DIR:-tests/golden/agent-repo}"
RENDER="$(cd "$(dirname "$0")" && pwd)/render-agent-repo-golden.sh"

if [ "${1:-}" = "--update" ]; then
  rm -rf "$GOLDEN_DIR"
  mkdir -p "$GOLDEN_DIR"
  bash "$RENDER" "$GOLDEN_DIR"
  echo "agent-repo golden updated at $GOLDEN_DIR — review the diff and commit it."
  exit 0
fi

if [ ! -f "$GOLDEN_DIR/MANIFEST.sha256" ]; then
  echo "FAIL: agent-repo golden manifest missing ($GOLDEN_DIR/MANIFEST.sha256)." >&2
  echo "      run: bash scripts/check-agent-repo-golden.sh --update" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
bash "$RENDER" "$TMP" >/dev/null

rc=0
if ! diff -u "$GOLDEN_DIR/MANIFEST.sha256" "$TMP/MANIFEST.sha256"; then
  echo "FAIL: agent-repo golden manifest drift — templates/agent-repo render changed." >&2
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
  echo "Golden mismatch. If this change to templates/agent-repo is intentional, run:" >&2
  echo "    bash scripts/check-agent-repo-golden.sh --update" >&2
  echo "and commit tests/golden/agent-repo/ in the same PR." >&2
  exit 1
fi

echo "PASS: agent-repo golden matches the templates/agent-repo render."
