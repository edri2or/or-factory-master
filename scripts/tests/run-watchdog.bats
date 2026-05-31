#!/usr/bin/env bats
# run-watchdog.bats — unit tests for scripts/run-watchdog.sh's gh-run-freshness
# proof logic. Deterministic: GitHub run history is injected via
# WATCHDOG_FIXTURE_DIR, "now" is pinned via WATCHDOG_NOW, and Telegram/emit/
# heartbeat are disabled — so no network or secrets are touched. Assertions are
# on the final "[watchdog] done ok=.. warn=.. red=.. unknown=.." summary line.

load test_helper/common

WATCHDOG="$REPO_ROOT/scripts/run-watchdog.sh"
NOW=1735732800   # 2025-01-01T12:00:00Z

setup() { _COMMON_TMP_PATHS=(); }
teardown() { common_teardown; }

# Build a one-entry registry + a fixture file for it. Echoes the case dir.
#   make_case <workflow_file> <tolerance_hours> <runs_json>
make_case() {
  local wf="$1" tol="$2" runs="$3" dir
  dir="$(make_tmpdir)"
  mkdir -p "$dir/fx"
  cat > "$dir/registry.json" <<EOF
{ "version": 1, "entries": [
  { "id": "t", "name_he": "בדיקה", "type": "cron-workflow", "layer": "factory",
    "proof_method": "gh-run-freshness",
    "cadence": { "cron": "0 * * * *", "tolerance_hours": ${tol} },
    "evidence": { "repo": "edri2or/or-factory-master", "workflow_file": "${wf}" },
    "stage": 1, "enabled": true } ] }
EOF
  printf '%s' "$runs" > "$dir/fx/${wf}.json"
  printf '%s\n' "$dir"
}

run_wd() {
  local dir="$1"
  REGISTRY_FILE="$dir/registry.json" \
  WATCHDOG_FIXTURE_DIR="$dir/fx" \
  WATCHDOG_NOW="$NOW" \
  WATCHDOG_EMIT=0 TG_TOKEN="" TG_CHAT="" HEARTBEAT_URL="" \
    bash "$WATCHDOG"
}

