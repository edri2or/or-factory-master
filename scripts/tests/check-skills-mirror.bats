#!/usr/bin/env bats
# check-skills-mirror.bats — unit tests for scripts/check-skills-mirror.sh and
# its companion regenerator scripts/sync-skills-mirror.sh.
#
# Model under test (audience-aware split):
#   .claude/commands/*.md is the source of truth. Each file declares
#   `audience: shared` (ships to systems) or `audience: factory-only` (not
#   shipped) in its first frontmatter block. templates/system/.claude/commands/
#   is a DERIVED mirror = exactly the `shared` files, byte-identical.
#
# Both scripts use relative paths, so each test builds a fixture tree and runs
# from inside it (cd "$fixture" && bash "$CHECK").

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-skills-mirror.sh"
SYNC="$REPO_ROOT/scripts/sync-skills-mirror.sh"

setup() {
  _COMMON_TMP_PATHS=()
  fixture="$(make_tmpdir)"
  mkdir -p "$fixture/.claude/commands"
  mkdir -p "$fixture/templates/system/.claude/commands"
}

teardown() {
  common_teardown
}

# write_cmd <dir> <name> <audience-value-or-NONE> [body]
# Writes a command .md with a frontmatter block. audience=NONE omits the key.
write_cmd() {
  local dir="$1" name="$2" aud="$3" body="${4:-# $2}"
  {
    echo "---"
    [ "$aud" = "NONE" ] || echo "audience: $aud"
    echo "description: test command $name"
    echo "---"
    echo ""
    echo "$body"
  } > "$fixture/$dir/$name"
}

src() { write_cmd ".claude/commands" "$@"; }
mir() { write_cmd "templates/system/.claude/commands" "$@"; }

run_check() { run bash -c "cd '$fixture' && bash '$CHECK'"; }
run_sync()  { run bash -c "cd '$fixture' && bash '$SYNC'"; }

# --- happy paths ---

@test "PASS: one shared + one factory-only, mirror holds only the shared" {
  src "a.md" shared
  src "b.md" factory-only
  # mirror must contain only the shared file, byte-identical.
  cp "$fixture/.claude/commands/a.md" "$fixture/templates/system/.claude/commands/a.md"

  run_check
  assert_success
  assert_output --partial "1 shared shipped, 1 factory-only excluded"
}

@test "PASS: all shared, mirror identical" {
  src "a.md" shared
  src "c.md" shared
  cp "$fixture/.claude/commands/a.md" "$fixture/templates/system/.claude/commands/a.md"
  cp "$fixture/.claude/commands/c.md" "$fixture/templates/system/.claude/commands/c.md"

  run_check
  assert_success
  assert_output --partial "2 shared shipped, 0 factory-only excluded"
}

# --- audience-tag gate (forces a decision) ---

@test "FAIL: command with no audience key" {
  src "a.md" NONE
  run_check
  assert_failure
  assert_output --partial "missing audience: key"
  assert_output --partial "a.md"
}

@test "FAIL: command with invalid audience value" {
  src "a.md" maybe
  run_check
  assert_failure
  assert_output --partial "invalid value 'maybe'"
}

@test "FAIL: command with no frontmatter fence at all" {
  printf '%s\n' "# no frontmatter" "just body text" > "$fixture/.claude/commands/a.md"
  run_check
  assert_failure
  assert_output --partial "missing audience: key"
}

# --- mirror integrity ---

@test "FAIL: factory-only file leaked into mirror" {
  src "a.md" shared
  src "b.md" factory-only
  cp "$fixture/.claude/commands/a.md" "$fixture/templates/system/.claude/commands/a.md"
  cp "$fixture/.claude/commands/b.md" "$fixture/templates/system/.claude/commands/b.md"  # leak

  run_check
  assert_failure
  assert_output --partial "unexpected mirror file"
  assert_output --partial "b.md"
}

@test "FAIL: shared file missing from mirror" {
  src "a.md" shared
  # mirror left empty
  run_check
  assert_failure
  assert_output --partial "missing from mirror"
  assert_output --partial "a.md"
}

@test "FAIL: shared file present but content drifted" {
  src "a.md" shared
  cp "$fixture/.claude/commands/a.md" "$fixture/templates/system/.claude/commands/a.md"
  echo "drifted extra line" >> "$fixture/templates/system/.claude/commands/a.md"

  run_check
  assert_failure
  assert_output --partial "content drift"
}

@test "ignores an audience: line that only appears in the body" {
  # audience in prose, not in frontmatter -> treated as missing -> fail.
  src "a.md" NONE "Some prose mentioning audience: shared in the text."
  run_check
  assert_failure
  assert_output --partial "missing audience: key"
}

# --- sync regenerator ---

@test "sync: copies only shared files and excludes factory-only" {
  src "a.md" shared
  src "b.md" factory-only
  src "c.md" shared
  # stale leftover in mirror that should be removed
  echo "stale" > "$fixture/templates/system/.claude/commands/old.md"

  run_sync
  assert_success
  assert_output --partial "2 shared command(s) copied"
  assert_output --partial "1 factory-only command(s) excluded"

  # Mirror now holds exactly a.md + c.md, byte-identical; no b.md, no old.md.
  [ -f "$fixture/templates/system/.claude/commands/a.md" ]
  [ -f "$fixture/templates/system/.claude/commands/c.md" ]
  [ ! -f "$fixture/templates/system/.claude/commands/b.md" ]
  [ ! -f "$fixture/templates/system/.claude/commands/old.md" ]

  # And the check now passes on the regenerated tree.
  run_check
  assert_success
}

@test "sync: refuses to run when a tag is missing/invalid" {
  src "a.md" shared
  src "b.md" NONE
  run_sync
  assert_failure
  assert_output --partial "refusing to sync"
  assert_output --partial "b.md"
}
