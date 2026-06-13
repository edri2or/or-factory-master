#!/usr/bin/env bash
# Meta-monitoring watchdog — reads the registry, proves each enabled+in-stage
# automation actually ran and worked, builds a Hebrew Telegram heartbeat report
# with a direct evidence link per entry, emits one observability event, writes a
# GitHub step-summary table, and pings the external dead-man's-switch.
#
# Philosophy (same as scripts/emit-event.sh): per-entry soft-fail — one API
# error never blanks the report or aborts the run. The watchdog exits 0 even
# when it FINDS problems (its success = "I ran and reported"); the problems are
# carried in the report / Telegram / Linear. It exits non-zero only when its own
# setup is broken (registry missing/unparseable), so a real watchdog breakage
# shows as a failed run AND a missed heartbeat.
#
# Inputs (all via env; sensible defaults so it is unit-testable):
#   REGISTRY_FILE          default monitoring/watchdog-registry.json
#   CURRENT_STAGE          default 1   (only assert entries with stage<=this)
#   GH_API                 default https://api.github.com
#   GH_API_TOKEN           GitHub token for gh-run-freshness (empty => entries "❓")
#   TG_TOKEN / TG_CHAT     Telegram bot token + chat id (empty => skip the send)
#   HEARTBEAT_URL          Better Stack heartbeat ping URL (empty => skip ping)
#   GITHUB_RUN_ID          for the emit-event trail (default "local")
#   GITHUB_STEP_SUMMARY    if set, a Hebrew table is appended
#   WATCHDOG_EMIT          "1" (default) calls emit-event.sh; "0" skips (tests)
#   WATCHDOG_NOW           override "now" epoch seconds (tests)
#   WATCHDOG_FIXTURE_DIR   if set, read "<dir>/<workflow_file>.json" instead of
#                          calling the GitHub API (deterministic tests)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${REGISTRY_FILE:-monitoring/watchdog-registry.json}"
CURRENT_STAGE="${CURRENT_STAGE:-4}"
GH_API="${GH_API:-https://api.github.com}"
GH_API_TOKEN="${GH_API_TOKEN:-}"
TG_TOKEN="${TG_TOKEN:-}"
TG_CHAT="${TG_CHAT:-}"
HEARTBEAT_URL="${HEARTBEAT_URL:-}"
NOW="${WATCHDOG_NOW:-$(date +%s)}"

[ -f "$REGISTRY_FILE" ] || { echo "watchdog: registry not found: $REGISTRY_FILE" >&2; exit 1; }
jq empty "$REGISTRY_FILE" 2>/dev/null || { echo "watchdog: registry is not valid JSON: $REGISTRY_FILE" >&2; exit 1; }

# Per-entry result, set by the proof functions.
R_STATUS=""    # ok | warn | red | unknown | pending
R_DETAIL_HE="" # Hebrew one-liner
R_URL=""       # clickable evidence link

# GitHub run conclusions that mean the automation actually FAILED. NOTE that
# `skipped` (a conditional no-op — e.g. oil-autofix-verify runs on every push to
# main but skips unless the commit is an OIL merge) and `neutral`/`stale` are
# healthy, NOT failures — treating them as red is a false positive.
_conclusion_is_failing() {
  case "$1" in
    failure|cancelled|timed_out|startup_failure|action_required) return 0 ;;
    *) return 1 ;;
  esac
}

