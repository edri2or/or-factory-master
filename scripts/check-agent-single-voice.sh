#!/usr/bin/env bash
# Single-voice guardrail for the orchestrator (the Agent Router).
#
# Enforces the architectural invariant (see templates/n8n/subagent.contract.md):
# every specialist agent the router dispatches to (<AGENT_DIR>/*-agent.json) must
# do its work and return the fixed contract {reply} to the orchestrator — it must
# NEVER address the operator directly. Only tg-inbound.json (the orchestrator's
# voice) and the system-level notification workflows own a Telegram-send node; a
# specialist agent must not.
#
# This is the "make the right way the only way" enforcement layer: a new agent
# that tries to talk to the operator, skips the Execute-Workflow trigger, or
# breaks the {reply} contract fails CI here instead of degrading silently in
# production. Wired into pipeline-tests.yml (system) and playground-tests.yml
# (factory, run over the templates/system mould); runs on every PR.
#
# A specialist agent (<AGENT_DIR>/<intent>-agent.json) must:
#   1. be valid JSON;
#   2. contain NO Telegram node (no node whose type contains "telegram");
#   3. be triggered by an Execute-Workflow trigger (executeWorkflowTrigger),
#      and expose NO user-facing trigger (webhook / telegramTrigger);
#   4. expose the output contract {reply} (a node assigning a field "reply").
#
# AGENT_DIR selects which tree to check (default: the system layout). The factory
# CI runs it with AGENT_DIR=templates/system/workflows/n8n to validate the mould.
set -euo pipefail

AGENT_DIR="${AGENT_DIR:-workflows/n8n}"
AGENT_GLOB="$AGENT_DIR/*-agent.json"
fail=0

shopt -s nullglob
agents=( $AGENT_GLOB )
shopt -u nullglob

if [ ${#agents[@]} -eq 0 ]; then
  echo "PASS: single-voice check — no specialist agents found in $AGENT_DIR (nothing to enforce)."
  exit 0
fi

for f in "${agents[@]}"; do
  name=$(basename "$f")

  # 1. valid JSON
  if ! jq empty "$f" 2>/dev/null; then
    echo "ERROR: $name — JSON לא תקין (invalid JSON)." >&2
    fail=1
    continue
  fi

  # 2. no Telegram node anywhere in the agent
  tg=$(jq -r '[.nodes[]? | select((.type // "") | ascii_downcase | contains("telegram")) | .name] | join(", ")' "$f")
  if [ -n "$tg" ]; then
    echo "ERROR: $name — סוכן מכיל node טלגרם ($tg). רק ה-orchestrator (tg-inbound) מדבר עם האופרטור." >&2
    echo "ERROR: $name has a Telegram node — specialist agents must return {reply} to the orchestrator, never message the operator." >&2
    fail=1
  fi

  # 3a. must have an Execute-Workflow trigger
  exec_triggers=$(jq -r '[.nodes[]? | select(.type=="n8n-nodes-base.executeWorkflowTrigger")] | length' "$f")
  if [ "$exec_triggers" -lt 1 ]; then
    echo "ERROR: $name — חסר טריגר 'When Executed by Another Workflow' (executeWorkflowTrigger). סוכן מופעל ע\"י ה-orchestrator בלבד." >&2
    echo "ERROR: $name is missing an Execute-Workflow trigger; agents are invoked only by the orchestrator." >&2
    fail=1
  fi

  # 3b. must NOT have a user-facing trigger (webhook / telegramTrigger)
  user_triggers=$(jq -r '[.nodes[]? | select((.type // "")=="n8n-nodes-base.webhook" or ((.type // "") | ascii_downcase | contains("telegramtrigger"))) | .name] | join(", ")' "$f")
  if [ -n "$user_triggers" ]; then
    echo "ERROR: $name — סוכן מכיל טריגר חיצוני שפונה למשתמש ($user_triggers). אסור — ה-orchestrator הוא הכניסה היחידה." >&2
    echo "ERROR: $name exposes a user-facing trigger ($user_triggers); only the orchestrator owns the entry point." >&2
    fail=1
  fi

  # 4. must expose the {reply} output contract
  reply_nodes=$(jq -r '[.nodes[]? | select((.parameters.assignments.assignments // []) | any(.name=="reply"))] | length' "$f")
  if [ "$reply_nodes" -lt 1 ]; then
    echo "ERROR: $name — חסר פלט החוזה {reply} (node שמקצה שדה בשם reply). זה מה שה-orchestrator מצפה לקבל." >&2
    echo "ERROR: $name does not expose the {reply} output contract the orchestrator expects." >&2
    fail=1
  fi

  # 5. memory session keys must start from the operator's base key (per-source convention).
  #    Any Postgres Chat Memory customKey sessionKey must be exactly tg:@@CHAT_ID@@ or an
  #    expression starting =tg:@@CHAT_ID@@ — so a per-source thread (tg:<chat_id>:<source>)
  #    can never diverge from, or bleed into, the operator's base thread. Agents without a
  #    memory node are unaffected. (See templates/n8n/subagent.contract.md.)
  session_keys=$(jq -r '[.nodes[]? | select((.type // "") | ascii_downcase | contains("memorypostgreschat")) | select((.parameters.sessionIdType // "")=="customKey") | .parameters.sessionKey // ""] | .[]' "$f")
  while IFS= read -r sk; do
    [ -z "$sk" ] && continue
    case "${sk#=}" in
      "tg:@@CHAT_ID@@"*) : ;;
      *)
        echo "ERROR: $name — sessionKey לא תואם למוסכמה ('$sk'). חייב להתחיל מ-tg:@@CHAT_ID@@ (מפתח הבסיס של האופרטור)." >&2
        echo "ERROR: $name memory sessionKey must start from the operator base key tg:@@CHAT_ID@@ (per-source convention)." >&2
        fail=1
        ;;
    esac
  done <<EOF
