#!/usr/bin/env bats
# check-doc-binding.bats — unit tests for scripts/check-doc-binding.sh.
#
# The gate: if a BOUND artifact really changed in HEAD~1..HEAD without its bound
# doc being touched, fail — unless a doc-waiver line is in a diffed changelog.d
# fragment. n8n artifacts are normalized first, so a cosmetic reposition is not
# a "real" change.

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-doc-binding.sh"

# A minimal n8n workflow with a postgres query node. $1 overrides the query;
# $2 overrides the x-position (cosmetic).
n8n_wf() { # query xpos
  printf '{"name":"wf","nodes":[{"name":"Q","type":"n8n-nodes-base.postgres","typeVersion":1,"position":[%s,2],"parameters":{"query":"%s"}}],"connections":{}}' "${2:-1}" "${1:-SELECT 1}"
}

setup() {
  _COMMON_TMP_PATHS=()
  REPO="$(make_fixture_repo)"
  # Base commit (HEAD~1): the bound artifact, its doc, the manifest.
  (
    cd "$REPO"
    mkdir -p workflows/n8n docs monitoring changelog.d
    n8n_wf "SELECT 1" 1 > workflows/n8n/pnq.json
    printf '# the doc\n' > docs/AGENTS.md
    cat > monitoring/doc-bindings.json <<'J'
{"version":1,"bindings":[{"id":"b1","artifacts":["workflows/n8n/pnq.json"],"docs":["docs/AGENTS.md"],"enforce":true}]}
J
    git add -A && git commit -q -m base
  )
}

teardown() {
  common_teardown
}

# Run the gate inside the fixture repo (cwd matters: it diffs HEAD~1..HEAD).
run_gate() {
  run bash -c "cd '$REPO' && DOC_DRIFT_SKIP_EMIT=1 BINDINGS_FILE=monitoring/doc-bindings.json bash '$CHECK' 2>&1"
}

@test "FAIL: bound artifact really changed, doc untouched" {
  ( cd "$REPO" && n8n_wf "SELECT 2" 1 > workflows/n8n/pnq.json && git add -A && git commit -q -m "change query" )
  run_gate
  assert_failure
  assert_output --partial "bound artifact really changed"
}

@test "PASS: cosmetic-only n8n change (node reposition) does not require a doc touch" {
  ( cd "$REPO" && n8n_wf "SELECT 1" 999 > workflows/n8n/pnq.json && git add -A && git commit -q -m "move node" )
  run_gate
  assert_success
  assert_output --partial "PASS"
}

@test "PASS: bound artifact really changed AND its doc was touched" {
  ( cd "$REPO" \
      && n8n_wf "SELECT 2" 1 > workflows/n8n/pnq.json \
      && printf '# the doc — updated\n' > docs/AGENTS.md \
      && git add -A && git commit -q -m "change query + doc" )
  run_gate
  assert_success
}

@test "PASS (WAIVED): real change, no doc, but a doc-waiver in a diffed fragment" {
  ( cd "$REPO" \
      && n8n_wf "SELECT 2" 1 > workflows/n8n/pnq.json \
      && printf 'doc-waiver: workflows/n8n/pnq.json — intentional, no doc impact\n' > changelog.d/2026-06-17-x.md \
      && git add -A && git commit -q -m "change query + waiver" )
  run_gate
  assert_success
  assert_output --partial "WAIVED"
}

@test "PASS: an unrelated file changed (no bound artifact in the diff)" {
  ( cd "$REPO" && printf 'hi\n' > unrelated.txt && git add -A && git commit -q -m "unrelated" )
  run_gate
  assert_success
  assert_output --partial "PASS"
}

@test "FAIL: a waiver for a DIFFERENT artifact does not excuse this one" {
  ( cd "$REPO" \
      && n8n_wf "SELECT 2" 1 > workflows/n8n/pnq.json \
      && printf 'doc-waiver: some/other/file.json — unrelated\n' > changelog.d/2026-06-17-x.md \
      && git add -A && git commit -q -m "change query + wrong waiver" )
  run_gate
  assert_failure
  assert_output --partial "bound artifact really changed"
}

@test "FAIL: a newly-added bound artifact with no doc touch (add counts as a real change)" {
  # Re-base without the artifact, then add it.
  ( cd "$REPO" \
      && git rm -q workflows/n8n/pnq.json && git commit -q -m "remove artifact" \
      && mkdir -p workflows/n8n \
      && n8n_wf "SELECT 1" 1 > workflows/n8n/pnq.json && git add -A && git commit -q -m "re-add artifact" )
  run_gate
  assert_failure
  assert_output --partial "bound artifact really changed"
}

@test "malformed manifest is a loud failure" {
  ( cd "$REPO" && printf 'nope {{' > monitoring/doc-bindings.json && git add -A && git commit -q -m "break manifest" )
  run_gate
  assert_failure
  assert_output --partial "not valid JSON"
}
