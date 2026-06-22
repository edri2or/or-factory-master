#!/usr/bin/env bats
# check-agent-folder.bats — proves the agent-folder gate (scripts/check-agent-folder.sh)
# actually FAILS when it should: a malformed folder (schema) and a folder that has
# drifted from its committed generated JSON (in-sync). Mirrors the repo convention
# that every check-script has a BATS test proving its teeth.

load test_helper/common

GATE="scripts/check-agent-folder.sh"

setup() {
  _COMMON_TMP_PATHS=()
  cd "$REPO_ROOT" || return 1
}
teardown() { common_teardown; }

# A fixture agents/ dir containing _spec + a valid copy of the real `code` folder.
mkfix_agents() {
  local d; d="$(make_tmpdir)"
  cp -r "$REPO_ROOT/templates/system/agents/_spec" "$d/_spec"
  cp -r "$REPO_ROOT/templates/system/agents/code"  "$d/code"
  printf '%s' "$d"
}
# A fixture workflows dir with the real committed code-agent.json.
mkfix_wf() {
  local w; w="$(make_tmpdir)"
  cp "$REPO_ROOT/templates/system/workflows/n8n/code-agent.json" "$w/code-agent.json"
  printf '%s' "$w"
}

@test "the real committed tree passes" {
  run bash "$REPO_ROOT/$GATE"
  assert_success
  assert_output --partial 'PASS'
}

@test "no agents/ dir is a clean no-op pass" {
  run env AGENTS_DIR="$(make_tmpdir)/does-not-exist" bash "$REPO_ROOT/$GATE"
  assert_success
  assert_output --partial 'no agents/ dir'
}

@test "valid fixture (code) passes in sync with its JSON" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_success
}

@test "missing required field (model) fails" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  cat > "$a/code/agent.yaml" <<'EOF'
slug: code
intent: code
description: x
confidence_threshold: 0.7
architecture: single-llm
temperature: 0.3
EOF
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_failure
  assert_output --partial 'model'
}

@test "invalid architecture enum fails" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  cat > "$a/code/agent.yaml" <<'EOF'
slug: code
intent: code
description: x
confidence_threshold: 0.7
model: anthropic/claude-haiku-4.5
architecture: bogus-arch
temperature: 0.3
EOF
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_failure
  assert_output --partial 'enum'
}

@test "unexpected key (additionalProperties:false) fails" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  cat > "$a/code/agent.yaml" <<'EOF'
slug: code
intent: code
description: x
confidence_threshold: 0.7
model: anthropic/claude-haiku-4.5
architecture: single-llm
temperature: 0.3
surprise: yes
EOF
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_failure
  assert_output --partial 'unexpected key'
}

@test "tools.yaml with an unknown tool fails" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  printf 'tools:\n  - not_a_real_tool\n' > "$a/code/tools.yaml"
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_failure
  assert_output --partial 'enum'
}

@test "drift between folder and committed JSON fails" {
  local a w; a="$(mkfix_agents)"; w="$(mkfix_wf)"
  # Tamper the committed JSON so the compiler output no longer matches.
  jq '.nodes |= map(if .name=="OpenRouter Chat Model" then .parameters.model="tampered/model" else . end)' \
    "$w/code-agent.json" > "$w/code-agent.json.tmp" && mv "$w/code-agent.json.tmp" "$w/code-agent.json"
  run env AGENTS_DIR="$a" WF_DIR="$w" bash "$REPO_ROOT/$GATE"
  assert_failure
  assert_output --partial 'drifted'
}
