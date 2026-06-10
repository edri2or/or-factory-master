#!/usr/bin/env bash
# executeWorkflow-published guardrail for the n8n workflow templates.
#
# Enforces an n8n 2.x publication invariant proven live (factory-test-053,
# async-deep-research): a PUBLISHED workflow that calls a sub-workflow via an
# `executeWorkflow` node (a MAIN connection) cannot itself be published while
# that sub-workflow is unpublished — n8n refuses with HTTP 400. The symptom is
# silent: the parent simply stays inactive (e.g. tg-inbound never activated, so
# the Telegram bot never responded), and CI is green on it. Sub-workflows called
# via `toolWorkflow` (an ai_tool connection, e.g. request_write_action) are
# EXEMPT — they do not need publishing — which is why the sub-agents activated
# fine while tg-inbound did not.
#
# This gate makes the right way the only way: any `executeWorkflow` reference
# whose target sub-workflow is installed UNPUBLISHED (`_upsert_wf … no`) fails
# CI here, before a system is provisioned, instead of breaking the bot at birth.
#
# How it checks (purely static): for every `executeWorkflow` node across
# $WF_DIR/*.json it reads the workflowId placeholder (e.g. @@WF_TG_VISION_ID@@),
# resolves it to the shell var via configure's `s#@@…@@#${VAR}#g` substitution,
# and fails if configure assigns that var from an `_upsert_wf … no` call. The
# five sub-agents are published inside a loop (no direct `VAR=$(_upsert_wf …)`
# assignment), so absence of a `… no` assignment is a pass — exactly correct.
#
# WF_DIR selects which tree to check (default: the system layout). The factory
# CI runs it with WF_DIR=templates/system/workflows/n8n + the matching
# CONFIGURE_FILE to validate the mould.
set -euo pipefail

WF_DIR="${WF_DIR:-workflows/n8n}"
CONFIGURE_FILE="${CONFIGURE_FILE:-.github/workflows/configure-agent-router.yml}"
fail=0
ref_count=0

if [ ! -f "$CONFIGURE_FILE" ]; then
  echo "ERROR: CONFIGURE_FILE '$CONFIGURE_FILE' not found — cannot verify publish state." >&2
  exit 1
fi

shopt -s nullglob
wfs=( "$WF_DIR"/*.json )
shopt -u nullglob

if [ ${#wfs[@]} -eq 0 ]; then
  echo "PASS: executeWorkflow-published check — no workflow JSONs in $WF_DIR (nothing to enforce)."
  exit 0
fi

# Collect every executeWorkflow (MAIN) sub-call placeholder across all workflows.
placeholders=""
for f in "${wfs[@]}"; do
  jq empty "$f" 2>/dev/null || { echo "ERROR: $(basename "$f") — JSON לא תקין (invalid JSON)." >&2; fail=1; continue; }
  vals=$(jq -r '[.nodes[]? | select(.type=="n8n-nodes-base.executeWorkflow") | .parameters.workflowId.value // empty] | .[]' "$f")
  while IFS= read -r v; do
    [ -z "$v" ] && continue
    case "$v" in
      @@*@@) placeholders="${placeholders}${v}"$'\n'; ref_count=$((ref_count + 1)) ;;
      *) ;;  # a literal id (not a template placeholder) — nothing to verify
    esac
  done <<EOF
$vals
EOF
done

uniq_placeholders=$(printf '%s' "$placeholders" | sort -u | sed '/^$/d')

while IFS= read -r ph; do
  [ -z "$ph" ] && continue
  inner="${ph#@@}"; inner="${inner%@@}"

  # Resolve the placeholder to the shell var via configure's sed substitution.
  map_line=$(grep -F "s#@@${inner}@@#" "$CONFIGURE_FILE" | head -1 || true)
  if [ -z "$map_line" ]; then
    echo "ERROR: ${ph} — קריאת executeWorkflow ללא מיפוי החלפה ב-${CONFIGURE_FILE} (placeholder לא מוחלף → workflowId ריק)." >&2
    echo "ERROR: ${ph} is referenced by an executeWorkflow node but has no 's#@@…@@#\${VAR}#g' substitution in ${CONFIGURE_FILE}." >&2
    fail=1
    continue
  fi
  # Substitution value is ${VAR} or ${VAR:-default} — capture the var name, ignoring any :- modifier.
  var=$(printf '%s' "$map_line" | sed -E 's/.*s#@@'"${inner}"'@@#\$\{([A-Za-z_][A-Za-z0-9_]*)(:-[^}]*)?\}#g.*/\1/')
  if ! printf '%s' "$var" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "ERROR: ${ph} — לא הצלחתי לחלץ את שם המשתנה מהמיפוי ב-${CONFIGURE_FILE} ('${map_line}')." >&2
    echo "ERROR: ${ph} substitution target is not a plain \${VAR} in ${CONFIGURE_FILE}." >&2
    fail=1
    continue
  fi

  # The core invariant: an executeWorkflow-referenced sub must NOT be installed
  # unpublished. A direct `VAR=$(_upsert_wf "…" <file> no)` is the proven bug.
  if grep -qE "${var}=\\\$\\(_upsert_wf .* no\\)" "$CONFIGURE_FILE"; then
    echo "ERROR: ${ph} (→ \${${var}}) — תת-workflow שנקרא דרך executeWorkflow מותקן לא-מפורסם (_upsert_wf … no)." >&2
    echo "ERROR: ${ph} is called via executeWorkflow but installed unpublished (\`${var}=\$(_upsert_wf … no)\`) — n8n 2.x will refuse to publish the parent (HTTP 400). Install it with 'yes'." >&2
    fail=1
  fi
done <<EOF
$uniq_placeholders
EOF

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "executeWorkflow-published check FAILED — a published parent references an unpublished executeWorkflow sub (n8n 2.x). Publish the sub (_upsert_wf … yes), as done for tg-vision/tg-voice-stt/pending-actions-executor." >&2
  exit 1
fi

echo "PASS: executeWorkflow-published check — ${ref_count} executeWorkflow reference(s) in $WF_DIR all resolve to published sub-workflows."
