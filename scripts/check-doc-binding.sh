#!/usr/bin/env bash
# check-doc-binding.sh — documentation drift prevention, Layer 1.
#
# If a BOUND artifact REALLY changed in this diff, its BOUND doc must be touched
# in the same diff. Catches "you changed the thing but forgot the doc it lives
# in." The bindings are declared in monitoring/doc-bindings.json.
#
# "Really changed" is the key nuance: an n8n workflow JSON is mostly editor
# metadata, so a pure node reposition must NOT demand a doc update. Bound n8n
# artifacts are therefore compared HEAD~1 vs HEAD *after* normalize_n8n
# (scripts/lib/normalize-n8n.sh); other artifacts are compared as raw blobs.
#
# Escape hatch: a legitimate artifact change that needs no doc edit is waived
# with a `doc-waiver: <artifact> — <reason>` line in a changelog.d/ fragment IN
# THIS DIFF (never repo-wide, so a stale waiver can't permanently disable the
# gate). A waiver passes the gate and emits an audit event.
#
# Runs in the "Changelog gates" job (depth-2 checkout; only ever reads HEAD~1).
# Read-only; needs no secrets (the waiver emit soft-fails to a log line when the
# job has no cloud auth — that is by design, see docs/doc-drift-prevention.md).
#
# Exit 0 = every really-changed bound artifact has its doc touched (or waived);
# 1 = an unmet binding or a malformed manifest.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/normalize-n8n.sh
. "${SCRIPT_DIR}/lib/normalize-n8n.sh"

BINDINGS_FILE="${BINDINGS_FILE:-monitoring/doc-bindings.json}"
EXEMPT_FILE="${EXEMPT_FILE:-monitoring/doc-binding-exempt.txt}"

if [ ! -f "$BINDINGS_FILE" ]; then
  echo "PASS: no doc-bindings manifest ($BINDINGS_FILE) — nothing to enforce."
  exit 0
fi
if ! jq empty "$BINDINGS_FILE" 2>/dev/null; then
  echo "ERROR: פנקס הכבילות אינו JSON תקין: $BINDINGS_FILE" >&2
  echo "ERROR: doc-bindings manifest is not valid JSON: $BINDINGS_FILE" >&2
  exit 1
fi

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

is_exempt() {
  [ -f "$EXEMPT_FILE" ] || return 1
  local b; b="$(basename "$1")"
  grep -vE '^[[:space:]]*#' "$EXEMPT_FILE" 2>/dev/null | sed 's#.*/##' | grep -qxF "$b"
}

in_changed() { printf '%s\n' "$CHANGED" | grep -qxF "$1"; }

# really_changed: true if the artifact's content differs HEAD~1 vs HEAD. n8n
# workflows are normalized first so a cosmetic editor diff doesn't count.
really_changed() {
  local path="$1" before after
  case "$path" in
    *workflows/n8n/*.json)
      before=$(git show "HEAD~1:$path" 2>/dev/null | normalize_n8n 2>/dev/null || true)
      after=$(git show "HEAD:$path" 2>/dev/null | normalize_n8n 2>/dev/null || true)
      ;;
    *)
      before=$(git show "HEAD~1:$path" 2>/dev/null || true)
      after=$(git show "HEAD:$path" 2>/dev/null || true)
      ;;
  esac
  [ "$before" != "$after" ]
}

# waiver_line: echo the matching `doc-waiver:` line from a changelog.d fragment
# IN THIS DIFF, or nothing. Scans only diffed fragments (no stale waivers).
waiver_line() {
  local artifact="$1" esc frags f line
  esc=$(printf '%s' "$artifact" | sed 's/[.[\*^$/]/\\&/g')
  frags=$(printf '%s\n' "$CHANGED" | grep -E '^changelog\.d/.+\.md$' || true)
  [ -n "$frags" ] || return 0
  while IFS= read -r f; do
    { [ -n "$f" ] && [ -f "$f" ]; } || continue
    line=$(grep -E "^doc-waiver:[[:space:]]*${esc}([[:space:]]|\$)" "$f" 2>/dev/null | head -1 || true)
    if [ -n "$line" ]; then printf '%s' "$line"; return 0; fi
  done <<< "$frags"
  return 0
}

emit_waiver() { # artifact reason-line
  [ "${DOC_DRIFT_SKIP_EMIT:-0}" = "1" ] && return 0
  bash "${SCRIPT_DIR}/emit-event.sh" \
    --name=factory.doc_drift.waived --severity=warning --layer=factory \
    --workflow=changelog-check.yml --run-id="${GITHUB_RUN_ID:-0}" \
    --body="$(jq -nc --arg a "$1" --arg r "$2" '{artifact:$a, reason:$r}')" || true
}

fail=0
while IFS=$'\t' read -r bid artifact docs_csv; do
  [ -n "${artifact:-}" ] || continue
  is_exempt "$artifact" && continue
  in_changed "$artifact" || continue
  really_changed "$artifact" || continue

  doc_touched=0
  IFS=',' read -ra docs <<< "$docs_csv"
  for d in "${docs[@]}"; do
    [ -n "$d" ] || continue
    if in_changed "$d"; then doc_touched=1; break; fi
  done
  [ "$doc_touched" -eq 1 ] && continue

  wline=$(waiver_line "$artifact")
  if [ -n "$wline" ]; then
    echo "WAIVED: [$bid] $artifact — doc not updated, waiver present: $wline"
    emit_waiver "$artifact" "$wline"
    continue
  fi

  echo "ERROR: [$bid] השתנה ארטיפקט כבול בלי לעדכן את התיעוד שמתאר אותו." >&2
  echo "ERROR: [$bid] a bound artifact really changed but its doc was not updated:" >&2
  echo "  artifact: $artifact" >&2
  echo "  expected one of these docs to be touched: $docs_csv" >&2
  echo "  תקן: עדכן את התיעוד באותו PR — או הוסף לפרגמנט ב-changelog.d/ שורה: 'doc-waiver: $artifact — <סיבה>'." >&2
  echo "  Fix: update the bound doc in this PR, or add a 'doc-waiver: $artifact — <reason>' line to a changelog.d/ fragment (docs/doc-drift-prevention.md)." >&2
  fail=1
done < <(jq -r '.bindings[]? | select(.enforce == true) | . as $b | $b.artifacts[] | [$b.id, ., (($b.docs // []) | join(","))] | @tsv' "$BINDINGS_FILE")

if [ "$fail" -ne 0 ]; then
  echo "doc-binding check FAILED — a bound artifact changed without its doc (see docs/doc-drift-prevention.md)." >&2
  exit 1
fi
echo "PASS: doc-binding check — every really-changed bound artifact has its doc touched (or waived)."