# --- proof: gh-run-freshness ------------------------------------------------
# Asserts a scheduled/event workflow has a recent successful run on main.
proof_gh_run_freshness() {
  local entry="$1"
  local repo wf tol
  repo=$(jq -r '.evidence.repo // empty' <<<"$entry")
  wf=$(jq -r '.evidence.workflow_file // empty' <<<"$entry")
  tol=$(jq -r '.cadence.tolerance_hours // 24' <<<"$entry")
  R_URL="https://github.com/${repo}/actions/workflows/${wf}"

  local runs_json
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/${wf}.json"
    [ -f "$fx" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין fixture לבדיקה"; return; }
    runs_json=$(cat "$fx")
  else
    [ -n "$GH_API_TOKEN" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין טוקן ל-GitHub API"; return; }
    local body http
    body=$(mktemp)
    http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${GH_API_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "${GH_API}/repos/${repo}/actions/workflows/${wf}/runs?branch=main&per_page=10" 2>/dev/null) || http="000"
    case "$http" in
      2*) runs_json=$(cat "$body") ;;
      *)  R_STATUS="unknown"; R_DETAIL_HE="GitHub API HTTP ${http}"; rm -f "$body"; return ;;
    esac
    rm -f "$body"
  fi

  # First (newest) successful run, and the two newest COMPLETED conclusions.
  local succ_time succ_url c1 u1 c2
  succ_time=$(jq -r 'first(.workflow_runs[]? | select(.conclusion=="success") | .updated_at) // empty' <<<"$runs_json" 2>/dev/null)
  succ_url=$(jq  -r 'first(.workflow_runs[]? | select(.conclusion=="success") | .html_url)   // empty' <<<"$runs_json" 2>/dev/null)
  c1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .conclusion) // empty' <<<"$runs_json" 2>/dev/null)
  u1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .html_url)   // empty' <<<"$runs_json" 2>/dev/null)
  c2=$(jq -r '[.workflow_runs[]? | select(.status=="completed") | .conclusion][1]   // empty' <<<"$runs_json" 2>/dev/null)

  if [ -z "$c1" ]; then R_STATUS="unknown"; R_DETAIL_HE="אין ריצות שהושלמו"; return; fi

  # Freshness of the latest success.
  local succ_epoch=0 age_h=0
  if [ -n "$succ_time" ]; then
    succ_epoch=$(date -d "$succ_time" +%s 2>/dev/null || echo 0)
    [ "$succ_epoch" -gt 0 ] && age_h=$(( (NOW - succ_epoch) / 3600 ))
  fi

  if [ -n "$succ_time" ] && [ "$succ_epoch" -gt 0 ] && [ "$age_h" -le "$tol" ]; then
    if [ "$c1" = "success" ]; then
      R_STATUS="ok"; R_URL="$succ_url"; R_DETAIL_HE="רץ בהצלחה לפני ${age_h}ש'"
    elif ! _conclusion_is_failing "$c1"; then
      R_STATUS="ok"; R_URL="$succ_url"; R_DETAIL_HE="הצלחה אחרונה לפני ${age_h}ש' (אחרון דילג: ${c1})"
    elif [ -n "$c2" ] && _conclusion_is_failing "$c2"; then
      R_STATUS="red"; R_URL="$u1"; R_DETAIL_HE="2 כשלים רצופים (אחרון: ${c1})"
    else
      R_STATUS="warn"; R_URL="$u1"; R_DETAIL_HE="כשל אחרון (${c1}) — עוקב"
    fi
    return
  fi

  # No fresh success → stale, or failing.
  if [ "$c1" = "success" ]; then
    R_STATUS="red"; [ -n "$succ_url" ] && R_URL="$succ_url"
    R_DETAIL_HE="הריצה האחרונה הצליחה אך מעבר לחלון (${tol}ש')"
  elif ! _conclusion_is_failing "$c1"; then
    R_STATUS="unknown"; R_URL="$u1"; R_DETAIL_HE="אין הצלחה טרייה (אחרון דילג: ${c1})"
  elif [ -n "$c2" ] && _conclusion_is_failing "$c2"; then
    R_STATUS="red"; R_URL="$u1"; R_DETAIL_HE="2 כשלים רצופים (אחרון: ${c1})"
  else
    R_STATUS="warn"; R_URL="$u1"; R_DETAIL_HE="כשל אחרון (${c1}) — עוקב"
  fi
}

# --- proof: gh-branch-protection -------------------------------------------
# Asserts a CI gate is STILL enforced: its check `context` must still be in the
# branch's required-status-checks (the protect-main ruleset) AND the gate's
# latest completed run on the branch must be green. A context dropped from
# branch protection is 🚨 even when the workflow file still exists — the file
# living on is not proof the gate is enforced.
proof_gh_branch_protection() {
  local entry="$1"
  local repo branch context wf
  repo=$(jq -r '.evidence.repo // empty' <<<"$entry")
  branch=$(jq -r '.evidence.branch // "main"' <<<"$entry")
  context=$(jq -r '.evidence.context // empty' <<<"$entry")
  wf=$(jq -r '.evidence.workflow_file // empty' <<<"$entry")
  R_URL="https://github.com/${repo}/settings/rules"

  # 1) Rules in effect for the branch (rulesets + legacy protection, flattened).
  local rules_json
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local rfx="${WATCHDOG_FIXTURE_DIR}/_rules_${branch}.json"
    [ -f "$rfx" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין fixture לכללי הענף"; return; }
    rules_json=$(cat "$rfx")
  else
    [ -n "$GH_API_TOKEN" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין טוקן ל-GitHub API"; return; }
    local body http
    body=$(mktemp)
    http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${GH_API_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "${GH_API}/repos/${repo}/rules/branches/${branch}" 2>/dev/null) || http="000"
    case "$http" in
      2*) rules_json=$(cat "$body") ;;
      *)  R_STATUS="unknown"; R_DETAIL_HE="GitHub API HTTP ${http} (כללי ענף)"; rm -f "$body"; return ;;
    esac
    rm -f "$body"
  fi

  # Is the context present in any required_status_checks rule for the branch?
  local present
  present=$(jq -r --arg c "$context" \
    '[ .[]? | select(.type=="required_status_checks")
            | .parameters.required_status_checks[]? | .context ] | index($c) // empty' \
    <<<"$rules_json" 2>/dev/null)
  if [ -z "$present" ]; then
    R_STATUS="red"; R_DETAIL_HE="השער הוסר מהגנת-הענף (context: ${context})"
    return
  fi

  # 2) Context still required → the gate's latest completed run on the branch
  #    must be green.
  local runs_json
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local sfx="${WATCHDOG_FIXTURE_DIR}/${wf}.json"
    [ -f "$sfx" ] || { R_STATUS="unknown"; R_DETAIL_HE="נדרש בהגנת-הענף, אך אין fixture לריצות"; return; }
    runs_json=$(cat "$sfx")
  else
    local body http
    body=$(mktemp)
    http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${GH_API_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "${GH_API}/repos/${repo}/actions/workflows/${wf}/runs?branch=${branch}&per_page=5" 2>/dev/null) || http="000"
    case "$http" in
      2*) runs_json=$(cat "$body") ;;
      *)  R_STATUS="unknown"; R_DETAIL_HE="נדרש בהגנת-הענף, אך GitHub API HTTP ${http}"; rm -f "$body"; return ;;
    esac
    rm -f "$body"
  fi

  local c1 u1
  c1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .conclusion) // empty' <<<"$runs_json" 2>/dev/null)
  u1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .html_url)   // empty' <<<"$runs_json" 2>/dev/null)
  [ -n "$u1" ] && R_URL="$u1"

  if [ -z "$c1" ]; then
    R_STATUS="unknown"; R_DETAIL_HE="נדרש בהגנת-הענף, אך אין ריצות שהושלמו"
  elif ! _conclusion_is_failing "$c1"; then
    R_STATUS="ok"; R_DETAIL_HE="נדרש בהגנת-הענף + הריצה האחרונה על ${branch} ירוקה"
  else
    R_STATUS="red"; R_DETAIL_HE="נדרש בהגנת-הענף, אך הריצה האחרונה נכשלה (${c1})"
  fi
}

