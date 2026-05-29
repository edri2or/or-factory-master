#!/usr/bin/env bash
set -euo pipefail
# compile-changelog.sh — fold changelog.d/*.md fragments into CHANGELOG.md as
# numbered "## Stage N" sections. The Stage numbers are assigned HERE, by this one
# (workflow-dispatched, single-threaded) run — so concurrent feature PRs never pick a
# number and never collide. Consumed fragments are deleted; when CHANGELOG.md would
# exceed the size cap, the oldest entries are auto-rotated into
# docs/changelog-archive/CHANGELOG-<date>.md (automating today's manual archive).
#
# Fragment format (one or more entries per file; see changelog.d/README.md):
#   ## <type>: <title>
#
#   | Type | Summary |
#   |---|---|
#   | <type> | <summary> |
#
# Usage:
#   scripts/compile-changelog.sh [--check]
#     --check   dry-run: report what would change, write nothing, exit 0.

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHANGELOG="CHANGELOG.md"
FRAG_DIR="changelog.d"
ARCHIVE_DIR="docs/changelog-archive"
HARD_CAP=20480          # check-changelog-size.sh limit
TARGET=18000            # compile keeps CHANGELOG.md under this (headroom below cap)
TODAY="$(date -u +%Y-%m-%d)"
ARCHIVE_FILE="$ARCHIVE_DIR/CHANGELOG-$TODAY.md"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# 1) Collect fragments (exclude README), date-prefixed names => chronological order.
frags=()
for f in "$FRAG_DIR"/*.md; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = "README.md" ] && continue
  frags+=("$f")
done
if [ "${#frags[@]}" -eq 0 ]; then
  echo "compile-changelog: no fragments in $FRAG_DIR/ — nothing to do."
  exit 0
fi
mapfile -t frags < <(printf '%s\n' "${frags[@]}" | sort)

# 2) Highest existing Stage number across CHANGELOG.md + archive.
maxn="$(grep -hoE '^## Stage [0-9]+' "$CHANGELOG" "$ARCHIVE_DIR"/*.md 2>/dev/null \
        | grep -oE '[0-9]+' | sort -n | tail -1 || true)"
maxn="${maxn:-0}"

# 3) Parse fragment entries -> TSV (heading <TAB> type <TAB> summary), chrono order.
: > "$tmp/entries.tsv"
for f in "${frags[@]}"; do
  awk '
    function emit(){ if (h!="" && got==1) printf "%s\t%s\t%s\n", h, t, s }
    /^## /                         { emit(); h=substr($0,4); got=0; sep=0; next }
    /^\|[-: |]+\|[[:space:]]*$/     { if (h!="") sep=1; next }
    sep==1 && /^\|/ && got==0 {
      line=$0; sub(/^\|[[:space:]]*/,"",line); sub(/[[:space:]]*\|$/,"",line)
      i=index(line," | ")
      if (i>0){ t=substr(line,1,i-1); s=substr(line,i+3) } else { t="chore"; s=line }
      got=1; sep=0; next
    }
    END { emit() }
  ' "$f" >> "$tmp/entries.tsv"
done

nentries="$(grep -c . "$tmp/entries.tsv" || true)"
if [ "${nentries:-0}" -eq 0 ]; then
  echo "compile-changelog: fragments present but no parseable entries — aborting." >&2
  exit 1
fi

# 4) Build new sections, newest-first (highest Stage number at the top).
#    Chrono entry i (1..n) becomes Stage maxn+i; output in reverse.
: > "$tmp/new_sections.md"
for (( i=nentries; i>=1; i-- )); do
  line="$(sed -n "${i}p" "$tmp/entries.tsv")"
  heading="${line%%$'\t'*}"
  rest="${line#*$'\t'}"
  type="${rest%%$'\t'*}"
  summary="${rest#*$'\t'}"
  n=$(( maxn + i ))
  {
    printf '## Stage %s — %s\n\n' "$n" "$heading"
    printf '| PR | Type | Summary |\n|---|---|---|\n'
    printf '| TBD | %s | %s |\n\n' "$type" "$summary"
  } >> "$tmp/new_sections.md"
