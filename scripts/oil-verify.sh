#!/usr/bin/env bash
# oil-verify.sh — deterministic POST-MERGE verification for an OIL auto-fix
# (Stage 5 of the OIL auto-fix loop).
#
# After an OIL draft PR is approved (Telegram ✅) and merged into main by the
# oil-autofix-approver identity (only ever once the 4 required CI checks were
# green), this script re-runs the fix's reproducer test ON THE MERGED main tree to
# prove the bug is actually gone — before the Linear ticket is auto-closed.
#
# It is the post-merge twin of oil-autofix-validate.sh: a PURE gate that prints a
# single VERDICT line and exits 0 (verified) / non-zero (failed). ALL side effects
# (closing the Linear issue, Telegram) live in the workflow, never here.
#
# Unlike the Stage-3 gate this is PASS-AFTER-ONLY: fail-before was already proven at
# PR time, and the fix is now present on main, so "the reproducer passes on the
# merged tree" IS the post-merge signal.
#
# The reproducer is AI-authored; it is run in a SCRUBBED environment (env -i, so it
# inherits no secrets) and only ever after the workflow has revoked cloud creds.
#
# Usage:  scripts/oil-verify.sh <test_cmd>
#           <test_cmd>  a bare 'bash <file>' / 'bats <file>' invocation (the same
#                       whitelist as oil-autofix-validate.sh) naming the reproducer
#                       that is now on main.
# Prints: one "VERDICT: verified ..." or "VERDICT: failed — <reason>" line.
# Exit:   0 = verified (safe to close the issue); non-zero = failed (keep it open).

set -uo pipefail

test_cmd="${1:-}"

verified() { echo "VERDICT: verified ($1)"; exit 0; }
failed()   { echo "VERDICT: failed — $1"; exit 1; }

[ -n "$test_cmd" ] || failed "no test_cmd provided"

# Only a bare `bash <file>` / `bats <file>` is allowed — no pipes, redirects, or
# shell metacharacters, so the recovered command cannot smuggle arbitrary shell.
# Identical whitelist to oil-autofix-validate.sh.
printf '%s' "$test_cmd" | grep -Eq '^(bash|bats) [A-Za-z0-9_./-]+$' \
  || failed "test_cmd is not a bare 'bash <file>' invocation: $test_cmd"

test_file=$(printf '%s' "$test_cmd" | awk '{print $2}')
[ -f "$test_file" ] || failed "declared test file does not exist on main: $test_file"

# Run the AI-authored reproducer in a SCRUBBED environment (inherits no secrets),
# exactly like oil-autofix-validate.sh's run_test. On the merged main tree the fix
# is present, so the reproducer must now PASS.
rc=0
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="${RUNNER_TEMP:-/tmp}" bash -c "$test_cmd" >/dev/null 2>&1 || rc=$?

[ "$rc" -eq 0 ] || failed "reproducer still fails on merged main (rc=$rc)"
verified "test='$test_cmd'"
