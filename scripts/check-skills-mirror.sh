#!/usr/bin/env bash
# Guards the derived slash-command package shipped to created systems.
#
# Source of truth : .claude/commands/*.md   (the factory's own slash commands)
# Derived mirror  : templates/system/.claude/commands/*.md
#
# Every source command MUST declare `audience:` in its FIRST YAML frontmatter
# block, with value `shared` or `factory-only`:
#   shared       -> ships to created systems AND used by the factory
#   factory-only -> used by the factory, NOT shipped to systems
#
# The mirror must contain EXACTLY the `audience: shared` files, byte-identical,
# and NONE of the `audience: factory-only` files. provision-system.yml copies
# templates/system/.claude into every new system repo, so the mirror == the
# slash commands a created system receives.
#
# A command with a missing/invalid `audience:` key fails CI on purpose: every
# new skill must choose where it ships. Fix drift with: scripts/sync-skills-mirror.sh
# Runs on push/PR to main (changelog-check.yml).
set -euo pipefail

SRC=".claude/commands"
MIRROR="templates/system/.claude/commands"
FIXER="scripts/sync-skills-mirror.sh"

for d in "$SRC" "$MIRROR"; do
  [ -d "$d" ] || { echo "ERROR: missing directory: $d" >&2; exit 1; }
done

# Extract `audience:` from the FIRST frontmatter block of a markdown file.
# Prints the trimmed value and exits 0 if found; exits 2 if the key is absent
# or the file has no opening frontmatter fence. Tolerates CRLF, surrounding
# whitespace, and quotes. Ignores any `audience:` that appears in the body.
extract_audience() {
  # NOTE: awk always runs END on exit, so per-branch `exit 0/2` would be
  # overridden by END. Use a `found` flag and let END decide the exit code.
  awk '
    NR == 1 {
      line = $0; sub(/\r$/, "", line)
      if (line != "---") exit   # no opening fence -> found stays 0
      next
    }
    {
      line = $0; sub(/\r$/, "", line)
      if (line == "---") exit    # closing fence reached, key not found
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

remediation() {
  echo "       Add to its frontmatter (first --- block):  audience: shared    # or: factory-only" >&2
  echo "       shared       = ships to created systems AND used by the factory" >&2
  echo "       factory-only = used by the factory, NOT shipped to systems" >&2
}

SHARED=()        # basenames expected in the mirror
AUDIENCE_ERR=()  # human-readable audience problems
factory_only=0

for f in "$SRC"/*.md; do
  base=$(basename "$f")
  if val=$(extract_audience "$f"); then
    case "$val" in
      shared)       SHARED+=("$base") ;;
      factory-only) factory_only=$((factory_only + 1)) ;;
      *)            AUDIENCE_ERR+=("$f|invalid value '$val'") ;;
    esac
  else
    AUDIENCE_ERR+=("$f|missing audience: key")
  fi
done

if [ "${#AUDIENCE_ERR[@]}" -gt 0 ]; then
  echo "ERROR: ${#AUDIENCE_ERR[@]} command file(s) have a missing or invalid 'audience:' key." >&2
  echo "Every .claude/commands/*.md must choose where it ships:" >&2
  echo >&2
  for e in "${AUDIENCE_ERR[@]}"; do
    file=${e%%|*}; why=${e#*|}
    echo "  - $file  ($why)" >&2
    remediation "$file"
    echo >&2
  done
  exit 1
fi

# Validate the mirror against the expected `shared` set.
MIRROR_ERR=()

# 1) Every mirror file must be an expected shared file, byte-identical.
for m in "$MIRROR"/*.md; do
  [ -e "$m" ] || continue   # empty mirror dir -> glob stays literal; skip
  mbase=$(basename "$m")
  expected=0
  for s in "${SHARED[@]:-}"; do
    [ "$s" = "$mbase" ] && { expected=1; break; }
  done
  if [ "$expected" -eq 0 ]; then
    MIRROR_ERR+=("unexpected mirror file (factory-only leak or stale): $MIRROR/$mbase")
  elif ! cmp -s "$SRC/$mbase" "$MIRROR/$mbase"; then
    MIRROR_ERR+=("content drift (not byte-identical to source): $mbase")
  fi
done

# 2) Every expected shared file must be present in the mirror.
for s in "${SHARED[@]:-}"; do
  [ -n "$s" ] || continue
  [ -e "$MIRROR/$s" ] || MIRROR_ERR+=("missing from mirror (shared not shipped): $s")
done

if [ "${#MIRROR_ERR[@]}" -gt 0 ]; then
  echo "ERROR: skills mirror is out of sync with the audience model." >&2
  for e in "${MIRROR_ERR[@]}"; do
    echo "  - $e" >&2
  done
  echo >&2
  echo "Regenerate the mirror to match .claude/commands/ audience tags:" >&2
  echo "    bash $FIXER" >&2
  exit 1
fi

echo "PASS: ${#SHARED[@]} shared shipped, ${factory_only} factory-only excluded."
