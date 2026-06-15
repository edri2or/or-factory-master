#!/usr/bin/env bash
# Generate the paired Claude skill (SKILL.md) for each OPERABLE n8n workflow the
# factory ships into a system (templates/system/workflows/n8n/<name>.json).
#
# Each operable workflow gets templates/system/.claude/skills/<name>/SKILL.md —
# the folder name IS the /<name> slash command. Pure-plumbing workflows (crons,
# sinks, one-shots, media sub-workflows, the agents manifest) are listed in
# monitoring/workflow-skill-exempt.txt and are skipped here.
#
# The skill is 100% STATIC, a "map, not a manual" — it routes to the live tools
# (the n8n-live / factory MCP servers in .mcp.json, AGENTS.md, and the HITL
# request_write_action path), never to hard-coded IDs or secrets. Frontmatter is
# name: + description: only, mirroring templates/system/.claude/skills/
# operate-this-system/SKILL.md (the repo treats allowed-tools as unsupported).
#
# Content is driven by a CURATED table below (one purpose/trigger/keywords entry
# per workflow), so output is deterministic: same table -> byte-identical files
# -> stable golden. Re-running with no table change is a no-op diff. This is an
# authoring convenience, not a CI gate; CI (scripts/check-workflow-skill-pair.sh)
# enforces only that the pair + frontmatter exist, so a human may hand-tune any
# SKILL.md body afterward without breaking CI.
#
# Usage: bash scripts/gen-workflow-skill.sh   (run from the repo root)
set -euo pipefail

SKILL_ROOT="templates/system/.claude/skills"

# Curated table: NAME|PURPOSE|TRIGGER_PHRASE|TRIGGER_TYPE|KEYWORDS
# (PURPOSE = one line "what it does in this system"; TRIGGER_PHRASE = the "load
#  this when…" hook; TRIGGER_TYPE = plain-words trigger; KEYWORDS = 2-4 terms.)
read -r -d '' TABLE <<'EOF' || true
agent-router|the orchestrator that classifies the operator's Telegram message and dispatches it to the right specialist agent, then returns a single reply|the Agent Router that routes an inbound message to the ops / code / research / infra / unknown specialists|invoked by tg-inbound (the Telegram entry point); it is the single dispatch hub|agent router, routing, intent classification
tg-inbound|the Telegram entry point — receives the operator's message at the webhook, normalises it (incl. media via tg-vision / tg-voice-stt), and hands it to the Agent Router|the inbound Telegram webhook that owns the operator-facing voice|a Telegram webhook (the single operator entry point)|telegram, inbound, webhook, entry point
tg-proactive|the proactive-outreach worker — on a schedule it decides whether the bot should message the operator first (reminders, nudges)|the scheduled proactive-message worker that lets the bot reach out first|a schedule (cron)|proactive, reminder, nudge, scheduled
ops-agent|the operations specialist — answers operability and telemetry questions about this system using its read-only tools, and returns {reply} to the orchestrator|the ops specialist the Agent Router dispatches for operations / telemetry questions|invoked by the Agent Router (returns the {reply} contract)|ops, operations, telemetry, system status
infra-agent|the infrastructure specialist — handles infra / GCP / Railway-shaped requests and returns {reply} to the orchestrator|the infra specialist the Agent Router dispatches for infrastructure requests|invoked by the Agent Router (returns the {reply} contract)|infra, gcp, railway, infrastructure
code-agent|the code specialist — handles code / repo / GitHub-shaped requests and returns {reply} to the orchestrator|the code specialist the Agent Router dispatches for code / repo requests|invoked by the Agent Router (returns the {reply} contract)|code, github, repo, development
research-agent|the research specialist — answers research / lookup questions and can hand a heavy job to deep-research, returning {reply} to the orchestrator|the research specialist the Agent Router dispatches for research questions|invoked by the Agent Router (returns the {reply} contract)|research, lookup, web search
unknown-agent|the fallback specialist — handles messages no other intent matched and returns {reply} to the orchestrator|the fallback specialist the Agent Router dispatches when no intent matches|invoked by the Agent Router (returns the {reply} contract)|unknown, fallback, default intent
deep-research|the long-running deep-research worker — runs a multi-source research job and returns a synthesised result to the caller|the deep-research background worker dispatched for a heavy, multi-source research job|invoked as a sub-workflow (by research-agent)|deep research, multi-source, synthesis
github-readonly|the read-only GitHub tool — exposes safe, scoped GitHub reads to the agents (no writes)|the read-only GitHub tool the agents call|invoked as a tool sub-workflow|github, read-only, tool
railway-readonly|the read-only Railway tool — exposes safe Railway reads (service / deployment status) to the agents (no writes)|the read-only Railway tool the agents call|invoked as a tool sub-workflow|railway, read-only, tool
postgres-named-queries|the whitelisted read-only SQL tool — runs a fixed set of named SELECTs (transcript, tool trace, claim/actual mismatches) against this system's Postgres|the named read-only Postgres queries the bot and agents use|invoked as a tool sub-workflow|postgres, named query, read-only sql
mcp-server|this system's outward read-only MCP endpoint (/mcp/system-tools) — serves postgres_named_query, github_readonly and railway_readonly to external MCP clients, bearer-guarded|the system's own outward MCP endpoint at /mcp/system-tools|an MCP trigger (outward endpoint, bearer-guarded)|mcp, system-tools, endpoint, bearer
request-write-action|the human-in-the-loop write-request gate — turns a proposed state change into a Telegram approval card; the operator's tap then routes to pending-actions-executor|the HITL write-request gate (propose -> approve -> execute)|invoked as a sub-workflow; pairs with pending-actions-executor|hitl, write action, approval, pending actions
EOF

