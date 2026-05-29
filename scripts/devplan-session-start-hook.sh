#!/usr/bin/env bash
# SessionStart hook for the /dev-stage mechanism (factory-only; registered in
# .claude/settings.json). When one or more development plans are active, it prints a
# concise status block to stdout — Claude Code injects SessionStart stdout into the
# session context, so the agent re-orients on a fresh session AND after compaction
# (source=compact). When no plan is active it prints nothing, so ordinary factory
# sessions are completely unaffected.
#
# Detection mirrors scripts/check-devplan-updated.sh exactly: path-scoped to a root
# DEVPLAN.md (legacy) + devplans/*.md (current convention), matching `status: active`
# on the value only (so the templates/devplan/ seed — whose status comment contains
# the word "active" — never triggers it), and it reports ALL active plans (parallel
# developments are supported).
#
# Safety: this runs at the start of every session, so it must NEVER break or stall one.
# It is strictly read-only, fast, and uses `trap 'exit 0' EXIT` to guarantee a clean
# exit no matter what (intentionally NO `set -e`).
trap 'exit 0' EXIT

active=()
for f in DEVPLAN.md devplans/*.md; do
  [ -f "$f" ] || continue
  grep -qE '^status:[[:space:]]*active([[:space:]]|$)' "$f" 2>/dev/null && active+=("$f")
done

# No active development plan → stay silent (zero context noise for normal work).
[ "${#active[@]}" -eq 0 ] && exit 0

echo "[dev-stage] ${#active[@]} active development plan(s) — you are mid-development via /dev-stage:"
for f in "${active[@]}"; do
  name=$(grep -m1 -E '^dev_name:' "$f" 2>/dev/null | sed -E 's/^dev_name:[[:space:]]*//')
  done_n=$(grep -cE '\|[[:space:]]*completed[[:space:]]*\|' "$f" 2>/dev/null || true)
  prog_n=$(grep -cE '\|[[:space:]]*in-progress[[:space:]]*\|' "$f" 2>/dev/null || true)
  pend_n=$(grep -cE '\|[[:space:]]*pending[[:space:]]*\|' "$f" 2>/dev/null || true)
  cur=$(awk -F'|' 'NF>=5 && $4 ~ /in-progress/ {gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3; exit}' "$f" 2>/dev/null)
  line="  • ${name:-untitled} ($f) — completed:${done_n:-0} in-progress:${prog_n:-0} pending:${pend_n:-0}"
  [ -n "${cur:-}" ] && line="$line; current stage: $cur"
  echo "$line"
done
echo "[dev-stage] Keep the relevant plan current (stage status + progress note + Or-facing journal), write each stage's changelog to changelog.d/<date>-<slug>.md (never the head of CHANGELOG.md), and report to Or in plain Hebrew. Run /dev-status for an on-demand summary."
