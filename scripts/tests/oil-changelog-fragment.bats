#!/usr/bin/env bats
# oil-changelog-fragment.bats — unit tests for scripts/oil-changelog-fragment.sh.
#
# Proves the OIL auto-fix writes a changelog.d/ FRAGMENT (not the head of CHANGELOG.md),
# and that the fragment is compile-compatible: the REAL scripts/compile-changelog.sh folds
# it into CHANGELOG.md as a numbered "## Stage N — fix: oil-autofix — <ident>" section.
# Using the real compiler (not a re-implemented parser) keeps this drift-free.

load test_helper/common

GEN="$REPO_ROOT/scripts/oil-changelog-fragment.sh"

setup() {
  _COMMON_TMP_PATHS=()
}

teardown() {
  common_teardown
}

@test "writes a changelog.d/ fragment, never the head of CHANGELOG.md" {
  work="$(make_tmpdir)"

  run bash "$GEN" "$work" "OIL-49" "or-factory-master" "Fixed the null deref." "a missing guard"
  assert_success
  # stdout is the relative fragment path under changelog.d/
  assert_output --regexp '^changelog\.d/[0-9]{4}-[0-9]{2}-[0-9]{2}-oil-autofix-oil-49\.md$'

  frag="$work/$output"
  [ -f "$frag" ]
  run cat "$frag"
  assert_output --partial "## fix: oil-autofix — OIL-49"
  assert_output --partial "| Type | Summary |"
  assert_output --partial "| fix | Auto-fix proposed by oil-autofix for **OIL-49**"

  # The generator must NOT create or touch CHANGELOG.md.
  [ ! -e "$work/CHANGELOG.md" ]
}

@test "the generated fragment is compile-compatible (real compile-changelog.sh folds it)" {
  work="$(make_tmpdir)"
  mkdir -p "$work/scripts"
  cp "$REPO_ROOT/scripts/compile-changelog.sh" "$work/scripts/compile-changelog.sh"
  printf '# Changelog\n\n' > "$work/CHANGELOG.md"

  bash "$GEN" "$work" "OIL-49" "or-factory-master" "Fixed the null deref." "a missing guard"
  run bash -c "ls '$work'/changelog.d/*.md | wc -l"
  assert_output "1"

  ( cd "$work" && bash scripts/compile-changelog.sh )

  run cat "$work/CHANGELOG.md"
  assert_output --partial "## Stage 1 — fix: oil-autofix — OIL-49"
  assert_output --partial "| TBD | fix |"

  # The fragment was consumed (deleted) by the compile.
  run bash -c "ls '$work'/changelog.d/*.md 2>/dev/null | wc -l"
  assert_output "0"
}

@test "sanitizes pipe characters in the AI-supplied summary so the table never breaks" {
  work="$(make_tmpdir)"
  mkdir -p "$work/scripts"
  cp "$REPO_ROOT/scripts/compile-changelog.sh" "$work/scripts/compile-changelog.sh"
  printf '# Changelog\n\n' > "$work/CHANGELOG.md"

  # A summary containing a raw "|" would otherwise split the Markdown table cell.
  bash "$GEN" "$work" "OIL-50" "or-factory-master" "ran a | b | c pipeline" "x | y"
  ( cd "$work" && bash scripts/compile-changelog.sh )

  run cat "$work/CHANGELOG.md"
  assert_success
  assert_output --partial "## Stage 1 — fix: oil-autofix — OIL-50"
  # the pipes were replaced with "/" — no raw "|" leaked into the summary cell
  refute_output --partial "a | b | c"
}
