#!/usr/bin/env bash
# compile-agent.sh — the deterministic, non-AI agent-folder compiler.
#
# Reads a canonical agent-folder (agents/<name>/, the source of truth defined in
# agents/_spec/agent-folder.spec.md) and emits the n8n workflow JSON the
# orchestrator runs, on STDOUT. The agent is the boss; this script derives its n8n
# form. Pure bash + jq + a one-line Python YAML→JSON bridge (the repo deliberately
# avoids `yq` — its build is environment-dependent, which is why every factory
# manifest is JSON; see the agent-folder devplan key-decisions).
#
# Handles BOTH agent shapes:
#   - architecture: single-llm  → a no-tools `@n8n/n8n-nodes-langchain.chainLlm`
#     node, system prompt in parameters.messages (code, infra).
#   - architecture: single-agent → a `@n8n/n8n-nodes-langchain.agent` v2.2 node,
#     system prompt in parameters.options.systemMessage, with tool nodes injected
#     from tools.yaml (ops, research, unknown) and optional Postgres chat memory.
#
# System message model (uniform): the compiler appends ONLY the style-profile
# clause; instructions.md carries the FULL system-message body (each agent's tail
# is bespoke — ops/unknown embed @@SYSTEM_INFO_JSON@@ / @@SYSTEM_NAME@@ literally).
#   message = "=" + <instructions.md body> + <STYLE_CLAUSE>
#
# Tool injection: for every entry in tools.yaml the compiler injects the matching
# node snippet from agents/_spec/tools/<tool>.json + an ai_tool edge to the LLM
# node (the inverse of the credential-absent jq-strip in configure-agent-router.yml).
#
# Scaffold-time tokens are filled (@@AGENT_SLUG@@ → name/node, @@MODEL@@, the built
# system message); install-time tokens are LEFT INTACT (@@CRED_*@@, @@CHAT_ID@@,
# @@SYSTEM_NAME@@, @@N8N_DOMAIN@@, @@WF_*_ID@@, @@SYSTEM_INFO_JSON@@) so the
# downstream configure-agent-router.yml install path stays byte-compatible.
#
# Usage:
#   compile-agent.sh <name> [--agents-dir DIR] [--template FILE]
# Prints the workflow JSON to STDOUT. Exit 0 on success, non-zero (Hebrew+English
# on STDERR) on any validation failure.
#
# Canonical home: templates/system/scripts/compile-agent.sh. Default paths resolve
# relative to the script's parent dir, so the same file works unflagged in the
# factory checkout (REPO_ROOT=templates/system) and inside a provisioned system
# repo (REPO_ROOT=the repo root) — both carry agents/ + templates/n8n/ under it.
set -euo pipefail

# The style-profile clause every agent's system message ends with (source of truth:
# agents/_spec/agent-folder.spec.md). The round-trip proof fails if it drifts.
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
AGENTS_DIR="$REPO_ROOT/agents"
TEMPLATE="$REPO_ROOT/templates/n8n/subagent.template.json"
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
SNIPPET_DIR="$AGENTS_DIR/_spec/tools"
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
architecture="$(printf '%s' "$AGENT_JSON" | jq -r '.architecture // ""')"
reply_node_name="$(printf '%s' "$AGENT_JSON" | jq -r '.reply_node_name // ""')"
memory="$(printf '%s' "$AGENT_JSON" | jq -r '.memory // ""')"
reply_expression="$(printf '%s' "$AGENT_JSON" | jq -r '.reply_expression // ""')"

[ -n "$slug" ]  || die "agent.yaml חסר 'slug' ($NAME)."
[ -n "$model" ] || die "agent.yaml חסר 'model' ($NAME)."
[ -n "$architecture" ] || die "agent.yaml חסר 'architecture' ($NAME)."
[ "$slug" = "$NAME" ] || die "slug ('$slug') חייב להיות שם-התיקייה ('$NAME') — slug must equal the folder name."

# tool list (in tools.yaml order)
mapfile -t TOOLS < <(printf '%s' "$TOOLS_JSON" | jq -r '(.tools // [])[]')
tool_count="${#TOOLS[@]}"

# single-llm is the no-tools chainLlm shape: tools are a contradiction there.
if [ "$architecture" = "single-llm" ] && [ "$tool_count" != "0" ]; then
  die "architecture: single-llm אינו יכול לשאת כלים ($NAME יש לו $tool_count) — a single-llm agent is the no-tools chainLlm shape."
fi

# instructions.md body — $(...) strips trailing newlines (the byte-exact committed form).
body="$(cat "$AGENT_DIR/instructions.md")"
[ -n "$body" ] || die "instructions.md ריק ($NAME) — the role body must not be empty."