# --- proof: gh-last-run -----------------------------------------------------
# For EVENT-driven workflows (push/repository_dispatch/PR — no cron, so no
# freshness window): the latest COMPLETED run on the branch must be green.
# A workflow that legitimately hasn't run yet is ❓ (not 🚨); a single recent
# failure is ⚠️ "watching"; two consecutive failures escalate to 🚨.
proof_gh_last_run() {
  local entry="$1"
  local repo wf branch
  repo=$(jq -r '.evidence.repo // empty' <<<"$entry")
  wf=$(jq -r '.evidence.workflow_file // empty' <<<"$entry")
  branch=$(jq -r '.evidence.branch // "main"' <<<"$entry")
  R_URL="https://github.com/${repo}/actions/workflows/${wf}"

  local runs_json
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/${wf}.json"
    [ -f "$fx" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין fixture לבדיקה"; return; }
    runs_json=$(cat "$fx")
  else
    [ -n "$GH_API_TOKEN" ] || { R_STATUS="unknown"; R_DETAIL_HE="אין טוקן ל-GitHub API"; return; }
    local body http
    body=$(mktemp)
    http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${GH_API_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "${GH_API}/repos/${repo}/actions/workflows/${wf}/runs?branch=${branch}&per_page=10" 2>/dev/null) || http="000"
    case "$http" in
      2*) runs_json=$(cat "$body") ;;
      *)  R_STATUS="unknown"; R_DETAIL_HE="GitHub API HTTP ${http}"; rm -f "$body"; return ;;
    esac
    rm -f "$body"
  fi

  local c1 u1 c2
  c1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .conclusion) // empty' <<<"$runs_json" 2>/dev/null)
  u1=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .html_url)   // empty' <<<"$runs_json" 2>/dev/null)
  c2=$(jq -r '[.workflow_runs[]? | select(.status=="completed") | .conclusion][1]   // empty' <<<"$runs_json" 2>/dev/null)
  [ -n "$u1" ] && R_URL="$u1"

  if [ -z "$c1" ]; then
    R_STATUS="unknown"; R_DETAIL_HE="אין ריצות שהושלמו (לא רץ עדיין)"
  elif [ "$c1" = "success" ]; then
    R_STATUS="ok"; R_DETAIL_HE="הריצה האחרונה על ${branch} הצליחה"
  elif ! _conclusion_is_failing "$c1"; then
    R_STATUS="ok"; R_DETAIL_HE="הריצה האחרונה דילגה (no-op תקין: ${c1})"
  elif [ -n "$c2" ] && _conclusion_is_failing "$c2"; then
    R_STATUS="red"; R_DETAIL_HE="2 כשלים רצופים (אחרון: ${c1})"
  else
    R_STATUS="warn"; R_DETAIL_HE="כשל אחרון (${c1}) — עוקב"
  fi
}

# --- proof: static-integrity ------------------------------------------------
# For hooks: the script exists, is executable, and is STILL wired at its
# registration point (e.g. referenced in .claude/settings.json). A hook that
# exists but is no longer wired is 🚨 — the file living on is not proof it runs.
proof_static_integrity() {
  local entry="$1"
  local path wired repo
  path=$(jq -r '.evidence.path // empty' <<<"$entry")
  wired=$(jq -r '.evidence.wired_in // empty' <<<"$entry")
  repo=$(jq -r '.evidence.repo // "edri2or/or-factory-master"' <<<"$entry")
  R_URL="https://github.com/${repo}/blob/main/${path}"

  if [ ! -f "$path" ]; then
    R_STATUS="red"; R_DETAIL_HE="ה-hook חסר (${path})"; return
  fi
  if [ ! -x "$path" ]; then
    R_STATUS="red"; R_DETAIL_HE="ה-hook קיים אך לא ניתן-להרצה"; return
  fi
  if [ -n "$wired" ]; then
    if [ ! -f "$wired" ] || ! grep -qF "$path" "$wired"; then
      R_STATUS="red"; R_DETAIL_HE="ה-hook קיים אך לא מחווט ב-${wired}"; return
    fi
    R_STATUS="ok"; R_DETAIL_HE="קיים, ניתן-להרצה, ומחווט ב-${wired}"
  else
    R_STATUS="ok"; R_DETAIL_HE="קיים וניתן-להרצה"
  fi
}

