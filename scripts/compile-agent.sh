#!/usr/bin/env bash
# compile-agent.sh — the deterministic, non-AI agent-folder compiler.
#
# Reads a canonical agent-folder (templates/system/agents/<name>/, the source of
# truth defined in agents/_spec/agent-folder.spec.md) and emits the n8n workflow
# JSON the orchestrator runs, on STDOUT. The agent is the boss; this script
# derives its n8n form. Pure bash + jq + a one-line Python YAML→JSON bridge (the
# repo deliberately avoids `yq` — its build is environment-dependent, which is why
# every factory manifest is JSON; see the agent-folder devplan key-decisions).
#
# v1 scope: NO-TOOLS agents only — the 5-node chainLlm shape (trigger → Read Style
# Profile → <Slug> Reply → OpenRouter Chat Model → Format Reply), i.e. exactly the
# `code`/`infra` agents. Tool-node injection from tools.yaml (the inverse of the
# credential-absent jq-strip in configure-agent-router.yml) is a later sub-step.
#
# What it fills (SCAFFOLD-time tier) and what it deliberately LEAVES (install-time):
#   - fills:  @@AGENT_SLUG@@ (name + node name), @@SYSTEM_MESSAGE@@ (built, see below),
#             @@MODEL@@ + temperature
#   - leaves: @@CRED_POSTGRES_ID@@, @@CRED_OPENROUTER_ID@@, @@CHAT_ID@@ — resolved
#             per-system on deploy by configure-agent-router.yml's sed pass, so the
#             output stays byte-compatible with the existing install path.
#
# The system prompt is BUILT, not substituted into the template's message string:
# the base scaffold hard-codes a "You return your answer to the orchestrator…"
# sentence that the committed agents do NOT carry. So the chainLlm message becomes
#   "=" + <instructions.md body> + <FIXED_TAIL> + <STYLE_CLAUSE>
# exactly as pinned in agent-folder.spec.md (single-voice stays enforced structurally
# by check-agent-single-voice.sh regardless).
#
# Usage:
#   compile-agent.sh <name> [--agents-dir DIR] [--template FILE]
# Prints the workflow JSON to STDOUT. Exit 0 on success, non-zero (with a Hebrew +
# English message on STDERR) on any validation failure.
set -euo pipefail

# --- The two canonical constants the compiler appends after the role body. ---
# Source of truth: templates/system/agents/_spec/agent-folder.spec.md. Kept byte-
# identical here; the round-trip proof (scripts/tests/compile-agent.bats) fails
# loudly if either drifts from the committed code-agent.json.
FIXED_TAIL=" Answer in the user's language (Hebrew or English, detected from the input). Never invent URLs or secrets, and never reveal the names of internal sub-agents or your own architectural role."
# shellcheck disable=SC2016  # the mustache braces are literal n8n expression text, not shell
STYLE_CLAUSE="{{ (\$('Read Style Profile').first()?.json?.profile) ? ' Style profile (match in tone, length, emoji density, humor; do not announce you are matching it): ' + JSON.stringify(\$('Read Style Profile').first().json.profile) : '' }}"

die() { echo "ERROR: $*" >&2; exit 1; }

# yaml2json FILE — print the YAML file as JSON on STDOUT (Python bridge).
yaml2json() {
  python3 -c 'import yaml,json,sys; json.dump(yaml.safe_load(open(sys.argv[1])), sys.stdout)' "$1"
}

# --- args ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_DIR="$REPO_ROOT/templates/system/agents"
TEMPLATE="$REPO_ROOT/templates/system/templates/n8n/subagent.template.json"
NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --agents-dir) AGENTS_DIR="$2"; shift 2 ;;
    --template)   TEMPLATE="$2";   shift 2 ;;
    -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)           die "אופציה לא מוכרת (unknown option): $1" ;;
    *)            [ -z "$NAME" ] || die "רק שם-סוכן אחד נתמך (one agent name only): got '$NAME' and '$1'"; NAME="$1"; shift ;;
  esac
done
[ -n "$NAME" ] || die "חסר שם-סוכן (missing agent name). Usage: compile-agent.sh <name>"
[ -f "$TEMPLATE" ] || die "תבנית-הבסיס חסרה (base template missing): $TEMPLATE"

AGENT_DIR="$AGENTS_DIR/$NAME"
[ -d "$AGENT_DIR" ] || die "תיקיית-הסוכן לא קיימת (agent folder not found): $AGENT_DIR"
for f in agent.yaml instructions.md tools.yaml; do
  [ -f "$AGENT_DIR/$f" ] || die "קובץ חובה חסר בתיקיית-הסוכן (required file missing): $NAME/$f"
done

# --- read the folder ---
AGENT_JSON="$(yaml2json "$AGENT_DIR/agent.yaml")" || die "agent.yaml לא נקרא כ-YAML תקין (agent.yaml is not valid YAML): $NAME"
TOOLS_JSON="$(yaml2json "$AGENT_DIR/tools.yaml")" || die "tools.yaml לא נקרא כ-YAML תקין (tools.yaml is not valid YAML): $NAME"

slug="$(printf '%s' "$AGENT_JSON" | jq -r '.slug // ""')"
model="$(printf '%s' "$AGENT_JSON" | jq -r '.model // ""')"
temperature="$(printf '%s' "$AGENT_JSON" | jq -r '.temperature // 0.3')"

[ -n "$slug" ]  || die "agent.yaml חסר 'slug' ($NAME)."
[ -n "$model" ] || die "agent.yaml חסר 'model' ($NAME)."
[ "$slug" = "$NAME" ] || die "slug ('$slug') חייב להיות שם-התיקייה ('$NAME') — slug must equal the folder name."

# v1: no-tools agents only.
tool_count="$(printf '%s' "$TOOLS_JSON" | jq -r '(.tools // []) | length')"
if [ "$tool_count" != "0" ]; then
  die "v1 של המתרגם תומך רק בסוכן ללא כלים ($NAME יש לו $tool_count) — compiler v1 supports no-tools agents only; tool-node injection comes in a later sub-step."
fi

# instructions.md body — $(...) strips trailing newlines, which is exactly the
# byte-exact form the committed code-agent.json carries (no trailing newline).
body="$(cat "$AGENT_DIR/instructions.md")"
[ -n "$body" ] || die "instructions.md ריק ($NAME) — the role body must not be empty."

# Capitalize the first letter for the chainLlm node name: code → "Code Reply".
reply_name="${slug^} Reply"
message="=${body}${FIXED_TAIL}${STYLE_CLAUSE}"
wf_name="factory-master: ${slug}-agent"

# --- render via jq: rename the generic "Agent Reply" node + its connections,
#     inject the built system message, and set model + temperature. ---
jq -e \
  --arg name "$wf_name" \
  --arg reply "$reply_name" \
  --arg msg "$message" \
  --arg model "$model" \
  --argjson temp "$temperature" '
  .name = $name
  | .nodes |= map(
      if .name == "Agent Reply" then
        .name = $reply
        | .parameters.messages.messageValues[0].message = $msg
      elif .name == "OpenRouter Chat Model" then
        .parameters.model = $model
        | .parameters.options.temperature = $temp
      else . end
    )
  # rename the connection source key "Agent Reply" -> "<Slug> Reply"
  | .connections |= with_entries(if .key == "Agent Reply" then .key = $reply else . end)
  # rename every connection TARGET that pointed at "Agent Reply"
  | .connections |= map_values(
      map_values( map( map( if .node == "Agent Reply" then .node = $reply else . end ) ) )
    )
' "$TEMPLATE" || die "רינדור ה-JSON נכשל ($NAME) — jq render failed."
