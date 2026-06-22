#!/usr/bin/env bash
# build-agent-readme.sh — refresh the managed metadata block in an agent's README.
#
# Each canonical agent-folder (agents/<name>/, the source of truth defined in
# agents/_spec/agent-folder.spec.md) carries a README.md that is HYBRID:
#   - human PROSE above/below the markers — authored by hand, never touched here;
#   - a MANAGED BLOCK between the HTML markers, generated from agent.yaml + tools.yaml
#     by this script.
#
# This script regenerates ONLY the managed block (the table of intent / architecture /
# model / temperature / confidence_threshold / fallback / tools) and injects it between
#   <!-- BEGIN_AGENT_HOME -->  ...  <!-- END_AGENT_HOME -->
# leaving the human prose untouched. Output is DETERMINISTIC — no timestamp, no
# randomness — so the drift gate (check-agent-readme.sh) can compare a fresh render
# against the committed file with `diff`, exactly like check-agent-folder.sh does for
# compiled workflows.
#
# Adapted from or-aios's build-agent-readme.sh, but reads the factory's YAML agent-folder
# format (agent.yaml + tools.yaml) via python3+pyyaml — the same YAML→JSON bridge
# check-agent-folder.sh / compile-agent.sh use (the repo deliberately avoids `yq`).
#
# Usage:
#   scripts/build-agent-readme.sh <name>            # rewrite agents/<name>/README.md in place
#   scripts/build-agent-readme.sh <name> --stdout   # print the refreshed README, write nothing
#
# The README must already exist and contain the two markers (the prose is human-authored —
# this script never invents prose). Scaffold a new one from
# agents/_spec/README.template.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Layout auto-detect (identical to check-agent-folder.sh): the factory keeps the mould
# under templates/system/; a provisioned system carries agents/ at its repo root.
if [ -d "$REPO_ROOT/templates/system/agents" ]; then
  AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/templates/system/agents}"
else
  AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/agents}"
fi

name="${1:?usage: build-agent-readme.sh <name> [--stdout]}"
mode="${2:-write}"

AGENT_DIR="${AGENTS_DIR}/${name}"
AGENT_YAML="${AGENT_DIR}/agent.yaml"
TOOLS_YAML="${AGENT_DIR}/tools.yaml"
README="${AGENT_DIR}/README.md"

BEGIN_MARKER="<!-- BEGIN_AGENT_HOME -->"
END_MARKER="<!-- END_AGENT_HOME -->"

[ -d "$AGENT_DIR" ]   || { echo "ERROR: no agent folder $AGENT_DIR" >&2; exit 1; }
[ -f "$AGENT_YAML" ]  || { echo "ERROR: missing $AGENT_YAML" >&2; exit 1; }
[ -f "$TOOLS_YAML" ]  || { echo "ERROR: missing $TOOLS_YAML" >&2; exit 1; }
[ -f "$README" ] || {
  echo "ERROR: missing $README — scaffold it from agents/_spec/README.template.md first (prose is human-authored)." >&2
  exit 1
}

# Exactly one BEGIN and one END marker.
begin_count="$(grep -cF "$BEGIN_MARKER" "$README" || true)"
end_count="$(grep -cF "$END_MARKER" "$README" || true)"
if [ "$begin_count" != "1" ] || [ "$end_count" != "1" ]; then
  echo "ERROR: $README must contain exactly one '$BEGIN_MARKER' and one '$END_MARKER' (found ${begin_count}/${end_count})." >&2
  exit 1
fi

# --- build the managed block from agent.yaml + tools.yaml (deterministic, no timestamp) ---
# python3+pyyaml mirrors check-agent-folder.sh's bridge; one place owns the formatting.
block="$(python3 - "$AGENT_YAML" "$TOOLS_YAML" <<'PY'
import sys, yaml

agent_p, tools_p = sys.argv[1], sys.argv[2]
agent = yaml.safe_load(open(agent_p)) or {}
tools_doc = yaml.safe_load(open(tools_p)) or {}

def num(v):
    # 0.7 -> "0.7", 1 -> "1"; leave non-numbers as their str.
    if isinstance(v, bool):
        return str(v).lower()
    return str(v)

intent = agent.get("intent", agent.get("slug", "—"))
architecture = agent.get("architecture", "—")
model = agent.get("model", "—")
temperature = num(agent["temperature"]) if "temperature" in agent else "0.3"
conf = num(agent["confidence_threshold"]) if "confidence_threshold" in agent else "—"
fallback = "true" if agent.get("fallback", False) else "false"

tools = tools_doc.get("tools") or []
tools_cell = ", ".join("`%s`" % t for t in tools) if tools else "—"

lines = [
    "<!-- Generated from agent.yaml + tools.yaml by scripts/build-agent-readme.sh — do not edit this block by hand. -->",
    "",
    "| Field | Value |",
    "|---|---|",
    "| Intent | `%s` |" % intent,
    "| Architecture | `%s` |" % architecture,
    "| Model | `%s` |" % model,
    "| Temperature | %s |" % temperature,
    "| Confidence threshold | %s |" % conf,
    "| Fallback | `%s` |" % fallback,
    "| Tools | %s |" % tools_cell,
]
print("\n".join(lines))
PY
)"

# --- inject: keep prose, replace only what sits between the markers ---
# Pass the block via the environment so awk does no backslash-escape processing on it.
rendered="$(AGENT_HOME_BLOCK="$block" awk -v b="$BEGIN_MARKER" -v e="$END_MARKER" '
  $0 == b { print; print ENVIRON["AGENT_HOME_BLOCK"]; skip=1; next }
  $0 == e { skip=0; print; next }
  skip    { next }
  { print }
' "$README")"

if [ "$mode" = "--stdout" ]; then
  printf '%s\n' "$rendered"
else
  printf '%s\n' "$rendered" > "$README"
  echo "wrote $README"
fi