# Classify ONE system's latest n8n execution. Echoes a token:
#   success | error | none | unresolvable
# Mirrors the MCP n8n-client auth: read the system's SM `n8n-api-key` and GET
# /api/v1/executions?limit=1 with header X-N8N-API-KEY. Tests inject the API
# response via WATCHDOG_FIXTURE_DIR/n8n_<sys>.json (no gcloud, no network).
_n8n_latest_status() {
  local sys="$1" resp st cnt
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/n8n_${sys}.json"
    [ -f "$fx" ] || { echo "unresolvable"; return; }
    resp=$(cat "$fx")
  else
    local key body http
    key=$(gcloud secrets versions access latest --secret="n8n-api-key" --project="$sys" 2>/dev/null) || { echo "unresolvable"; return; }
    [ -n "$key" ] || { echo "unresolvable"; return; }
    body=$(mktemp)
    http=$(curl -sS -m 15 -o "$body" -w '%{http_code}' \
      -H "X-N8N-API-KEY: ${key}" -H "accept: application/json" \
      "https://n8n-${sys}.or-infra.com/api/v1/executions?limit=1" 2>/dev/null) || http="000"
    case "$http" in
      2*) resp=$(cat "$body") ;;
      *)  rm -f "$body"; echo "unresolvable"; return ;;
    esac
    rm -f "$body"
  fi

  cnt=$(jq -r '.data | length' <<<"$resp" 2>/dev/null || echo "0")
  [ "$cnt" = "0" ] && { echo "none"; return; }
  st=$(jq -r '.data[0].status // empty' <<<"$resp" 2>/dev/null)
  case "$st" in
    success)       echo "success" ;;
    error|crashed) echo "error" ;;
    *)             echo "none" ;;   # running/waiting/canceled/unknown — not decisive
  esac
}

# --- proof: n8n-execution ---------------------------------------------------
# DYNAMIC fan-out (like system-runtime-audit.yml): enumerate the real systems
# (own GCP project under the Systems folder; the shared test backend
# factory-test-25 is skipped), check each system's latest n8n execution, and
# aggregate into ONE line. Systems that can't be resolved (no api-key / not
# deployed / no executions) are ❓, never 🚨. Zero systems → ❓.
proof_n8n_execution() {
  local entry="$1"
  local folder
  folder=$(jq -r '.evidence.systems_folder // "123180924297"' <<<"$entry")
  R_URL="https://github.com/edri2or/or-factory-master/blob/main/monitoring/watchdog-registry.json"

  local systems
  if [ -n "${WATCHDOG_SYSTEMS_OVERRIDE:-}" ]; then
    systems="$WATCHDOG_SYSTEMS_OVERRIDE"
  elif [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    systems=""   # tests drive systems via WATCHDOG_SYSTEMS_OVERRIDE
  else
    systems=$(gcloud projects list --filter="parent.id=${folder}" --format='value(projectId)' 2>/dev/null || echo "")
  fi

  local total=0 okc=0 redc=0 unkc=0 redlist=""
  local sys concl
  for sys in $systems; do
    [ "$sys" = "factory-test-25" ] && continue
    total=$((total + 1))
    concl=$(_n8n_latest_status "$sys")
    case "$concl" in
      success) okc=$((okc + 1)) ;;
      error)   redc=$((redc + 1)); redlist="${redlist}${sys} " ;;
      *)       unkc=$((unkc + 1)) ;;
    esac
  done

  if [ "$total" -eq 0 ]; then
    R_STATUS="unknown"; R_DETAIL_HE="אין מערכות פרוסות תחת התיקייה"
  elif [ "$redc" -gt 0 ]; then
    R_STATUS="red"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ · ${redc} 🚨 (${redlist%% }) · ${unkc} ❓"
  elif [ "$okc" -gt 0 ]; then
    R_STATUS="ok"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ · ${unkc} ❓"
  else
    R_STATUS="unknown"; R_DETAIL_HE="${total} מערכות — אף ביצוע n8n לא ניתן-לאימות (❓)"
  fi
}

# --- proof: n8n-workflow-liveness ------------------------------------------
# PER-WORKFLOW liveness (the granular sibling of n8n-execution, which only checks
# ONE latest execution per system). For each real system, list every workflow and
# check each ACTIVE one's latest execution. Flags 🔴: an active workflow whose
# latest execution errored/crashed, OR an active SCHEDULE-triggered workflow that
# NEVER ran (zero executions — exactly how DB Vacuum hid). An active webhook/other
# workflow with no executions is NOT flagged (legitimately may be unused, e.g. on a
# fresh deploy). Inactive workflows (sub-workflows / disabled) are skipped. Tests
# inject the workflows list via WATCHDOG_FIXTURE_DIR/n8n_workflows_<sys>.json and a
# per-workflow latest execution via n8n_wfexec_<sys>_<wfid>.json (no gcloud/network).

# Fetch one system's workflows-list JSON (fixture or live). Echoes JSON or "".
_n8n_workflows_json() {
  local sys="$1"
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/n8n_workflows_${sys}.json"
    [ -f "$fx" ] && cat "$fx" || echo ""
    return
  fi
  local key body http
  key=$(gcloud secrets versions access latest --secret="n8n-api-key" --project="$sys" 2>/dev/null) || { echo ""; return; }
  [ -n "$key" ] || { echo ""; return; }
  body=$(mktemp)
  http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
    -H "X-N8N-API-KEY: ${key}" -H "accept: application/json" \
    "https://n8n-${sys}.or-infra.com/api/v1/workflows?limit=250" 2>/dev/null) || http="000"
  case "$http" in 2*) cat "$body" ;; *) echo "" ;; esac
  rm -f "$body"
}