$session_keys
EOF
done

# Media sub-workflows (tg-vision, tg-voice-stt): these are not specialist agents
# (they don't carry the {reply} classifier contract — tg-voice-stt returns {text}),
# but the same single-voice invariant applies: they pre-process a photo/voice and
# RETURN the result to the orchestrator (tg-inbound → Agent Router) — they must
# never address the operator directly. They MAY read from Telegram (e.g. getFile to
# download the media) but must NOT send. A Telegram node is allowed ONLY for
# resource=="file" (download); any send (resource message/callback/chat) is a
# violation. Like the agents, they must be Execute-Workflow-triggered and expose no
# user-facing trigger.
MEDIA_WORKFLOWS=( "$AGENT_DIR/tg-vision.json" "$AGENT_DIR/tg-voice-stt.json" )
media_checked=0
for f in "${MEDIA_WORKFLOWS[@]}"; do
  [ -f "$f" ] || continue
  media_checked=$((media_checked + 1))
  name=$(basename "$f")

  if ! jq empty "$f" 2>/dev/null; then
    echo "ERROR: $name — JSON לא תקין (invalid JSON)." >&2
    fail=1
    continue
  fi

  # No Telegram-SEND node (a Telegram node whose resource is anything other than
  # "file"). Downloading media (resource=="file") is fine; addressing the operator
  # (sendMessage / editMessageText / answerQuery / …) is not.
  tg_send=$(jq -r '[.nodes[]? | select(((.type // "") | ascii_downcase | contains("telegram")) and ((.parameters.resource // "") != "file")) | .name] | join(", ")' "$f")
  if [ -n "$tg_send" ]; then
    echo "ERROR: $name — תת-workflow של מדיה מכיל node טלגרם ששולח ($tg_send). מותר רק להוריד מדיה (resource=file); התשובה חוזרת ל-orchestrator." >&2
    echo "ERROR: $name has a Telegram send node ($tg_send) — media sub-workflows must return their result to the orchestrator, never message the operator." >&2
    fail=1
  fi

  # Must be Execute-Workflow-triggered (invoked by the orchestrator/tg-inbound).
  exec_triggers=$(jq -r '[.nodes[]? | select(.type=="n8n-nodes-base.executeWorkflowTrigger")] | length' "$f")
  if [ "$exec_triggers" -lt 1 ]; then
    echo "ERROR: $name — חסר טריגר executeWorkflowTrigger; תת-workflow של מדיה מופעל ע\"י ה-orchestrator בלבד." >&2
    fail=1
  fi

  # Must NOT expose a user-facing trigger.
  user_triggers=$(jq -r '[.nodes[]? | select((.type // "")=="n8n-nodes-base.webhook" or ((.type // "") | ascii_downcase | contains("telegramtrigger"))) | .name] | join(", ")' "$f")
  if [ -n "$user_triggers" ]; then
    echo "ERROR: $name — תת-workflow של מדיה מכיל טריגר שפונה למשתמש ($user_triggers). אסור — ה-orchestrator הוא הכניסה היחידה." >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "single-voice check FAILED — see templates/n8n/subagent.contract.md ('The four hard rules')." >&2
  exit 1
fi

echo "PASS: single-voice check — ${#agents[@]} specialist agent(s) + ${media_checked} media sub-workflow(s) in $AGENT_DIR conform (no operator-facing Telegram send, Execute-Workflow trigger only)."