@test "ok: a fresh successful run is green" {
  dir="$(make_case wf.yml 9 \
    '{"workflow_runs":[{"status":"completed","conclusion":"success","updated_at":"2025-01-01T11:00:00Z","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "red: a success older than the tolerance window is stale" {
  dir="$(make_case wf.yml 9 \
    '{"workflow_runs":[{"status":"completed","conclusion":"success","updated_at":"2024-12-30T00:00:00Z","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=0 warn=0 red=1"
}

@test "warn: a single most-recent failure is watching (not yet red)" {
  dir="$(make_case wf.yml 9 \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","updated_at":"2025-01-01T11:00:00Z","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=0 warn=1 red=0"
}

@test "red: two consecutive failures escalate" {
  dir="$(make_case wf.yml 9 \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","updated_at":"2025-01-01T11:00:00Z","html_url":"https://x/3"},{"status":"completed","conclusion":"failure","updated_at":"2025-01-01T10:00:00Z","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "warn: a recent failure after a fresh success is watching" {
  dir="$(make_case wf.yml 9 \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","updated_at":"2025-01-01T11:30:00Z","html_url":"https://x/3"},{"status":"completed","conclusion":"success","updated_at":"2025-01-01T11:00:00Z","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "warn=1"
}

@test "unknown: no completed runs cannot be verified" {
  dir="$(make_case wf.yml 9 '{"workflow_runs":[]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "unknown=1"
}

# --- gh-branch-protection (stage 2) ----------------------------------------
# Build a one-entry gh-branch-protection registry + a branch-rules fixture
# (_rules_main.json) + a runs fixture for the gate's workflow.
#   make_bp_case <context> <workflow_file> <rules_json> <runs_json>
make_bp_case() {
  local ctx="$1" wf="$2" rules="$3" runs="$4" dir
  dir="$(make_tmpdir)"
  mkdir -p "$dir/fx"
  cat > "$dir/registry.json" <<EOF
{ "version": 1, "entries": [
  { "id": "g", "name_he": "שער", "type": "ci-gate", "layer": "factory",
    "proof_method": "gh-branch-protection",
    "evidence": { "repo": "edri2or/or-factory-master", "branch": "main",
                  "context": "${ctx}", "workflow_file": "${wf}" },
    "stage": 2, "enabled": true } ] }
EOF
  printf '%s' "$rules" > "$dir/fx/_rules_main.json"
  printf '%s' "$runs"  > "$dir/fx/${wf}.json"
  printf '%s\n' "$dir"
}

# A rules document where "Changelog gates" is a required status check.
BP_RULES_OK='[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Changelog gates"},{"context":"Playground tests"}]}}]'

@test "bp ok: required context + latest run green is green" {
  dir="$(make_bp_case "Changelog gates" cg.yml "$BP_RULES_OK" \
    '{"workflow_runs":[{"status":"completed","conclusion":"success","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "bp red: context dropped from branch protection is red even if file exists" {
  dir="$(make_bp_case "Supply chain gates" sc.yml "$BP_RULES_OK" \
    '{"workflow_runs":[{"status":"completed","conclusion":"success","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "bp red: required context but latest run failed is red" {
  dir="$(make_bp_case "Changelog gates" cg.yml "$BP_RULES_OK" \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "bp unknown: required context but no completed runs cannot be verified" {
  dir="$(make_bp_case "Changelog gates" cg.yml "$BP_RULES_OK" '{"workflow_runs":[]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "unknown=1"
}

@test "bp ok: required context + a skipped latest run is healthy (not red)" {
  dir="$(make_bp_case "Changelog gates" cg.yml "$BP_RULES_OK" \
    '{"workflow_runs":[{"status":"completed","conclusion":"skipped","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

# --- gh-last-run (stage 3, event-driven workflows) -------------------------
#   make_lastrun_case <workflow_file> <runs_json>
make_lastrun_case() {
  local wf="$1" runs="$2" dir
  dir="$(make_tmpdir)"
  mkdir -p "$dir/fx"
  cat > "$dir/registry.json" <<EOF
{ "version": 1, "entries": [
  { "id": "e", "name_he": "אירוע", "type": "event-workflow", "layer": "factory",
    "proof_method": "gh-last-run",
    "evidence": { "repo": "edri2or/or-factory-master", "branch": "main", "workflow_file": "${wf}" },
    "stage": 3, "enabled": true } ] }
EOF
  printf '%s' "$runs" > "$dir/fx/${wf}.json"
  printf '%s\n' "$dir"
}

@test "last-run ok: latest completed run is success (no staleness window)" {
  dir="$(make_lastrun_case ev.yml \
    '{"workflow_runs":[{"status":"completed","conclusion":"success","html_url":"https://x/1"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "last-run unknown: a never-run event workflow is ❓ not 🚨" {
  dir="$(make_lastrun_case ev.yml '{"workflow_runs":[]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "unknown=1"
  refute_output --partial "red=1"
}

@test "last-run warn: a single most-recent failure is watching" {
  dir="$(make_lastrun_case ev.yml \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "warn=1"
}

@test "last-run red: two consecutive failures escalate" {
  dir="$(make_lastrun_case ev.yml \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","html_url":"https://x/3"},{"status":"completed","conclusion":"failure","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "last-run ok: a skipped no-op run is healthy, not a failure" {
  # Real case: oil-autofix-verify runs on every push to main but skips unless
  # the commit is an OIL merge. Consecutive 'skipped' must NOT escalate to red.
  dir="$(make_lastrun_case ev.yml \
    '{"workflow_runs":[{"status":"completed","conclusion":"skipped","html_url":"https://x/3"},{"status":"completed","conclusion":"skipped","html_url":"https://x/2"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "last-run red: skipped most-recent does not mask an older real failure pair" {
  # skipped (newest) then two real failures → the skipped is healthy, but the
  # latest DECISIVE conclusion is a failure with a failing predecessor → red.
  dir="$(make_lastrun_case ev.yml \
    '{"workflow_runs":[{"status":"completed","conclusion":"failure","html_url":"https://x/4"},{"status":"completed","conclusion":"failure","html_url":"https://x/3"}]}')"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

# --- static-integrity (stage 3, hooks) -------------------------------------
# Build a one-entry static-integrity registry pointing at real temp files
# (absolute paths, so the proof's filesystem checks are hermetic).
#   make_hook_case <make_executable:0|1> <wire_it:0|1>
make_hook_case() {
  local exec_bit="$1" wire="$2" dir hook wired
  dir="$(make_tmpdir)"
  hook="$dir/the-hook.sh"
  wired="$dir/settings.json"
  printf '#!/usr/bin/env bash\necho hi\n' > "$hook"
  [ "$exec_bit" = "1" ] && chmod +x "$hook"
  if [ "$wire" = "1" ]; then
    printf '{ "hooks": { "command": "%s" } }\n' "$hook" > "$wired"
  else
    printf '{ "hooks": {} }\n' > "$wired"
  fi
  cat > "$dir/registry.json" <<EOF
{ "version": 1, "entries": [
  { "id": "h", "name_he": "הוק", "type": "hook", "layer": "factory",
    "proof_method": "static-integrity",
    "evidence": { "repo": "edri2or/or-factory-master", "path": "${hook}", "wired_in": "${wired}" },
    "stage": 3, "enabled": true } ] }
EOF
  printf '%s\n' "$dir"
}

@test "static-integrity ok: hook exists, executable, and wired" {
  dir="$(make_hook_case 1 1)"
  run run_wd "$dir"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "static-integrity red: hook exists but is not wired" {
  dir="$(make_hook_case 1 0)"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "static-integrity red: hook exists but is not executable" {
  dir="$(make_hook_case 0 1)"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

@test "static-integrity red: a missing hook is flagged" {
  dir="$(make_hook_case 1 1)"
  rm -f "$dir/the-hook.sh"
  run run_wd "$dir"
  assert_success
  assert_output --partial "red=1"
}

# --- n8n-execution (stage 4, dynamic per-system fan-out) -------------------
# A one-entry n8n-execution registry; systems are injected via
# WATCHDOG_SYSTEMS_OVERRIDE and each system's executions via fx/n8n_<sys>.json.
#   make_n8n_dir  → echoes a case dir with the registry + empty fx/
make_n8n_dir() {
  local dir
  dir="$(make_tmpdir)"
  mkdir -p "$dir/fx"
  cat > "$dir/registry.json" <<'EOF'
{ "version": 1, "entries": [
  { "id": "n", "name_he": "מערכות n8n", "type": "n8n-systems", "layer": "system",
    "proof_method": "n8n-execution",
    "evidence": { "systems_folder": "123180924297" },
    "stage": 4, "enabled": true } ] }
EOF
  printf '%s\n' "$dir"
}

# Run with an explicit systems list (override gcloud) + fixture dir.
run_n8n() {
  local dir="$1" systems="$2"
  REGISTRY_FILE="$dir/registry.json" \
  WATCHDOG_FIXTURE_DIR="$dir/fx" \
  WATCHDOG_SYSTEMS_OVERRIDE="$systems" \
  WATCHDOG_EMIT=0 TG_TOKEN="" TG_CHAT="" HEARTBEAT_URL="" \
    bash "$WATCHDOG"
}

@test "n8n unknown: zero deployed systems is ❓, not 🚨" {
  dir="$(make_n8n_dir)"
  run run_n8n "$dir" ""
  assert_success
  assert_output --partial "unknown=1"
  refute_output --partial "red=1"
}

@test "n8n unknown: the shared factory-test-25 backend is skipped" {
  dir="$(make_n8n_dir)"
  run run_n8n "$dir" "factory-test-25"
  assert_success
  assert_output --partial "unknown=1"
}

@test "n8n ok: a system whose latest execution succeeded is green" {
  dir="$(make_n8n_dir)"
  printf '%s' '{"data":[{"status":"success","finished":true}]}' > "$dir/fx/n8n_sys-a.json"
  run run_n8n "$dir" "sys-a"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "n8n red: a system whose latest execution errored is 🚨" {
  dir="$(make_n8n_dir)"
  printf '%s' '{"data":[{"status":"error","finished":true}]}' > "$dir/fx/n8n_sys-a.json"
  run run_n8n "$dir" "sys-a"
  assert_success
  assert_output --partial "red=1"
}

@test "n8n ❓: a deployed system with no executions is unresolvable, not 🚨" {
  dir="$(make_n8n_dir)"
  printf '%s' '{"data":[]}' > "$dir/fx/n8n_sys-a.json"
  run run_n8n "$dir" "sys-a"
  assert_success
  assert_output --partial "unknown=1"
  refute_output --partial "red=1"
}

@test "n8n red: one errored system among healthy ones makes the aggregate 🚨" {
  dir="$(make_n8n_dir)"
  printf '%s' '{"data":[{"status":"success"}]}' > "$dir/fx/n8n_ok-sys.json"
  printf '%s' '{"data":[{"status":"error"}]}'   > "$dir/fx/n8n_bad-sys.json"
  run run_n8n "$dir" "ok-sys bad-sys"
  assert_success
  assert_output --partial "red=1"
}

# --- system-branch-protection (stage 4, dynamic per-system fan-out) ----------
# A one-entry system-branch-protection registry requiring two CI contexts;
# systems are injected via WATCHDOG_SYSTEMS_OVERRIDE and each system's branch
# rules via fx/_sysbp_<sys>.json. Asserts the watchdog catches a context that
# was dropped from a system's branch protection (🚨), while unresolvable
# systems (no rules fixture) and zero systems stay ❓ — never a false 🚨.
make_sysbp_dir() {
  local dir
  dir="$(make_tmpdir)"
  mkdir -p "$dir/fx"
  cat > "$dir/registry.json" <<'EOF'
{ "version": 1, "entries": [
  { "id": "sbp", "name_he": "הגנת-ענף במערכות", "type": "system-github", "layer": "system",
    "proof_method": "system-branch-protection",
    "evidence": { "systems_folder": "123180924297", "branch": "main",
                  "required_contexts": ["Changelog gates", "shellcheck + yamllint"] },
    "stage": 4, "enabled": true } ] }
EOF
  printf '%s\n' "$dir"
}

run_sysbp() {
  local dir="$1" systems="$2"
  REGISTRY_FILE="$dir/registry.json" \
  WATCHDOG_FIXTURE_DIR="$dir/fx" \
  WATCHDOG_SYSTEMS_OVERRIDE="$systems" \
  WATCHDOG_EMIT=0 TG_TOKEN="" TG_CHAT="" HEARTBEAT_URL="" \
    bash "$WATCHDOG"
}

# Rules document where both required contexts are enforced.
SBP_RULES_OK='[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Changelog gates"},{"context":"shellcheck + yamllint"}]}}]'
# Rules document missing the second required context (protection weakened).
SBP_RULES_WEAK='[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Changelog gates"}]}}]'

@test "sysbp unknown: zero deployed systems is ❓, not 🚨" {
  dir="$(make_sysbp_dir)"
  run run_sysbp "$dir" ""
  assert_success
  assert_output --partial "unknown=1"
  refute_output --partial "red=1"
}

@test "sysbp unknown: the shared factory-test-25 backend is skipped" {
  dir="$(make_sysbp_dir)"
  run run_sysbp "$dir" "factory-test-25"
  assert_success
  assert_output --partial "unknown=1"
}

@test "sysbp ok: a system enforcing every required context is green" {
  dir="$(make_sysbp_dir)"
  printf '%s' "$SBP_RULES_OK" > "$dir/fx/_sysbp_sys-a.json"
  run run_sysbp "$dir" "sys-a"
  assert_success
  assert_output --partial "ok=1 warn=0 red=0 unknown=0"
}

@test "sysbp red: a system missing a required context is 🚨" {
  dir="$(make_sysbp_dir)"
  printf '%s' "$SBP_RULES_WEAK" > "$dir/fx/_sysbp_sys-a.json"
  run run_sysbp "$dir" "sys-a"
  assert_success
  assert_output --partial "red=1"
}

@test "sysbp ❓: a system with no rules fixture is unresolvable, not 🚨" {
  dir="$(make_sysbp_dir)"
  run run_sysbp "$dir" "sys-a"
  assert_success
  assert_output --partial "unknown=1"
  refute_output --partial "red=1"
}

@test "sysbp red: one weakened system among healthy ones makes the aggregate 🚨" {
  dir="$(make_sysbp_dir)"
  printf '%s' "$SBP_RULES_OK"   > "$dir/fx/_sysbp_ok-sys.json"
  printf '%s' "$SBP_RULES_WEAK" > "$dir/fx/_sysbp_bad-sys.json"
  run run_sysbp "$dir" "ok-sys bad-sys"
  assert_success
  assert_output --partial "red=1"
}