# Echo one workflow's latest-execution token: success | error | none | unresolvable
_n8n_wf_exec_status() {
  local sys="$1" wfid="$2" resp st cnt
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/n8n_wfexec_${sys}_${wfid}.json"
    [ -f "$fx" ] || { echo "unresolvable"; return; }
    resp=$(cat "$fx")
  else
    local key body http
    key=$(gcloud secrets versions access latest --secret="n8n-api-key" --project="$sys" 2>/dev/null) || { echo "unresolvable"; return; }
    [ -n "$key" ] || { echo "unresolvable"; return; }
    body=$(mktemp)
    http=$(curl -sS -m 15 -o "$body" -w '%{http_code}' \
      -H "X-N8N-API-KEY: ${key}" -H "accept: application/json" \
      "https://n8n-${sys}.or-infra.com/api/v1/executions?workflowId=${wfid}&limit=1" 2>/dev/null) || http="000"
    case "$http" in 2*) resp=$(cat "$body") ;; *) rm -f "$body"; echo "unresolvable"; return ;; esac
    rm -f "$body"
  fi
  cnt=$(jq -r '.data | length' <<<"$resp" 2>/dev/null || echo "0")
  [ "$cnt" = "0" ] && { echo "none"; return; }
  st=$(jq -r '.data[0].status // empty' <<<"$resp" 2>/dev/null)
  case "$st" in
    success)       echo "success" ;;
    error|crashed) echo "error" ;;
    *)             echo "running" ;;
  esac
}

# Per-system per-workflow verdict. Echoes: ok | bad:<names> | none(unresolvable)
_n8n_workflow_liveness_per_system() {
  local sys="$1" wfjson checked=0 badnames="" id name active sched est
  wfjson=$(_n8n_workflows_json "$sys")
  [ -n "$wfjson" ] || { echo "none"; return; }
  while IFS=$'\t' read -r id name active sched; do
    [ -n "$id" ] || continue
    [ "$active" = "true" ] || continue
    checked=$((checked + 1))
    est=$(_n8n_wf_exec_status "$sys" "$id")
    case "$est" in
      error) badnames="${badnames}${name} " ;;
      none)  [ "$sched" = "true" ] && badnames="${badnames}${name}(never) " ;;
      *)     : ;;
    esac
  done < <(jq -r '.data[]? | [ (.id|tostring), (.name // "?"), (.active|tostring), ([.nodes[]?.type] | map(test("scheduleTrigger";"i")) | any | tostring) ] | @tsv' <<<"$wfjson" 2>/dev/null)
  if [ -n "$badnames" ]; then echo "bad:${badnames% }"; return; fi
  [ "$checked" -gt 0 ] && { echo "ok"; return; }
  echo "none"
}

proof_n8n_workflow_liveness() {
  local entry="$1" folder
  folder=$(jq -r '.evidence.systems_folder // "123180924297"' <<<"$entry")
  R_URL="https://github.com/edri2or/or-factory-master/blob/main/monitoring/watchdog-registry.json"

  local systems
  if [ -n "${WATCHDOG_SYSTEMS_OVERRIDE:-}" ]; then
    systems="$WATCHDOG_SYSTEMS_OVERRIDE"
  elif [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    systems=""
  else
    systems=$(gcloud projects list --filter="parent.id=${folder}" --format='value(projectId)' 2>/dev/null || echo "")
  fi

  local total=0 okc=0 redc=0 unkc=0 redlist="" sys concl
  for sys in $systems; do
    [ "$sys" = "factory-test-25" ] && continue
    total=$((total + 1))
    concl=$(_n8n_workflow_liveness_per_system "$sys")
    case "$concl" in
      ok)    okc=$((okc + 1)) ;;
      bad:*) redc=$((redc + 1)); redlist="${redlist}${sys}[${concl#bad:}] " ;;
      *)     unkc=$((unkc + 1)) ;;
    esac
  done

  if [ "$total" -eq 0 ]; then
    R_STATUS="unknown"; R_DETAIL_HE="אין מערכות פרוסות תחת התיקייה"
  elif [ "$redc" -gt 0 ]; then
    R_STATUS="red"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ · ${redc} 🚨 workflows לא-חיים (${redlist%% }) · ${unkc} ❓"
  elif [ "$okc" -gt 0 ]; then
    R_STATUS="ok"; R_DETAIL_HE="${total} מערכות: כל ה-workflows הפעילים עם ריצה תקינה · ${unkc} ❓"
  else
    R_STATUS="unknown"; R_DETAIL_HE="${total} מערכות — workflows לא ניתנים-לאימות (❓)"
  fi
}

