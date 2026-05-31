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
