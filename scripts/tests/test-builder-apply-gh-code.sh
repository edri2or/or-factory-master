#!/usr/bin/env bash
# Test: gh_api() must propagate the HTTP status code to the parent shell via /tmp/ba.code.
#
# Before fix: gh_api() assigned GH_CODE="$code" inside the function, but every call-site
# used result=$(gh_api ...) — a subshell.  The assignment was lost when the subshell exited.
# With set -uo pipefail, the first reference to $GH_CODE in the parent shell aborted with
# "unbound variable" (scripts/builder-apply.sh line 145, run-log: "GH_CODE: unbound variable").
#
# After fix: gh_api() writes the code to /tmp/ba.code; call-sites read it back with
# GH_CODE=$(</tmp/ba.code), which is NOT a subshell (it is a redirected read).
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/builder-apply.sh"
[ -r "$SCRIPT" ] || { echo "FAIL: cannot find $SCRIPT" >&2; exit 1; }

# --- Part 1: demonstrate the buggy pattern fails with set -u --------------------------
buggy=$(mktemp /tmp/ba_test_buggy.XXXXXX.sh)
cat > "$buggy" <<'BUGGY'
#!/usr/bin/env bash
set -uo pipefail
gh_api_buggy() {
  local code="200"
  GH_CODE="$code"   # assignment inside function called via $(...) — lost in parent
  echo '{"default_branch":"main"}'
}
body=$(gh_api_buggy GET "/test")
# With set -u this line crashes: GH_CODE is unbound in the parent shell
[ "$GH_CODE" = "200" ] || exit 1
echo "PASS"
BUGGY
chmod +x "$buggy"
if bash "$buggy" 2>/dev/null; then
  echo "FAIL: buggy pattern unexpectedly passed — test logic is wrong" >&2
  rm -f "$buggy"
  exit 1
fi
rm -f "$buggy"

# --- Part 2: demonstrate the fixed pattern succeeds ----------------------------------
fixed=$(mktemp /tmp/ba_test_fixed.XXXXXX.sh)
cat > "$fixed" <<'FIXED'
#!/usr/bin/env bash
set -uo pipefail
gh_api_fixed() {
  local code="200"
  printf '%s' "$code" > /tmp/ba.code   # survives the subshell exit
  echo '{"default_branch":"main"}'
}
body=$(gh_api_fixed GET "/test")
GH_CODE=$(</tmp/ba.code)   # redirected read, not a subshell
[ "$GH_CODE" = "200" ] || { echo "FAIL: GH_CODE=$GH_CODE" >&2; exit 1; }
echo "PASS: GH_CODE=$GH_CODE"
FIXED
chmod +x "$fixed"
if ! bash "$fixed"; then
  echo "FAIL: fixed pattern did not pass" >&2
  rm -f "$fixed"
  exit 1
fi
rm -f "$fixed"

# --- Part 3: assert the fix is present in the actual script --------------------------
# gh_api() must write to /tmp/ba.code
if ! grep -q '/tmp/ba\.code' "$SCRIPT"; then
  echo "FAIL: builder-apply.sh gh_api() does not write to /tmp/ba.code" >&2
  exit 1
fi

# gh_api() must NOT have a direct GH_CODE= assignment (that would be a subshell assignment)
func=$(awk '/^gh_api\(\)/{found=1} found{print; if(/^\}$/){exit}}' "$SCRIPT")
if printf '%s' "$func" | grep -qE '^[[:space:]]*GH_CODE='; then
  echo "FAIL: gh_api() still has a direct GH_CODE= assignment (lost in subshell)" >&2
  exit 1
fi

# Every call-site must follow with GH_CODE=$(</tmp/ba.code)
call_site_count=$(grep -c 'GH_CODE=.*ba\.code' "$SCRIPT" || true)
if [ "${call_site_count:-0}" -lt 6 ]; then
  echo "FAIL: expected ≥6 GH_CODE=\$(</tmp/ba.code) call-sites, found ${call_site_count}" >&2
  exit 1
fi

echo "PASS: builder-apply.sh correctly propagates HTTP code via /tmp/ba.code (${call_site_count} call-sites)"
exit 0