# Echo the space-separated real-system list for the per-system GitHub fan-out
# proof methods below. Mirrors proof_n8n_execution's discovery: tests inject the
# list via WATCHDOG_SYSTEMS_OVERRIDE (no gcloud); otherwise enumerate GCP
# projects under the Systems folder. The shared test backend factory-test-25 is
# filtered by the callers, exactly like the n8n fan-out.
_enumerate_systems() {
  local folder="$1"
  if [ -n "${WATCHDOG_SYSTEMS_OVERRIDE:-}" ]; then
    printf '%s\n' "$WATCHDOG_SYSTEMS_OVERRIDE"
  elif [ -z "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    gcloud projects list --filter="parent.id=${folder}" --format='value(projectId)' 2>/dev/null || true
  fi
}

# Per-system branch-protection status, reusing proof_gh_branch_protection's
# rules read + the "context present in any required_status_checks rule" jq
# filter — applied per system over EVERY required context. Returns:
#   ok           — every required context is still enforced on the branch
#   red          — ≥1 required context was removed (protection weakened)
#   unresolvable — no token / HTTP non-2xx / no repo (❓, never 🚨)
# Tests inject the rules document via WATCHDOG_FIXTURE_DIR/_sysbp_<sys>.json.
_system_bp_status() {
  local sys="$1" branch="$2" contexts_nl="$3" rules_json
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/_sysbp_${sys}.json"
    [ -f "$fx" ] || { echo "unresolvable"; return; }
    rules_json=$(cat "$fx")
  else
    [ -n "$GH_API_TOKEN" ] || { echo "unresolvable"; return; }
    local body http
    body=$(mktemp)
    http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer ${GH_API_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "${GH_API}/repos/edri2or/${sys}/rules/branches/${branch}" 2>/dev/null) || http="000"
    case "$http" in
      2*) rules_json=$(cat "$body") ;;
      *)  rm -f "$body"; echo "unresolvable"; return ;;
    esac
    rm -f "$body"
  fi

  local ctx present
  while IFS= read -r ctx; do
    [ -n "$ctx" ] || continue
    present=$(jq -r --arg c "$ctx" \
      '[ .[]? | select(.type=="required_status_checks")
              | .parameters.required_status_checks[]? | .context ] | index($c) // empty' \
      <<<"$rules_json" 2>/dev/null)
    [ -z "$present" ] && { echo "red"; return; }
  done <<<"$contexts_nl"
  echo "ok"
}

# --- proof: system-branch-protection ----------------------------------------
# DYNAMIC per-system fan-out: for each real system, confirm its main-branch
# protection still enforces EVERY required CI context (evidence.required_contexts
# — the 4 governance gates). A removed context → 🚨 (protection silently
# weakened); a system that can't be resolved (no repo / no token / API error) →
# ❓, never 🚨. Zero systems → ❓. Aggregated to ONE line, like n8n-execution.
proof_system_branch_protection() {
  local entry="$1" folder branch contexts_nl
  folder=$(jq -r '.evidence.systems_folder // "123180924297"' <<<"$entry")
  branch=$(jq -r '.evidence.branch // "main"' <<<"$entry")
  contexts_nl=$(jq -r '.evidence.required_contexts[]? // empty' <<<"$entry")
  R_URL="https://github.com/edri2or/or-factory-master/blob/main/monitoring/watchdog-registry.json"

  local systems
  systems=$(_enumerate_systems "$folder")

  local total=0 okc=0 redc=0 unkc=0 redlist=""
  local sys st
  for sys in $systems; do
    [ "$sys" = "factory-test-25" ] && continue
    total=$((total + 1))
    st=$(_system_bp_status "$sys" "$branch" "$contexts_nl")
    case "$st" in
      ok)  okc=$((okc + 1)) ;;
      red) redc=$((redc + 1)); redlist="${redlist}${sys} " ;;
      *)   unkc=$((unkc + 1)) ;;
    esac
  done

  if [ "$total" -eq 0 ]; then
    R_STATUS="unknown"; R_DETAIL_HE="אין מערכות פרוסות תחת התיקייה"
  elif [ "$redc" -gt 0 ]; then
    R_STATUS="red"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ · ${redc} 🚨 הגנת-ענף נחלשה (${redlist%% }) · ${unkc} ❓"
  elif [ "$okc" -gt 0 ]; then
    R_STATUS="ok"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ הגנת-ענף אוכפת · ${unkc} ❓"
  else
    R_STATUS="unknown"; R_DETAIL_HE="${total} מערכות — הגנת-הענף לא ניתנת-לאימות (❓)"
  fi
}

# The system CI/deploy workflows whose latest main run must not be a failure.
# 4 governance gates + the deploy workflow — exactly the files provision-system.yml
# ships into every new system repo. Overridable per registry entry via
# evidence.workflows[].
SYSTEM_CI_WORKFLOWS_DEFAULT="changelog-check.yml pipeline-tests.yml secret-scan.yml supply-chain-check.yml deploy-railway-cloudflare.yml"

