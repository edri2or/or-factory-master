#!/usr/bin/env bats
# normalize-n8n.bats — unit tests for scripts/lib/normalize-n8n.sh.
#
# The library's job: canonicalize an n8n workflow JSON so cosmetic-only diffs
# (node repositions, regenerated ids, key reordering) normalize EQUAL, while a
# semantic change (a node's parameters) normalizes UNEQUAL. The doc-binding gate
# relies on this to avoid false positives on pure editor noise.

load test_helper/common

setup() {
  _COMMON_TMP_PATHS=()
  # shellcheck source=../lib/normalize-n8n.sh
  source "$REPO_ROOT/scripts/lib/normalize-n8n.sh"
}

teardown() {
  common_teardown
}

# --- cosmetic differences must normalize EQUAL ---

@test "EQUAL: two workflows differing only in node position" {
  a='{"name":"wf","nodes":[{"name":"X","type":"t","typeVersion":1,"position":[1,2],"parameters":{"q":"keep"}}],"connections":{}}'
  b='{"name":"wf","nodes":[{"name":"X","type":"t","typeVersion":1,"position":[900,900],"parameters":{"q":"keep"}}],"connections":{}}'
  na=$(printf '%s' "$a" | normalize_n8n)
  nb=$(printf '%s' "$b" | normalize_n8n)
  [ "$na" = "$nb" ]
}

@test "EQUAL: two workflows differing only in node id / webhookId" {
  a='{"nodes":[{"name":"X","id":"aaaa","webhookId":"w1","parameters":{}}],"connections":{}}'
  b='{"nodes":[{"name":"X","id":"bbbb","webhookId":"w2","parameters":{}}],"connections":{}}'
  na=$(printf '%s' "$a" | normalize_n8n)
  nb=$(printf '%s' "$b" | normalize_n8n)
  [ "$na" = "$nb" ]
}

@test "EQUAL: two workflows differing only in top-level id / versionId / meta and key order" {
  a='{"id":"1","versionId":"v1","meta":{"x":1},"name":"wf","nodes":[{"parameters":{"q":"keep"},"name":"X"}],"connections":{}}'
  b='{"name":"wf","connections":{},"nodes":[{"name":"X","parameters":{"q":"keep"}}],"id":"2","versionId":"v2","meta":{"x":2}}'
  na=$(printf '%s' "$a" | normalize_n8n)
  nb=$(printf '%s' "$b" | normalize_n8n)
  [ "$na" = "$nb" ]
}

# --- semantic differences must normalize UNEQUAL ---

@test "UNEQUAL: a node parameter actually changed" {
  a='{"nodes":[{"name":"X","position":[1,2],"parameters":{"query":"SELECT 1"}}],"connections":{}}'
  b='{"nodes":[{"name":"X","position":[1,2],"parameters":{"query":"SELECT 2"}}],"connections":{}}'
  na=$(printf '%s' "$a" | normalize_n8n)
  nb=$(printf '%s' "$b" | normalize_n8n)
  [ "$na" != "$nb" ]
}

@test "UNEQUAL: a node was added" {
  a='{"nodes":[{"name":"X","parameters":{}}],"connections":{}}'
  b='{"nodes":[{"name":"X","parameters":{}},{"name":"Y","parameters":{}}],"connections":{}}'
  na=$(printf '%s' "$a" | normalize_n8n)
  nb=$(printf '%s' "$b" | normalize_n8n)
  [ "$na" != "$nb" ]
}

# --- robustness ---

@test "the real postgres-named-queries.json normalizes without error" {
  run bash -c "source '$REPO_ROOT/scripts/lib/normalize-n8n.sh' && normalize_n8n < '$REPO_ROOT/templates/system/workflows/n8n/postgres-named-queries.json'"
  assert_success
  # the semantic content survives: a known query name is still present
  assert_output --partial "claim_actual_mismatch"
}

@test "a JSON without a nodes array is passed through (no crash)" {
  run bash -c "source '$REPO_ROOT/scripts/lib/normalize-n8n.sh' && printf '%s' '{\"hello\":\"world\"}' | normalize_n8n"
  assert_success
  assert_output --partial "hello"
}

@test "malformed JSON on stdin is a loud non-zero failure" {
  run bash -c "source '$REPO_ROOT/scripts/lib/normalize-n8n.sh' && printf '%s' 'not json {{' | normalize_n8n"
  assert_failure
}