emit_skill() {
  local name="$1" purpose="$2" phrase="$3" ttype="$4" keywords="$5"
  local dir="$SKILL_ROOT/$name"
  mkdir -p "$dir"

  # Capitalise the first letter of the purpose so it reads as a sentence.
  local purpose_cap="${purpose^}"

  # Agent-type workflows get an extra "how it's reached" line; tool/sub-workflows differ.
  local develop_line
  case "$name" in
    *-agent)
      develop_line="It is invoked by the **Agent Router** (never by the operator directly) and returns the fixed \`{reply}\` contract — see the \`agent-router\` skill and \`templates/n8n/subagent.contract.md\`. Change its prompt/tools in git and re-import via \`configure-agent-router.yml\`; do not hand-edit the published workflow." ;;
    *)
      develop_line="Change \`$name\` in git and re-import it via the system's \`configure-agent-router.yml\`; never hand-edit the published workflow in the n8n UI." ;;
  esac

  cat > "$dir/SKILL.md" <<EOF
---
name: $name
description: >-
  $purpose_cap. Load this skill to understand, run, develop, or reason about THIS
  system's "$name" n8n workflow — $phrase. It is a map, not a manual: it routes
  you to the live workflow via the n8n-live and factory MCP servers (.mcp.json)
  and AGENTS.md, never to hard-coded ids or secrets. Triggers on $name, $keywords.
---

# $name

This skill describes the **\`$name\`** n8n workflow shipped into this system by
\`or-factory-master\`. It is a **map, not a manual** — the live values (workflow id,
URL, secret values) live in **\`AGENTS.md\`** and the running n8n, never here.

## What it is

$purpose_cap. Trigger: $ttype.

## Read its live state first (read-only)

- **\`factory\` MCP** (\`.mcp.json\`) — \`list_n8n_workflows\`, \`inspect_n8n_execution\`,
  and this system's \`/mcp/system-tools\` named queries — see how \`$name\` actually ran
  before you touch anything.
- **\`AGENTS.md\`** (repo root) — the system's live tables, secret **names** (never
  values), and the agent roster.

## Run / develop it

- **\`n8n-live\` MCP** (\`.mcp.json\`) — run and develop \`$name\` against this system's
  OWN live n8n. Live writes are **scratch-only** (\`dev-*\` names); git stays the
  source of truth.
- $develop_line

## The invariants — never break these

- **Writes are human-gated (HITL).** Any state change is *proposed*, then a human ✅
  approves via \`request_write_action\` / \`pending-actions-executor\`. Never self-approve.
- **Secrets are names only.** Never echo, print, or log a Secret Manager value or any
  minted token.
- **\`main\` is protected.** Workflow JSON changes land via PR + green CI, never a
  direct push.

## See also

\`operate-this-system\` (the system-wide map) and \`AGENTS.md\` (this system's live values).
EOF
  echo "INFO: wrote $dir/SKILL.md"
}

count=0
while IFS='|' read -r name purpose phrase ttype keywords; do
  [ -z "${name:-}" ] && continue
  case "$name" in \#*) continue ;; esac
  emit_skill "$name" "$purpose" "$phrase" "$ttype" "$keywords"
  count=$((count + 1))
done <<EOF
$TABLE
EOF

echo "PASS: generated $count workflow skill(s) under $SKILL_ROOT/."