# Per-system CI-runs status, the runtime twin of _system_bp_status: instead of
# asking "is the gate still required?", it asks "did the gate's last run actually
# pass?". For each of the system's CI+deploy workflows it reads the newest
# COMPLETED run on the branch (same jq as proof_gh_run_freshness) and folds it
# through _conclusion_is_failing (skipped/neutral are healthy). Returns:
#   ok           — ≥1 workflow resolved and none is failing (success/skipped)
#   red          — ≥1 workflow's newest completed run is a failure
#   unresolvable — no token / no repo / no completed runs anywhere (❓, never 🚨)
# Tests inject runs via WATCHDOG_FIXTURE_DIR/_syscir_<sys>.json — an object
# mapping each workflow_file to a { "workflow_runs": [...] } document.
_system_ci_status() {
  local sys="$1" branch="$2" workflows="$3"
  local fxdoc="" wf runs concl resolved=0 failing=0
  if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
    local fx="${WATCHDOG_FIXTURE_DIR}/_syscir_${sys}.json"
    [ -f "$fx" ] || { echo "unresolvable"; return; }
    fxdoc=$(cat "$fx")
  else
    [ -n "$GH_API_TOKEN" ] || { echo "unresolvable"; return; }
  fi

  for wf in $workflows; do
    if [ -n "${WATCHDOG_FIXTURE_DIR:-}" ]; then
      runs=$(jq -c --arg w "$wf" '.[$w] // empty' <<<"$fxdoc" 2>/dev/null)
      [ -n "$runs" ] || continue
    else
      local body http
      body=$(mktemp)
      http=$(curl -sS -m 20 -o "$body" -w '%{http_code}' \
        -H "Authorization: Bearer ${GH_API_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${GH_API}/repos/edri2or/${sys}/actions/workflows/${wf}/runs?branch=${branch}&per_page=10" 2>/dev/null) || http="000"
      case "$http" in
        2*) runs=$(cat "$body") ;;
        *)  rm -f "$body"; continue ;;
      esac
      rm -f "$body"
    fi
    concl=$(jq -r 'first(.workflow_runs[]? | select(.status=="completed") | .conclusion) // empty' <<<"$runs" 2>/dev/null)
    [ -n "$concl" ] || continue
    resolved=$((resolved + 1))
    _conclusion_is_failing "$concl" && failing=$((failing + 1))
  done

  if [ "$failing" -gt 0 ]; then echo "red"; return; fi
  if [ "$resolved" -gt 0 ]; then echo "ok"; return; fi
  echo "unresolvable"
}

# --- proof: system-ci-runs --------------------------------------------------
# DYNAMIC per-system fan-out (twin of proof_system_branch_protection): for each
# real system, confirm the latest main run of each CI gate + the deploy workflow
# is not failing. A failing run → 🚨; a system that can't be resolved (no repo /
# no token / no runs) → ❓, never 🚨. Zero systems → ❓. Aggregated to ONE line.
proof_system_ci_runs() {
  local entry="$1" folder branch workflows
  folder=$(jq -r '.evidence.systems_folder // "123180924297"' <<<"$entry")
  branch=$(jq -r '.evidence.branch // "main"' <<<"$entry")
  workflows=$(jq -r '.evidence.workflows[]? // empty' <<<"$entry" | tr '\n' ' ')
  [ -n "${workflows// /}" ] || workflows="$SYSTEM_CI_WORKFLOWS_DEFAULT"
  R_URL="https://github.com/edri2or/or-factory-master/blob/main/monitoring/watchdog-registry.json"

  local systems
  systems=$(_enumerate_systems "$folder")

  local total=0 okc=0 redc=0 unkc=0 redlist=""
  local sys st
  for sys in $systems; do
    [ "$sys" = "factory-test-25" ] && continue
    total=$((total + 1))
    st=$(_system_ci_status "$sys" "$branch" "$workflows")
    case "$st" in
      ok)  okc=$((okc + 1)) ;;
      red) redc=$((redc + 1)); redlist="${redlist}${sys} " ;;
      *)   unkc=$((unkc + 1)) ;;
    esac
  done

  if [ "$total" -eq 0 ]; then
    R_STATUS="unknown"; R_DETAIL_HE="אין מערכות פרוסות תחת התיקייה"
  elif [ "$redc" -gt 0 ]; then
    R_STATUS="red"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ · ${redc} 🚨 שער/deploy נכשל (${redlist%% }) · ${unkc} ❓"
  elif [ "$okc" -gt 0 ]; then
    R_STATUS="ok"; R_DETAIL_HE="${total} מערכות: ${okc} ✅ שערי-CI/deploy ירוקים · ${unkc} ❓"
  else
    R_STATUS="unknown"; R_DETAIL_HE="${total} מערכות — ריצות שערי-CI לא ניתנות-לאימות (❓)"
  fi
}

emoji_for() {
  case "$1" in
    ok) printf '✅' ;; warn) printf '⚠️' ;; red) printf '🚨' ;;
    pending) printf '⏳' ;; *) printf '❓' ;;
  esac
}

# --- main loop --------------------------------------------------------------
OK=0 WARN=0 RED=0 UNK=0 PEND=0
FAILING_IDS=()
LINES=()           # plain-text report lines (Telegram)
SUMMARY_ROWS=()    # markdown table rows (step summary)

ENTRY_COUNT=$(jq '.entries | length' "$REGISTRY_FILE" 2>/dev/null || echo 0)
i=0
while [ "$i" -lt "$ENTRY_COUNT" ]; do
  entry=$(jq -c ".entries[$i]" "$REGISTRY_FILE")
  i=$((i + 1))

  id=$(jq -r '.id'      <<<"$entry")
  name=$(jq -r '.name_he' <<<"$entry")
  method=$(jq -r '.proof_method' <<<"$entry")
  enabled=$(jq -r '.enabled' <<<"$entry")
  stage=$(jq -r '.stage // 1' <<<"$entry")

  R_STATUS=""; R_DETAIL_HE=""; R_URL=""

  if [ "$enabled" != "true" ] || [ "$stage" -gt "$CURRENT_STAGE" ]; then
    R_STATUS="pending"; R_DETAIL_HE="ממתין לכיסוי (שלב ${stage})"
    R_URL="https://github.com/edri2or/or-factory-master/blob/main/monitoring/watchdog-registry.json"
  else
    case "$method" in
      gh-run-freshness)     proof_gh_run_freshness "$entry" ;;
      gh-branch-protection) proof_gh_branch_protection "$entry" ;;
      gh-last-run)          proof_gh_last_run "$entry" ;;
      static-integrity)     proof_static_integrity "$entry" ;;
      n8n-execution)        proof_n8n_execution "$entry" ;;
      n8n-workflow-liveness) proof_n8n_workflow_liveness "$entry" ;;
      system-branch-protection) proof_system_branch_protection "$entry" ;;
      system-ci-runs)           proof_system_ci_runs "$entry" ;;
      *) R_STATUS="unknown"; R_DETAIL_HE="שיטת הוכחה לא נתמכת בשלב זה (${method})" ;;
    esac
  fi

  case "$R_STATUS" in
    ok)      OK=$((OK + 1)) ;;
    warn)    WARN=$((WARN + 1)) ;;
    red)     RED=$((RED + 1)); FAILING_IDS+=("$id") ;;
    pending) PEND=$((PEND + 1)) ;;
    *)       UNK=$((UNK + 1)) ;;
  esac

  em=$(emoji_for "$R_STATUS")
  LINES+=("${em} ${name} — ${R_DETAIL_HE}"$'\n'"${R_URL}")
  SUMMARY_ROWS+=("| ${name} | ${em} | ${R_DETAIL_HE} | [link](${R_URL}) |")
