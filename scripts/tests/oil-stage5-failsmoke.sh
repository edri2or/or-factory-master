#!/usr/bin/env bash
# oil-stage5-failsmoke.sh — TEMPORARY deliberately-failing reproducer for the
# Stage-5 failure-path LIVE demo. Merged once to prove that a post-merge
# verification failure leaves the Linear issue OPEN and alerts on Telegram, then
# removed in the very next PR. Always exits non-zero.
echo "oil-stage5-failsmoke: deliberate post-merge failure (Stage 5 failure-path demo)."
exit 1
