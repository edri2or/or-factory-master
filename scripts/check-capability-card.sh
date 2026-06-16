#!/usr/bin/env bash
# Capability-card guardrail — the *teeth* behind capability-first.
#
# Enforces (see CLAUDE.md "How to work" + docs/capability-first.md): every OPERABLE
# n8n workflow in the mould that adds a NEW external capability (a verb: read / fill
# / extract / send / parse) must ship with a recorded Phase-1 proof — a Capability
# Card at <CARD_DIR>/<name>.md whose verdict is go/partial — proving the raw
# capability was demonstrated OUTSIDE n8n on a real fixture BEFORE the workflow was
# built. Workflows that add no new external capability (plumbing / crons / sinks /
# routers / thin sub-workflows, and the pre-gate baseline) are listed in
# monitoring/capability-card-exempt.txt and are skipped.
#
# This is the gate the email-form-intake monolith would have hit: a "read a PDF
# form" workflow with no proven, recorded read. It is a structural twin of
# scripts/check-workflow-skill-pair.sh (full-scan + basename exempt list).
#
# Scope: FACTORY-ONLY. The factory CI runs it over the mould
# (WF_DIR=templates/system/workflows/n8n). It is intentionally NOT shipped into
# provisioned systems (systems already get docs/capability-first.md, /prove-
# capability and /build-agent; shipping the gate is a deliberate future option).
# The defaults still describe a system layout so the script is dual-tree-ready.
#
# For each <WF_DIR>/<name>.json that is NOT exempt:
#   1. <CARD_DIR>/<name>.md exists;
#   2. it contains a machine-readable "verdict:" line whose value is go | partial
#      (no-go, missing, or garbled → fail).
set -euo pipefail

WF_DIR="${WF_DIR:-workflows/n8n}"
CARD_DIR="${CARD_DIR:-docs/capability-cards}"
EXEMPT_FILE="${EXEMPT_FILE:-monitoring/capability-card-exempt.txt}"

fail=0

shopt -s nullglob
workflows=( "$WF_DIR"/*.json )
shopt -u nullglob

if [ ${#workflows[@]} -eq 0 ]; then
  echo "PASS: capability-card gate — no workflows found in $WF_DIR (nothing to enforce)."
  exit 0
fi

is_exempt() {
  # Match the file's BASENAME against the exempt list (also basename-reduced),
  # so a factory-pathed list works against a system-pathed workflow.
  [ -f "$EXEMPT_FILE" ] || return 1
  grep -vE '^[[:space:]]*#' "$EXEMPT_FILE" \
    | sed 's#.*/##' \
    | grep -qxF "$(basename "$1")"
}

verdict_of() {
  # Echo the lowercased verdict (go|no-go|partial) found on a "verdict:" line in
  # the card, or empty if none/garbled. Tolerates leading markdown (*, _, >, -).
  local card="$1" line val
  line=$(grep -iE '(^|[[:space:]>*_-])verdict:' "$card" 2>/dev/null | head -1 || true)
  [ -n "$line" ] || { printf ''; return 0; }
  val=$(printf '%s' "$line" \
    | sed -E 's/.*[Vv][Ee][Rr][Dd][Ii][Cc][Tt]:[[:space:]]*[*_> -]*//' \
    | tr '[:upper:]' '[:lower:]' \
    | grep -oE '^(no-go|partial|go)' || true)
  printf '%s' "$val"
}

checked=0
for wf in "${workflows[@]}"; do
  base="$(basename "$wf")"
  name="${base%.json}"

  # agents.manifest is data, not an automation; exempt via the list + hard-skip.
  [ "$name" = "agents.manifest" ] && continue
  is_exempt "$wf" && continue

  checked=$((checked + 1))

  # 1. the Capability Card must exist
  card="$CARD_DIR/$name.md"
  if [ ! -f "$card" ]; then
    echo "ERROR: $base — חסר Capability Card ב-$card. הוכח קודם את היכולת הגולמית מחוץ ל-n8n (/prove-capability, docs/capability-first.md), או הוסף ל-$EXEMPT_FILE אם אין יכולת-חוץ חדשה." >&2
    echo "ERROR: $base has no Capability Card at $card — prove the raw capability outside n8n first (/prove-capability, docs/capability-first.md), or add it to $EXEMPT_FILE if it adds no new external capability." >&2
    fail=1
    continue
  fi

  # 2. the card's verdict must be go | partial
  verdict="$(verdict_of "$card")"
  case "$verdict" in
    go|partial)
      : ;;
    no-go)
      echo "ERROR: $base — ה-Capability Card הכריע 'no-go' ($card): יכולת שהוכחה כלא-ישימה לא אמורה להישלח. שנה-סקופ ל-partial/go או אל תשלח." >&2
      echo "ERROR: $base ships with a 'no-go' Capability Card ($card) — a capability proven infeasible must not ship. Re-scope to partial/go, or don't ship it." >&2
      fail=1
      continue ;;
    *)
      echo "ERROR: $base — שורת ההכרעה ב-$card חסרה/לא-תקינה. נדרש 'verdict: go|partial|no-go' (ראה docs/capability-cards/README.md)." >&2
      echo "ERROR: $card is missing a valid 'verdict:' line — need 'verdict: go|partial|no-go' (see docs/capability-cards/README.md)." >&2
      fail=1
      continue ;;
  esac
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "capability-card check FAILED — every non-exempt workflow in $WF_DIR needs $CARD_DIR/<name>.md with a go/partial verdict (capability-first; see docs/capability-cards/README.md)." >&2
  exit 1
fi

echo "PASS: capability-card gate — $checked non-exempt workflow(s) in $WF_DIR each have a go/partial Capability Card in $CARD_DIR."
