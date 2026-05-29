#!/usr/bin/env bash
# oil-stage5-failsmoke-2.sh — TEMPORARY deliberately-failing reproducer for the
# Stage-5 failure-path RE-demo, after fixing the `bash -e` capture bug in
# oil-autofix-verify.yml. A fresh file (the verifier recovers only ADDED
# scripts/tests/*.sh from the merge diff). Removed in the closure PR. Exits non-zero.
echo "oil-stage5-failsmoke-2: deliberate post-merge failure (Stage 5 failure-path re-demo)."
exit 1