reply_name="$reply_node_name"
[ -n "$reply_name" ] || reply_name="${slug^} Reply"
message="=${body}${STYLE_CLAUSE}"
wf_name="factory-master: ${slug}-agent"

# --- assemble tool nodes + their ai_tool connections from the snippet library ---
# Each tool resolves to a node snippet: a per-agent OVERRIDE (agents/<name>/tools/
# <tool>.json) when present — for the few tools whose LLM-facing description differs
# between agents — else the shared library default (agents/_spec/tools/<tool>.json).
tool_files=()
for t in "${TOOLS[@]}"; do
  if [ -f "$AGENT_DIR/tools/${t}.json" ]; then
    snip="$AGENT_DIR/tools/${t}.json"
  else
    snip="$SNIPPET_DIR/${t}.json"
  fi
  [ -f "$snip" ] || die "אין snippet לכלי '$t' ($SNIPPET_DIR/${t}.json) — unknown tool / missing snippet."
  jq empty "$snip" 2>/dev/null || die "snippet לא תקין (invalid JSON) לכלי '$t': $snip"
  tool_files+=("$snip")
done
if [ "${#tool_files[@]}" -gt 0 ]; then
  TOOL_NODES="$(jq -s '.' "${tool_files[@]}")"
else
  TOOL_NODES='[]'
fi
TOOL_CONNS="$(printf '%s' "$TOOL_NODES" | jq --arg reply "$reply_name" \
  'map({key: .name, value: {ai_tool: [[{node: $reply, type: "ai_tool", index: 0}]]}}) | from_entries')"

# --- optional Postgres chat memory (unknown-agent) ---
MEM_NODE='null'
MEM_CONN='{}'
if [ -n "$memory" ]; then
  [ "$memory" = "postgres" ] || die "memory='$memory' לא נתמך ($NAME) — only 'postgres' is supported."
  MEM_SNIP="$AGENTS_DIR/_spec/memory-postgres.json"
  [ -f "$MEM_SNIP" ] || die "snippet זיכרון חסר (memory snippet missing): $MEM_SNIP"
  jq empty "$MEM_SNIP" 2>/dev/null || die "snippet זיכרון לא תקין: $MEM_SNIP"
  MEM_NODE="$(jq -c '.' "$MEM_SNIP")"
  mem_name="$(printf '%s' "$MEM_NODE" | jq -r '.name')"
  MEM_CONN="$(jq -cn --arg reply "$reply_name" --arg m "$mem_name" \
    '{($m): {ai_memory: [[{node: $reply, type: "ai_memory", index: 0}]]}}')"
fi

# --- render: from the skeleton template, rename the generic "Agent Reply" node,
#     set its shape (chainLlm vs agent) + system message, set model/temperature,
#     rewire connections, then inject tools + memory. ---
jq -e \
  --arg name "$wf_name" \
  --arg reply "$reply_name" \
  --arg msg "$message" \
  --arg model "$model" \
  --argjson temp "$temperature" \
  --arg arch "$architecture" \
  --argjson toolnodes "$TOOL_NODES" \
  --argjson toolconns "$TOOL_CONNS" \
  --argjson memnode "$MEM_NODE" \
  --argjson memconn "$MEM_CONN" \
  --arg rexpr "$reply_expression" '
  .name = $name
  | .nodes |= map(
      if .name == "Agent Reply" then
        .name = $reply
        | ( if $arch == "single-llm"
            then .parameters.messages.messageValues[0].message = $msg
            else .type = "@n8n/n8n-nodes-langchain.agent"
                 | .typeVersion = 2.2
                 | .parameters = { promptType: "define", text: .parameters.text, options: { systemMessage: $msg } }
            end )
      elif .name == "OpenRouter Chat Model" then
        .parameters.model = $model
        | .parameters.options.temperature = $temp
      elif (.name == "Format Reply" and $rexpr != "") then
        .parameters.assignments.assignments[0].value = $rexpr
      else . end
    )
  # rename the "Agent Reply" connection source key + every target that points at it
  | .connections |= with_entries(if .key == "Agent Reply" then .key = $reply else . end)
  | .connections |= map_values( map_values( map( map( if .node == "Agent Reply" then .node = $reply else . end ) ) ) )
  # inject tool nodes + their ai_tool edges
  | .nodes += $toolnodes
  | .connections += $toolconns
  # inject memory node + its ai_memory edge (when declared)
  | ( if $memnode != null then (.nodes += [$memnode]) | (.connections += $memconn) else . end )
' "$TEMPLATE" || die "רינדור ה-JSON נכשל ($NAME) — jq render failed."
