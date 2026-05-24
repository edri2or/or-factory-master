#!/usr/bin/env bash
# Fails CI if the global skills package mirror has drifted from the source.
# provision-system.yml scaffolds templates/system/.claude/commands/ into every
# new system repo; that directory MUST stay byte-identical to .claude/commands/
# (the factory's own slash commands) so systems ship the same skills the factory
# has. Run on push/PR to main.
set -euo pipefail

SRC=".claude/commands"
MIRROR="templates/system/.claude/commands"

for d in "$SRC" "$MIRROR"; do
  [ -d "$d" ] || { echo "ERROR: missing directory: $d" >&2; exit 1; }
done

if ! diff -rq "$SRC" "$MIRROR" >/tmp/skills-mirror-diff 2>&1; then
  echo "ERROR: skills mirror drift detected between $SRC and $MIRROR." >&2
  sed 's/^/  /' /tmp/skills-mirror-diff >&2
  echo "Re-sync with: cp $SRC/*.md $MIRROR/" >&2
  exit 1
fi

echo "PASS: skills mirror in sync ($(ls "$SRC"/*.md | wc -l | tr -d ' ') skills)."
