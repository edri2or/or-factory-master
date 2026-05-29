#!/usr/bin/env bash
# oil-verify-selftest.sh — unit self-test for scripts/oil-verify.sh (OIL Stage 5).
#
# Drives the pure post-merge gate through every verdict with throwaway fixtures, so
# the verifier's pass / fail / malformed-command / missing-file / empty branches are
# proven in CI without any live OIL run. Run by pipeline-tests.yml.
#
# Lives under scripts/tests/ (NOT shellchecked — same convention as the AI-authored
# reproducers the OIL loop writes here).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY="$ROOT/scripts/oil-verify.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fails=0
check() {
  # check "<label>" <expected-exit> "<verdict-substring>" "<test_cmd>"
  local label="$1" exp_rc="$2" exp_sub="$3" tcmd="$4"
  local out rc=0
  out="$(bash "$VERIFY" "$tcmd" 2>&1)" || rc=$?
  if [ "$rc" -ne "$exp_rc" ]; then
    echo "FAIL [$label]: exit=$rc expected=$exp_rc :: $out"; fails=$((fails + 1)); return
  fi
  if ! printf '%s' "$out" | grep -qF "$exp_sub"; then
    echo "FAIL [$label]: missing '$exp_sub' :: $out"; fails=$((fails + 1)); return
  fi
  echo "PASS [$label]: $out"
}

# A reproducer that PASSES on the merged tree → verified, exit 0.
pass_t="$TMP/pass.sh"; printf '#!/usr/bin/env bash\nexit 0\n' > "$pass_t"
check "passing reproducer -> verified" 0 "VERDICT: verified" "bash $pass_t"

# A reproducer that FAILS → failed, exit 1 (the regression / incomplete-fix case).
fail_t="$TMP/fail.sh"; printf '#!/usr/bin/env bash\nexit 1\n' > "$fail_t"
check "failing reproducer -> failed" 1 "VERDICT: failed" "bash $fail_t"

# A malformed test_cmd (a pipe) must be rejected by the whitelist, never run.
check "malformed test_cmd -> failed" 1 "not a bare" "bash $pass_t | tee /tmp/x"

# A missing test file → failed (no run).
check "missing test file -> failed" 1 "does not exist" "bash $TMP/does-not-exist.sh"

# An empty test_cmd → failed.
check "empty test_cmd -> failed" 1 "no test_cmd" ""

if [ "$fails" -ne 0 ]; then
  echo "oil-verify self-test: $fails check(s) FAILED."
  exit 1
fi
echo "oil-verify self-test: all checks passed."
