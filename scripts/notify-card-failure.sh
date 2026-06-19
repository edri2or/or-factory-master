#!/usr/bin/env bash
# Fix 2 — turn a SILENT card failure into a clear signal to Or. When the broker cannot turn a
# RED agent task into a Telegram approval card (the POST to {MCP}/agent-action-register failed —
# e.g. HTTP 413 task_too_large_for_card), the broker run still fails (the task was NOT queued),
# but WITHOUT this the failure was invisible to Or. This composes one plain Hebrew message naming
# the correlation_id + reason and sends it via the factory bot.
#
# This is the custom HUMAN alert, deliberately separate from emit-event.sh's generic Telegram
# (which the workflow emits at severity=info → Axiom-only) to avoid a double-send — the same
# split workspace-token-audit.yml uses. Soft on send: it always exits 0; the WORKFLOW does the
# hard exit 1 afterwards. The fix is the signal, not the exit code.
#
# Usage: notify-card-failure.sh <correlation_id> <http_code> [reason]
#   env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (both required to actually send)
set -uo pipefail

CORR="${1:-?}"
CODE="${2:-?}"
REASON="${3:-}"

MSG="⚠️ לא הצלחתי לשלוח כרטיס-אישור למשימת-סוכן (${CORR}). קוד תגובה: ${CODE}."
case "$REASON" in
  *task_too_large_for_card*) MSG="${MSG} המשימה ארוכה מדי לכרטיס — קצר או פצל אותה ושלח שוב." ;;
  "")                        : ;;
  *)                         MSG="${MSG} סיבה: ${REASON}." ;;
esac
MSG="${MSG} העבודה לא נכנסה לתור — לא בוצע דבר."

# Always log the message, so it is visible in the job log even when Telegram creds are absent.
echo "NOTIFY: ${MSG}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "WARN: telegram creds absent — message printed to log only." >&2
  exit 0
fi

curl -sS -m 20 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MSG}" >/dev/null 2>&1 \
  || echo "WARN: telegram send failed (soft)." >&2
exit 0
