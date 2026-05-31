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
CURRENT_STAGE="${CURRENT_STAGE:-1}"
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
    elif [ -n "$c2" ] && [ "$c2" != "success" ]; then
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
  elif [ -n "$c2" ] && [ "$c2" != "success" ]; then
    R_STATUS="red"; R_URL="$u1"; R_DETAIL_HE="2 כשלים רצופים (אחרון: ${c1})"
  else
    R_STATUS="warn"; R_URL="$u1"; R_DETAIL_HE="כשל אחרון (${c1}) — עוקב"
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
      gh-run-freshness) proof_gh_run_freshness "$entry" ;;
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

# --- Telegram heartbeat (direct send — info-severity emit does NOT Telegram) ---
BODY_TEXT=$(printf '%s\n\n' "${LINES[@]}")
MSG="🛡️ דוח שמירה יומי — ${TODAY}"$'\n'"${SUMMARY_LINE}"$'\n\n'"${BODY_TEXT}"
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
