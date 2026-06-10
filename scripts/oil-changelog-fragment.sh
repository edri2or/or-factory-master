#!/usr/bin/env bash
# oil-changelog-fragment.sh — write ONE OIL auto-fix changelog FRAGMENT into
# <work_dir>/changelog.d/, instead of prepending to the head of CHANGELOG.md.
#
# Prepending the entry to the head of CHANGELOG.md grew the file and broke the 20 KB
# size gate (scripts/check-changelog-size.sh) — that breakage was fixed by hand in
# PR #374. This repo's standard is a per-change FRAGMENT under changelog.d/, folded
# later (single-threaded) into the numbered CHANGELOG.md by scripts/compile-changelog.sh,
# which also auto-archives past the cap. So oil-autofix writes a fragment, never the head.
#
# This is PURE file generation — the caller (oil-autofix-investigate.yml) does the git
# add/commit — so the logic is unit-testable (scripts/tests/oil-changelog-fragment.bats).
#
# Usage: oil-changelog-fragment.sh <work_dir> <issue_ident> <target_repo> <summary> <root_cause>
# Prints the fragment path (relative to <work_dir>) on stdout.
set -euo pipefail

WORK="${1:?work_dir required}"
IDENT="${2:-OIL}"
REPO="${3:-}"
SUMMARY="${4:-fix}"
ROOT="${5:-n/a}"

# Filename slug: lowercased ident, any run of non-alnum -> single dash, ends trimmed.
SHORT=$(printf '%s' "${IDENT:-oil}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
[ -n "$SHORT" ] || SHORT="oil"
DAY=$(date -u +%Y-%m-%d)
FRAG="changelog.d/${DAY}-oil-autofix-${SHORT}.md"

# The summary/root come from AI-generated diagnosis JSON. Keep each on one line and
# strip "|" so they can't break the single-row Markdown table compile-changelog.sh parses.
clean() { printf '%s' "${1:-}" | tr '\n\r\t' '   ' | sed 's/|/\//g'; }
IDENT_C=$(clean "$IDENT")
REPO_C=$(clean "$REPO")
SUMMARY_C=$(clean "$SUMMARY"); [ -n "$SUMMARY_C" ] || SUMMARY_C="fix"
ROOT_C=$(clean "$ROOT");       [ -n "$ROOT_C" ] || ROOT_C="n/a"

mkdir -p "$WORK/changelog.d"
{
  printf '## fix: oil-autofix — %s\n\n' "$IDENT_C"
  printf '| Type | Summary |\n|---|---|\n'
  printf '| fix | Auto-fix proposed by oil-autofix for **%s** (repo `%s`). %s Root cause: %s. Opened as a DRAFT PR by the broker App; awaits human Telegram approval (merged by the separate oil-autofix-approver identity). The fix + repro test passed the deterministic safety gate (<=2 AI-authored files / <=100 lines, no forbidden paths, no secrets, fail-before/pass-after). This changelog fragment is written by the workflow, not the AI. |\n' \
    "$IDENT_C" "$REPO_C" "$SUMMARY_C" "$ROOT_C"
} > "$WORK/$FRAG"

printf '%s\n' "$FRAG"
