#!/usr/bin/env bash
# Regenerates the derived slash-command package from .claude/commands/.
#
# Deletes the current mirror *.md files and re-copies ONLY the
# `audience: shared` command files, byte-for-byte. Run this whenever
# check-skills-mirror.sh reports drift, or after adding / retagging a command.
#
# Refuses to run if any source command has a missing or invalid `audience:`
# key, because that would silently produce a wrong subset. Fix the tags first.
set -euo pipefail

SRC=".claude/commands"
MIRROR="templates/system/.claude/commands"

[ -d "$SRC" ] || { echo "ERROR: missing directory: $SRC" >&2; exit 1; }
mkdir -p "$MIRROR"

# Identical extractor to check-skills-mirror.sh: first frontmatter block only.
extract_audience() {
  # awk always runs END on exit; use a `found` flag so END sets the exit code.
  awk '
    NR == 1 {
      line = $0; sub(/\r$/, "", line)
      if (line != "---") exit
      next
    }
    {
      line = $0; sub(/\r$/, "", line)
      if (line == "---") exit
      if (line ~ /^[[:space:]]*audience[[:space:]]*:/) {
        sub(/^[[:space:]]*audience[[:space:]]*:[[:space:]]*/, "", line)
        sub(/[[:space:]]+$/, "", line)
        gsub(/^["'\'']|["'\'']$/, "", line)
        print line
        found = 1
        exit
      }
    }
    END { exit (found ? 0 : 2) }
  ' "$1"
}

SHARED=()
BAD=()

for f in "$SRC"/*.md; do
  base=$(basename "$f")
  if val=$(extract_audience "$f"); then
    case "$val" in
      shared)       SHARED+=("$base") ;;
      factory-only) : ;;
      *)            BAD+=("$f (invalid value '$val')") ;;
    esac
  else
    BAD+=("$f (missing audience: key)")
  fi
done

if [ "${#BAD[@]}" -gt 0 ]; then
  echo "ERROR: refusing to sync; fix these 'audience:' tags first:" >&2
  for b in "${BAD[@]}"; do echo "  - $b" >&2; done
  echo "       Each must declare:  audience: shared   # or: factory-only" >&2
  exit 1
fi

# Clear existing mirror *.md (preserve the directory and any non-.md files).
find "$MIRROR" -maxdepth 1 -type f -name '*.md' -delete

excluded=0
for f in "$SRC"/*.md; do
  base=$(basename "$f")
  is_shared=0
  for s in "${SHARED[@]:-}"; do
    [ "$s" = "$base" ] && { is_shared=1; break; }
  done
  if [ "$is_shared" -eq 1 ]; then
    cp -p "$SRC/$base" "$MIRROR/$base"
  else
    excluded=$((excluded + 1))
  fi
done

echo "Synced: ${#SHARED[@]} shared command(s) copied to $MIRROR."
echo "        (${excluded} factory-only command(s) excluded.)"
