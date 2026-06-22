#!/usr/bin/env bats
# compile-agent.bats — the round-trip brick-proof for templates/system/scripts/compile-agent.sh.
#
# The faithfulness proof of the agent-folder compiler (agent-folder-structure
# devplan, Change 3): compiling the canonical `code` agent-folder must reproduce
# the committed templates/system/workflows/n8n/code-agent.json — the real fixture —
# SEMANTICALLY EXACTLY. "Semantically" = after normalizing away the cosmetic noise
# n8n regenerates anyway (node ids/positions, nested ids, key order), via the
# existing scripts/lib/normalize-n8n.sh extended to also strip nested ids.
#
# This is capability-first applied to the compiler: prove the brick on the real
# fixture before wiring it into anything live (the live or-edri-4 proof comes with
# Change 5, when the compiler actually feeds configure-agent-router.yml).

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  cd "$REPO_ROOT" || return 1
  # shellcheck source=../lib/normalize-n8n.sh
  source "$REPO_ROOT/scripts/lib/normalize-n8n.sh"
}

teardown() {
  common_teardown
}

# norm — STDIN n8n JSON -> canonical form with EVERY id stripped at any depth.
# normalize_n8n drops top-level volatile fields + per-node position/id/webhookId;
# the extra walk also strips nested ids (e.g. the Set node's assignments[].id),
# which the stock normalizer leaves. The result is purely the semantic content.
norm() { normalize_n8n | jq -S 'walk(if type=="object" and has("id") then del(.id) else . end)'; }

# --- the proof ---

@test "compile-agent.sh code reproduces committed code-agent.json (normalized round-trip)" {
  local compiled committed
  compiled="$(bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" code | norm)"
  committed="$(norm < "$REPO_ROOT/templates/system/workflows/n8n/code-agent.json")"
  if [ "$compiled" != "$committed" ]; then
    echo "round-trip mismatch — compiled (<) vs committed (>):" >&2
    diff <(printf '%s\n' "$compiled") <(printf '%s\n' "$committed") >&2 || true
    return 1
  fi
}

@test "compiled code agent leaves install-time placeholders intact" {
  run bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" code
  assert_success
  assert_output --partial '@@CRED_POSTGRES_ID@@'
  assert_output --partial '@@CRED_OPENROUTER_ID@@'
  assert_output --partial '@@CHAT_ID@@'
}

@test "compiled code agent is valid JSON and a single-voice agent (no Telegram, executeWorkflowTrigger, {reply})" {
  local out
  out="$(bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" code)"
  # valid JSON
  printf '%s' "$out" | jq empty
  # executeWorkflowTrigger present, no telegram/webhook trigger
  [ "$(printf '%s' "$out" | jq '[.nodes[] | select(.type=="n8n-nodes-base.executeWorkflowTrigger")] | length')" -eq 1 ]
  [ "$(printf '%s' "$out" | jq '[.nodes[] | select((.type//"")|ascii_downcase|contains("telegram"))] | length')" -eq 0 ]
  # a node assigns a `reply` field
  [ "$(printf '%s' "$out" | jq '[.nodes[] | select(.name=="Format Reply")] | length')" -eq 1 ]
}

# --- guards ---

@test "v1 refuses a tool-carrying agent" {
  local agents
  agents="$(make_tmpdir)"
  mkdir -p "$agents/toolful"
  cat > "$agents/toolful/agent.yaml" <<'EOF'
slug: toolful
description: a toolful agent
model: openrouter/auto
architecture: single-agent
EOF
  printf 'do things\n' > "$agents/toolful/instructions.md"
  cat > "$agents/toolful/tools.yaml" <<'EOF'
tools:
  - github_readonly
EOF
  run bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" toolful --agents-dir "$agents"
  assert_failure
  assert_output --partial 'no-tools'
}

@test "missing agent folder fails loudly" {
  run bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" nope --agents-dir "$(make_tmpdir)"
  assert_failure
  assert_output --partial 'agent folder not found'
}

@test "slug must equal the folder name" {
  local agents
  agents="$(make_tmpdir)"
  mkdir -p "$agents/mismatch"
  cat > "$agents/mismatch/agent.yaml" <<'EOF'
slug: other
description: x
model: openrouter/auto
architecture: single-llm
EOF
  printf 'body\n' > "$agents/mismatch/instructions.md"
  printf 'tools: []\n' > "$agents/mismatch/tools.yaml"
  run bash "$REPO_ROOT/templates/system/scripts/compile-agent.sh" mismatch --agents-dir "$agents"
  assert_failure
  assert_output --partial 'slug'
}
