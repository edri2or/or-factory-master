#!/usr/bin/env bats
# check-doc-facts.bats — unit + acceptance tests for scripts/check-doc-facts.sh.
#
# This is the proof of the pillar: the gate must (a) PASS on the real committed
# templates (so it never wedges main), and (b) CATCH the recorded "8 vs 4" drift
# — a doc that declares 4 named queries while the code defines 8.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-doc-facts.sh"
PNQ="$REPO_ROOT/templates/system/workflows/n8n/postgres-named-queries.json"

setup() {
  _COMMON_TMP_PATHS=()
}

teardown() {
  common_teardown
}

# Write a fixture registry that points the check at the given code + doc files.
write_checks() { # dir codefile docfile
  cat > "$1/checks.json" <<JSON
{ "version": 1, "checks": [ {
  "id": "named-queries-set", "type": "name_set", "name_he": "x",
  "code": { "file": "$2", "extractor": "jq_const_array", "arg": "Normalize Input::valid" },
  "doc":  { "file": "$3", "extractor": "md_backtick_list_on_line", "arg": "read-only SELECTs" },
  "enforce": true } ] }
JSON
}

# --- regression anchor: the real templates must stay green ---

@test "ANCHOR: the real committed templates pass (named-query set in sync on main)" {
  run bash -c "cd '$REPO_ROOT' && bash scripts/check-doc-facts.sh"
  assert_success
  assert_output --partial "PASS"
}

# --- the value proof: catches the 8-vs-4 drift ---

@test "CATCH: doc declares 4 names while code defines 8 (the 8-vs-4 drift)" {
  dir="$(make_tmpdir)"
  cp "$PNQ" "$dir/pnq.json"
  cat > "$dir/AGENTS.md" <<'MD'
- **`postgres_named_query`** — a fixed whitelist of **four** read-only SELECTs (no free SQL): `style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`.
MD
  write_checks "$dir" "$dir/pnq.json" "$dir/AGENTS.md"
  run bash -c "FACT_CHECKS_FILE='$dir/checks.json' bash '$CHECK' 2>&1"
  assert_failure
  assert_output --partial "claim_actual_mismatch"
  assert_output --partial "content drift"
}

@test "EXCLUDES the pre-colon token: an exact-8 doc passes (proves postgres_named_query isn't counted)" {
  dir="$(make_tmpdir)"
  cp "$PNQ" "$dir/pnq.json"
  cat > "$dir/AGENTS.md" <<'MD'
- **`postgres_named_query`** — a fixed whitelist of **eight** read-only SELECTs (no free SQL): `style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`, `spend_total`, `conversation_transcript`, `tool_trace_recent`, `claim_actual_mismatch`.
MD
  write_checks "$dir" "$dir/pnq.json" "$dir/AGENTS.md"
  run bash -c "FACT_CHECKS_FILE='$dir/checks.json' bash '$CHECK'"
  assert_success
}

# --- fail closed, never silently pass on an empty extraction ---

@test "FAIL-CLOSED: code node without the valid array" {
  dir="$(make_tmpdir)"
  printf '%s' '{"nodes":[{"name":"Normalize Input","parameters":{"jsCode":"return [];"}}],"connections":{}}' > "$dir/pnq.json"
  cat > "$dir/AGENTS.md" <<'MD'
- **`postgres_named_query`** — read-only SELECTs: `style_profile_get`, `recent_audit_log`.
MD
  write_checks "$dir" "$dir/pnq.json" "$dir/AGENTS.md"
  run bash -c "FACT_CHECKS_FILE='$dir/checks.json' bash '$CHECK' 2>&1"
  assert_failure
  assert_output --partial "could not extract the fact from code"
}

@test "FAIL-CLOSED: doc without the anchor line" {
  dir="$(make_tmpdir)"
  cp "$PNQ" "$dir/pnq.json"
  printf '%s\n' "# a doc with no whitelist line at all" > "$dir/AGENTS.md"
  write_checks "$dir" "$dir/pnq.json" "$dir/AGENTS.md"
  run bash -c "FACT_CHECKS_FILE='$dir/checks.json' bash '$CHECK' 2>&1"
  assert_failure
  assert_output --partial "could not extract the declared fact from the doc"
}

@test "malformed registry JSON is a loud failure" {
  dir="$(make_tmpdir)"
  printf '%s' 'not json {{' > "$dir/checks.json"
  run bash -c "FACT_CHECKS_FILE='$dir/checks.json' bash '$CHECK' 2>&1"
  assert_failure
  assert_output --partial "not valid JSON"
}

@test "missing registry file is a loud failure" {
  run bash -c "FACT_CHECKS_FILE='/nonexistent/checks.json' bash '$CHECK' 2>&1"
  assert_failure
  assert_output --partial "not found"
}
