#!/usr/bin/env bash
# Workflow <-> Claude-skill pairing guardrail.
#
# Enforces the convention (see CLAUDE.md / docs/CAPABILITIES.md): every OPERABLE
# n8n workflow the factory ships into a system gets a paired Claude skill at
# <SKILL_DIR>/<name>/SKILL.md — the folder name IS the /<name> slash command — so
# each system is born self-describing. Pure-plumbing workflows (crons, sinks,
# one-shots, media sub-workflows, the agents manifest) are listed in
# monitoring/workflow-skill-exempt.txt and are skipped.
#
# A new operable workflow with no skill fails CI here (run scripts/gen-workflow-
# skill.sh to author the pair, or add it to the exempt list if it is pure
# plumbing) instead of shipping an undocumented capability.
#
# For each <WF_DIR>/<name>.json that is NOT exempt:
#   1. <name> is a valid skill folder name (lowercase, no double/trailing hyphen,
#      no "claude"/"anthropic");
#   2. <name> does not collide with an existing command in <CMD_DIR>;
#   3. <SKILL_DIR>/<name>/SKILL.md exists;
#   4. its frontmatter declares name: + description:, and name == folder == workflow.
#
# Dual-tree: WF_DIR selects which tree to check. The factory CI runs it over the
# mould (WF_DIR=templates/system/workflows/n8n); inside a provisioned system it
# defaults to the system layout (WF_DIR=workflows/n8n). The exempt list is matched
# by BASENAME, so the one factory-pathed file is authoritative in both trees.
set -euo pipefail

WF_DIR="${WF_DIR:-workflows/n8n}"
SKILL_DIR="${SKILL_DIR:-.claude/skills}"
CMD_DIR="${CMD_DIR:-$(dirname "$SKILL_DIR")/commands}"
EXEMPT_FILE="${EXEMPT_FILE:-monitoring/workflow-skill-exempt.txt}"

fail=0

shopt -s nullglob
workflows=( "$WF_DIR"/*.json )
shopt -u nullglob

if [ ${#workflows[@]} -eq 0 ]; then
  echo "PASS: workflow↔skill pairing — no workflows found in $WF_DIR (nothing to enforce)."
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

valid_name() {
  case "$1" in
    *--*|-*|*-) return 1 ;;
    *claude*|*anthropic*) return 1 ;;
  esac
  [[ "$1" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]
}

checked=0
for wf in "${workflows[@]}"; do
  base="$(basename "$wf")"
  name="${base%.json}"

  # agents.manifest is exempt via the list; hard-skip too (belt and braces).
  [ "$name" = "agents.manifest" ] && continue
  is_exempt "$wf" && continue

  checked=$((checked + 1))

  # 1. valid skill folder name
  if ! valid_name "$name"; then
    echo "ERROR: $base — שם workflow לא חוקי לתיקיית skill ('$name'): אותיות קטנות, בלי מקף כפול/סופי, בלי 'claude'/'anthropic'." >&2
    echo "ERROR: $base has an invalid skill folder name ('$name') — lowercase, no double/trailing hyphen, no 'claude'/'anthropic'." >&2
    fail=1
    continue
  fi

  # 2. no collision with an existing command of the same name
  if [ -f "$CMD_DIR/$name.md" ]; then
    echo "ERROR: $base — השם '$name' מתנגש בפקודה קיימת ב-$CMD_DIR/$name.md." >&2
    echo "ERROR: skill name '$name' collides with an existing command at $CMD_DIR/$name.md." >&2
    fail=1
    continue
  fi

  # 3. paired SKILL.md must exist
  skill="$SKILL_DIR/$name/SKILL.md"
  if [ ! -f "$skill" ]; then
    echo "ERROR: $base — חסר skill מותאם ב-$skill." >&2
    echo "ERROR: $base has no paired skill at $skill (run scripts/gen-workflow-skill.sh, or add the workflow to $EXEMPT_FILE if it is pure plumbing)." >&2
    fail=1
    continue
  fi

  # 4. frontmatter: name: + description:, and name == folder == workflow
  fm_name=$(awk '/^---[[:space:]]*$/{n++; next} n==1 && /^name:[[:space:]]*/{sub(/^name:[[:space:]]*/,""); gsub(/[[:space:]]*$/,""); print; exit}' "$skill")
  has_desc=$(awk '/^---[[:space:]]*$/{n++; next} n==1 && /^description:[[:space:]]*/{print "y"; exit}' "$skill")
  if [ -z "$fm_name" ] || [ -z "$has_desc" ]; then
    echo "ERROR: $name — frontmatter חייב לכלול גם name: וגם description:." >&2
    echo "ERROR: $skill frontmatter must declare both name: and description:." >&2
    fail=1
    continue
  fi
  if [ "$fm_name" != "$name" ]; then
    echo "ERROR: $name — frontmatter name ('$fm_name') חייב להיות שווה לשם התיקייה/workflow ('$name')." >&2
    echo "ERROR: $skill frontmatter name ('$fm_name') must equal the folder/workflow name ('$name')." >&2
    fail=1
    continue
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "workflow↔skill pairing check FAILED — every non-exempt workflow in $WF_DIR needs $SKILL_DIR/<name>/SKILL.md (see CLAUDE.md / docs/CAPABILITIES.md)." >&2
  exit 1
fi

echo "PASS: workflow↔skill pairing — $checked operable workflow(s) in $WF_DIR each have a conformant paired skill in $SKILL_DIR."