done
oldest_n=$(( maxn + 1 ))
newest_n=$(( maxn + nentries ))
echo "compile-changelog: folding $nentries fragment entr(y/ies) -> Stage ${oldest_n}..${newest_n}"

# 5) Split current CHANGELOG into intro (before first '## ') and body (from first '## ').
awk '/^## /{exit} {print}' "$CHANGELOG" > "$tmp/intro.md"
awk 'f||/^## /{f=1; print}' "$CHANGELOG" > "$tmp/old_body.md"

# 6) Combined body, newest-first: new sections then existing body.
cat "$tmp/new_sections.md" "$tmp/old_body.md" > "$tmp/body.md"

# 7) Auto-archive oldest sections until intro+body <= TARGET (always keep >=1 section).
: > "$tmp/to_archive.md"
intro_bytes="$(wc -c < "$tmp/intro.md")"
while :; do
  body_bytes="$(wc -c < "$tmp/body.md")"
  [ $(( intro_bytes + body_bytes )) -le "$TARGET" ] && break
  first_start="$(grep -n '^## ' "$tmp/body.md" | head -1 | cut -d: -f1)"
  last_start="$(grep -n '^## ' "$tmp/body.md" | tail -1 | cut -d: -f1)"
  { [ -z "$last_start" ] || [ "$last_start" = "$first_start" ]; } && break
  sed -n "${last_start},\$p" "$tmp/body.md" > "$tmp/last.md"
  sed -n "1,$(( last_start - 1 ))p" "$tmp/body.md" > "$tmp/body.trim"
  mv "$tmp/body.trim" "$tmp/body.md"
  cat "$tmp/last.md" "$tmp/to_archive.md" > "$tmp/to_archive.next"
  mv "$tmp/to_archive.next" "$tmp/to_archive.md"
done

# 8) Compose the destination archive content (if anything is being rotated out).
archived_sections=0
if [ -s "$tmp/to_archive.md" ]; then
  archived_sections="$(grep -c '^## ' "$tmp/to_archive.md" || true)"
  if [ -f "$ARCHIVE_FILE" ]; then
    awk '/^## /{exit} {print}' "$ARCHIVE_FILE" > "$tmp/arc_intro.md"
    awk 'f||/^## /{f=1; print}' "$ARCHIVE_FILE" > "$tmp/arc_body.md"
  else
    printf '# Changelog archive — %s\n\nOlder `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).\n\n' "$TODAY" > "$tmp/arc_intro.md"
    : > "$tmp/arc_body.md"
  fi
  cat "$tmp/arc_intro.md" "$tmp/to_archive.md" "$tmp/arc_body.md" > "$tmp/arc_final.md"
fi

final_bytes=$(( intro_bytes + $(wc -c < "$tmp/body.md") ))

# 9) Apply (or report on --check).
if [ "$CHECK" -eq 1 ]; then
  echo "--- DRY RUN (no files written) ---"
  echo "CHANGELOG.md would be ${final_bytes} bytes (cap ${HARD_CAP})"
  [ "$archived_sections" -gt 0 ] && echo "would rotate ${archived_sections} oldest section(s) into ${ARCHIVE_FILE}"
  printf 'would delete %s fragment(s):\n' "${#frags[@]}"
  printf '  - %s\n' "${frags[@]}"
  exit 0
fi

cat "$tmp/intro.md" "$tmp/body.md" > "$CHANGELOG"
if [ "$archived_sections" -gt 0 ]; then
  mkdir -p "$ARCHIVE_DIR"
  cp "$tmp/arc_final.md" "$ARCHIVE_FILE"
fi
rm -f "${frags[@]}"

if [ "$final_bytes" -gt "$HARD_CAP" ]; then
  echo "compile-changelog: WARNING — CHANGELOG.md is ${final_bytes} bytes (> ${HARD_CAP}); a single section may exceed the headroom." >&2
fi
echo "compile-changelog: done — CHANGELOG.md ${final_bytes} bytes; archived ${archived_sections} section(s); deleted ${#frags[@]} fragment(s)."
