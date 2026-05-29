#!/usr/bin/env bash
# oil-autofix-validate.sh — deterministic safety gate + test proof for an OIL
# auto-fix candidate (Stage 3 of the OIL auto-fix loop).
#
# The investigator's "fixer" agent (claude-code-action in write mode, with NO
# Bash and no web tools) may edit files in the working tree. This script — run
# by the workflow AFTER the candidate has been committed and AFTER all cloud
# credentials have been dropped — decides whether that candidate is safe enough
# to open as a DRAFT pull request.
#
# It enforces ALL of the following; any failure exits non-zero = ESCALATE (no PR):
#   * <= MAX_FILES changed files and <= MAX_LINES changed lines
#   * no changed file touches a forbidden path
#     (.github/workflows|actions, terraform/, *wif*/*workload-identity*/*secret*,
#      *.pem/*.key, .env*)
#   * scripts/scan-for-secrets.sh stays green (no secret introduced by the diff)
#   * a declared, whitelisted test command (`bash <file>` / `bats <file>`) that
#     FAILS before the fix is applied and PASSES after it
#
# The AI-authored test is executed in a scrubbed environment (env -i, so it
# inherits no secrets) and only ever after credentials have been removed.
#
# Usage:  scripts/oil-autofix-validate.sh <base_sha>
# Reads:  oil-context/fix-meta.json
#           {"test_cmd":"bash scripts/tests/x.sh","test_paths":["scripts/tests/x.sh"]}
# Prints: one "VERDICT: open_pr ..." or "VERDICT: escalate — <reason>" line.
# Exit:   0 = safe to open the draft PR; non-zero = escalate.

set -uo pipefail

MAX_FILES=2
MAX_LINES=100
META="oil-context/fix-meta.json"

base_sha="${1:-}"
[ -n "$base_sha" ] || { echo "VERDICT: escalate — internal: no base sha"; exit 2; }

fail() { echo "VERDICT: escalate — $1"; exit 1; }

# The candidate must exist as commit(s) on top of base_sha.
changed_files=$(git diff --name-only "$base_sha"..HEAD)
[ -n "$changed_files" ] || fail "the fixer made no changes"

# File-count cap.
n_files=$(printf '%s\n' "$changed_files" | grep -c .)
[ "$n_files" -le "$MAX_FILES" ] || fail "touches $n_files files (cap $MAX_FILES)"

# Forbidden paths (matched case-insensitively).
while IFS= read -r f; do
  [ -n "$f" ] || continue
  low=$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')
  case "$low" in
    .github/workflows/*|.github/actions/*|terraform/*|*/terraform/*)
      fail "touches forbidden path: $f" ;;
    *.pem|*.key)
      fail "touches a key file: $f" ;;
    .env|.env.*|*/.env|*/.env.*)
      fail "touches an env file: $f" ;;
    *wif*|*workload-identity*|*secret*|*credential*|*creds*|*iam-policy*)
      fail "path looks credential/IAM-related: $f" ;;
  esac
done <<< "$changed_files"

# Changed-line cap (added + deleted).
total_lines=$(git diff --numstat "$base_sha"..HEAD | awk '{a+=$1; d+=$2} END{print a+d+0}')
[ "$total_lines" -le "$MAX_LINES" ] || fail "changes $total_lines lines (cap $MAX_LINES)"

# No secret in the ADDED lines. Scoped to the diff so untracked scratch files
# (oil-context/, the run logs) can't cause false positives; the PR's own
# "Scan for committed secrets" CI gate is the full-tree backstop. Patterns mirror
# scripts/scan-for-secrets.sh.
added=$(git diff "$base_sha"..HEAD | grep '^+' || true)
if printf '%s\n' "$added" | grep -Eq 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|ya29\.[A-Za-z0-9._-]{100}|-----BEGIN (RSA |EC )?PRIVATE KEY|"private_key": *"-----BEGIN|[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}'; then
  fail "a secret-like pattern appears in the added lines"
fi

# Parse + whitelist the declared test.
[ -f "$META" ] || fail "no oil-context/fix-meta.json (the fixer declared no test)"
test_cmd=$(jq -r '.test_cmd // ""' "$META" 2>/dev/null || echo "")
[ -n "$test_cmd" ] || fail "fix-meta.json has no test_cmd"
# Only a bare `bash <file>` / `bats <file>` is allowed — no pipes, redirects, or
# shell metacharacters, so the declared command cannot smuggle arbitrary shell.
printf '%s' "$test_cmd" | grep -Eq '^(bash|bats) [A-Za-z0-9_./-]+$' \
  || fail "test_cmd is not a bare 'bash <file>' invocation: $test_cmd"
test_file=$(printf '%s' "$test_cmd" | awk '{print $2}')
[ -f "$test_file" ] || fail "declared test file does not exist: $test_file"
printf '%s\n' "$changed_files" | grep -qxF "$test_file" \
  || fail "test file is not part of the candidate diff: $test_file"
jq -r '.test_paths[]? // empty' "$META" 2>/dev/null | grep -qxF "$test_file" \
  || fail "test file not declared in test_paths: $test_file"

# Run the AI-authored test in a SCRUBBED environment (inherits no secrets).
run_test() {
  env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="${RUNNER_TEMP:-/tmp}" bash -c "$test_cmd"
}

# passes-after: the current HEAD tree already contains the fix.
run_test >/dev/null 2>&1 || fail "test does not PASS with the fix applied"

# fails-before: revert the fix (non-test) files to base, keep the test, expect failure.
fix_files=$(printf '%s\n' "$changed_files" | grep -vxF "$test_file" || true)
[ -n "$fix_files" ] || fail "the candidate changed only the test file (no actual fix)"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if git cat-file -e "$base_sha:$f" 2>/dev/null; then
    git checkout "$base_sha" -- "$f"
  else
    rm -f "$f"
  fi
done <<< "$fix_files"

before_rc=0
run_test >/dev/null 2>&1 || before_rc=$?

# Always restore the full candidate tree.
git checkout HEAD -- . 2>/dev/null || true

[ "$before_rc" -ne 0 ] || fail "test still PASSES without the fix (not a real reproduction)"

echo "VERDICT: open_pr (files=$n_files lines=$total_lines test='$test_cmd')"
exit 0