done

TODAY=$(date -u +%Y-%m-%d)
SUMMARY_LINE="✅ ${OK}   ⚠️ ${WARN}   🚨 ${RED}   ❓ ${UNK}"
[ "$PEND" -gt 0 ] && SUMMARY_LINE="${SUMMARY_LINE}   ⏳ ${PEND}"

# Provenance: the watchdog's OWN run URL + commit SHA, so a green report is
# itself traceable to the exact run that produced it (anti-spoofing). All
# GITHUB_* vars are auto-set in Actions; fall back gracefully for local runs.
PROV_REPO="${GITHUB_REPOSITORY:-edri2or/or-factory-master}"
PROV_URL="${GITHUB_SERVER_URL:-https://github.com}/${PROV_REPO}/actions/runs/${GITHUB_RUN_ID:-local}"
PROV_SHA="${GITHUB_SHA:-}"
PROV_LINE="🔎 ריצת השומר: ${PROV_URL}"
[ -n "$PROV_SHA" ] && PROV_LINE="${PROV_LINE} · SHA ${PROV_SHA:0:7}"

# --- Telegram heartbeat (direct send — info-severity emit does NOT Telegram) ---
BODY_TEXT=$(printf '%s\n\n' "${LINES[@]}")
MSG="🛡️ דוח שמירה יומי — ${TODAY}"$'\n'"${SUMMARY_LINE}"$'\n\n'"${BODY_TEXT}"$'\n'"${PROV_LINE}"
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  tg_http=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' -X POST \
    "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=${MSG}" \
    --data-urlencode "disable_web_page_preview=true" 2>/dev/null) || tg_http="000"
  case "$tg_http" in
    2*) echo "[watchdog] telegram='ok'" ;;
    *)  echo "[watchdog] telegram='failed' http='${tg_http}'" ;;
  esac
else
  echo "[watchdog] telegram='skipped' reason='no-secret'"
fi

# --- emit-event: durable Axiom trail (+ Linear/Telegram on red) -------------
if [ "${WATCHDOG_EMIT:-1}" = "1" ]; then
  ids_csv=$(IFS=,; printf '%s' "${FAILING_IDS[*]:-}")
  if [ "$RED" -gt 0 ]; then
    ev_name="factory.watchdog.degraded"; ev_sev="error"; ev_areq="true"
  else
    ev_name="factory.watchdog.ok"; ev_sev="info"; ev_areq="false"
  fi
  ev_body=$(jq -cn \
    --argjson ok "$OK" --argjson warn "$WARN" --argjson red "$RED" \
    --argjson unk "$UNK" --argjson pend "$PEND" --arg failing "$ids_csv" \
    '{ok:$ok, warn:$warn, red:$red, unknown:$unk, pending:$pend, failing:$failing}')
  bash "${SCRIPT_DIR}/emit-event.sh" \
    --name="$ev_name" --severity="$ev_sev" --layer="factory" \
    --workflow="meta-monitoring-watchdog.yml" --run-id="${GITHUB_RUN_ID:-local}" \
    --action-required="$ev_areq" --body="$ev_body" || true
fi

# --- GitHub step summary (Hebrew table) -------------------------------------
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## 🛡️ דוח שמירה יומי — ${TODAY}"
    echo ""
    echo "${SUMMARY_LINE}"
    echo ""
    echo "| אוטומציה | סטטוס | פירוט | קישור |"
    echo "|---|---|---|---|"
    printf '%s\n' "${SUMMARY_ROWS[@]}"
    echo ""
    echo "${PROV_LINE}"
  } >> "$GITHUB_STEP_SUMMARY"
fi

# --- dead-man's-switch ping (proves the watchdog itself ran) -----------------
if [ -n "$HEARTBEAT_URL" ]; then
  if curl -fsS -m 10 "$HEARTBEAT_URL" >/dev/null 2>&1; then
    echo "[watchdog] heartbeat='ok'"
  else
    echo "[watchdog] heartbeat='failed'"
  fi
else
  echo "[watchdog] heartbeat='skipped' reason='no-url'"
fi

echo "[watchdog] done ok=${OK} warn=${WARN} red=${RED} unknown=${UNK} pending=${PEND}"
exit 0
