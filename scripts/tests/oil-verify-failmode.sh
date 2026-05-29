#!/usr/bin/env bash
# oil-verify-failmode.sh — a DELIBERATELY failing reproducer fixture (OIL Stage 5).
#
# Not part of any auto-fix. It exists only so the OIL verify FAILURE path can be
# exercised LIVE without merging a broken fix. Dispatch oil-autofix-verify.yml with
#   test_cmd = "bash scripts/tests/oil-verify-failmode.sh"
# against a throwaway test Linear issue → oil-verify.sh returns VERDICT: failed →
# the workflow posts the Hebrew failure comment + the "נכשל באימות" Telegram and
# does NOT close the issue. Always exits non-zero.
echo "oil-verify-failmode: deliberate failure fixture (Stage 5 failure-path test)."
exit 1
