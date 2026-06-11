#!/usr/bin/env bats
# mask-secret.bats — unit tests for the _mask_secret helper embedded in
# templates/system/.github/workflows/configure-agent-router.yml.
#
# Why this helper exists: ::add-mask:: is a LINE-based GitHub Actions workflow
# command. A raw `echo "::add-mask::$PEM"` of a MULTI-LINE value (the GitHub
# App private key) registers only the FIRST line as a mask and prints the rest
# of the key in plain text in the run log (actions/runner#161) — the exact
# leak this development fixed. These tests:
#   1. extract the helper from the workflow file itself (testing the shipped
#      code, not a copy),
#   2. feed it a REAL RSA private key generated at test time (never committed,
#      so the secret-scan gate stays quiet),
#   3. document the fail-before behaviour of the old raw-echo pattern, and
#   4. pin the workflow file against regressing to raw `echo "::add-mask::"`.

load test_helper/common

WORKFLOW="$REPO_ROOT/templates/system/.github/workflows/configure-agent-router.yml"

# Pull the _mask_secret function out of the workflow's run: block (10-space
# indent) and de-indent it into plain sourceable shell. The range ends at the
# first 10-space closing brace — the function's own (inner lines sit deeper).
extract_helper() {
  sed -n '/^          _mask_secret() {$/,/^          }$/p' "$WORKFLOW" \
    | sed 's/^          //'
}

# A real multi-line PEM, minted fresh per test — never a committed fixture.
gen_pem() {
  openssl genrsa 2048 2>/dev/null
}

@test "helper extracts from the workflow and defines _mask_secret" {
  src="$(extract_helper)"
  [ -n "$src" ]
  eval "$src"
  declare -F _mask_secret
}

@test "multi-line PEM: every output line is an ::add-mask:: command, every non-empty key line covered" {
  eval "$(extract_helper)"
  PEM="$(gen_pem)"
  [ -n "$PEM" ]
  # sanity: the key really is multi-line
  [ "$(printf '%s\n' "$PEM" | wc -l)" -gt 1 ]

  out="$(_mask_secret "$PEM")"

  # (a) nothing escapes the ::add-mask:: prefix — the value is never echoed bare
  stray=$(printf '%s\n' "$out" | grep -cv '^::add-mask::' || true)
  [ "$stray" -eq 0 ]

  # (b) every non-empty line of the key is individually registered as a mask
  missing=0
  while IFS= read -r kline; do
    [ -z "$kline" ] && continue
    if ! printf '%s\n' "$out" | grep -qxF "::add-mask::${kline}"; then
      missing=$((missing + 1))
    fi
  done <<< "$PEM"
  [ "$missing" -eq 0 ]

  # (c) exact coverage: one mask command per non-empty key line
  pem_nonempty=$(printf '%s\n' "$PEM" | grep -c . || true)
  out_lines=$(printf '%s\n' "$out" | grep -c . || true)
  [ "$pem_nonempty" -eq "$out_lines" ]
}

@test "fail-before: the old raw-echo pattern leaks the key body past line 1" {
  # Documents the bug the helper replaces: echoing ::add-mask:: with a
  # multi-line value emits everything after the first line as plain log
  # output (only line 1 becomes a workflow command).
  PEM="$(gen_pem)"
  out="$(echo "::add-mask::${PEM}")"
  leaked=$(printf '%s\n' "$out" | tail -n +2 | grep -cv '^::add-mask::' || true)
  [ "$leaked" -ge 1 ]
  printf '%s\n' "$out" | tail -n +2 | grep -qE -- '-----END (RSA )?PRIVATE KEY-----'
}

@test "single-line value: exactly one mask command, byte-exact" {
  eval "$(extract_helper)"
  out="$(_mask_secret "sk-or-v1-test-single-line-token")"
  [ "$out" = "::add-mask::sk-or-v1-test-single-line-token" ]
}

@test "empty value: no output, returns 0" {
  eval "$(extract_helper)"
  run _mask_secret ""
  assert_success
  refute_output
}

@test "regression pin: the workflow never raw-echo-masks again" {
  # The exact leaking line must never come back…
  run grep -F 'echo "::add-mask::${GH_APP_PRIVATE_KEY}"' "$WORKFLOW"
  assert_failure
  # …the private key is masked through the helper…
  run grep -F '_mask_secret "$GH_APP_PRIVATE_KEY"' "$WORKFLOW"
  assert_success
  # …and the ONLY raw `echo "::add-mask::` commands in the whole file are the
  # two inside _mask_secret itself (comment lines excluded). Adding a new one
  # fails here on purpose: mask new secrets via _mask_secret.
  cmd_masks=$(grep -E 'echo "::add-mask::' "$WORKFLOW" | grep -cvE '^[[:space:]]*#' || true)
  [ "$cmd_masks" -eq 2 ]
}
