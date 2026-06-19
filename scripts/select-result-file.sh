#!/usr/bin/env bash
# Fix 4 — corr-strict result selection. The broker downloads the worker's `agent-result`
# artifact into <dl-dir>/; the worker names its file `result/<correlation_id>.json`, so the
# broker must use EXACTLY <dl-dir>/<corr>.json. The old fallback ("first *.json found") meant
# that if the broker ever polled the WRONG worker run (a concurrent dispatch to the same worker
# repo), it would write THAT run's result under THIS correlation_id — a silent task/result
# mismatch. This refuses the fallback: a missing corr-named file is a LOUD failure, never a
# wrong write. (Belt-and-suspenders for the high-water-mark run discovery — even if discovery
# grabbed the wrong run, this guarantees we never write a mismatched result.)
#
# Prints the resolved path on success (exit 0); prints an error to stderr and exits 1 otherwise.
# Usage: select-result-file.sh <dl-dir> <correlation_id>
set -uo pipefail

DL_DIR="${1:-}"
CORR="${2:-}"

if [ -z "$DL_DIR" ] || [ -z "$CORR" ]; then
  echo "select-result-file: usage: select-result-file.sh <dl-dir> <correlation_id>" >&2
  exit 1
fi

RESULT_FILE="${DL_DIR}/${CORR}.json"
if [ ! -f "$RESULT_FILE" ]; then
  found=$(find "$DL_DIR" -maxdepth 1 -name '*.json' -printf '%f ' 2>/dev/null || true)
  echo "select-result-file: expected ${RESULT_FILE} in the artifact (corr-strict — no first-json fallback). Found: ${found:-<none>}" >&2
  exit 1
fi

printf '%s\n' "$RESULT_FILE"
exit 0
