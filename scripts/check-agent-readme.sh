#!/usr/bin/env bash
# check-agent-readme.sh — fail-closed CI gate: every canonical agent-folder
# (agents/<name>/) must carry a hybrid README.md whose managed block is up to date.
#
# Twin of check-agent-folder.sh (same layout auto-detect, same Hebrew-then-English
# messages, same no-op when there is no agents/ dir). For each agent-folder:
#   (1) README.md exists;
#   (2) it carries exactly one BEGIN/END marker pair;
#   (3) a fresh render (build-agent-readme.sh <name> --stdout) matches the committed
#       README — i.e. the managed block is in sync with agent.yaml + tools.yaml.
# The comparison is against the COMMITTED file in the working tree (not a base branch),
# so it is shallow-clone-safe; the generator output is deterministic, so a match is
# reproducible. Modeled structurally on or-aios's check-agent-readme.sh.
#
# A folder without an agent.yaml is not an agent-folder and is skipped (so is any
# _-prefixed dir, e.g. _spec). No-op (clean PASS) when there is no agents/ dir, so it is
# safe to run anywhere — the factory mould and a provisioned system alike.
#
# Deps: python3/pyyaml (the YAML→JSON bridge build-agent-readme.sh uses; the repo
# deliberately avoids `yq`). Exit 0/1.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Layout auto-detect: the factory keeps the mould under templates/system/; a provisioned
# system carries agents/ + scripts/build-agent-readme.sh at its repo root.
if [ -d "$REPO_ROOT/templates/system/agents" ]; then
  AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/templates/system/agents}"
  GENERATOR="${GENERATOR:-$REPO_ROOT/scripts/build-agent-readme.sh}"
else
  AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/agents}"
  GENERATOR="${GENERATOR:-$SCRIPT_DIR/build-agent-readme.sh}"
fi

BEGIN_MARKER="<!-- BEGIN_AGENT_HOME -->"
END_MARKER="<!-- END_AGENT_HOME -->"
fail=0
n=0

if [ ! -d "$AGENTS_DIR" ]; then
  echo "PASS: אין תיקיית agents/ — אין מה לבדוק (no agents/ dir — nothing to check)."
  exit 0
fi

for d in "$AGENTS_DIR"/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  case "$name" in _*) continue ;; esac       # _spec and any _-prefixed helper dir
  [ -f "${d}agent.yaml" ] || continue        # not an agent-folder
  n=$((n + 1))
  readme="${d}README.md"

  # (1) existence
  if [ ! -f "$readme" ]; then
    echo "ERROR: agents/${name} — אין README.md (no README.md)." >&2
    echo "       scaffold it from agents/_spec/README.template.md, then run: bash scripts/build-agent-readme.sh ${name}" >&2
    fail=1
    continue
  fi

  # (2) exactly one BEGIN and one END marker
  begin_count="$(grep -cF "$BEGIN_MARKER" "$readme" || true)"
  end_count="$(grep -cF "$END_MARKER" "$readme" || true)"
  if [ "$begin_count" != "1" ] || [ "$end_count" != "1" ]; then
    echo "ERROR: ${readme} — חייב בדיוק זוג סימונים אחד (must contain exactly one '${BEGIN_MARKER}' and one '${END_MARKER}'; found ${begin_count}/${end_count})." >&2
    fail=1
    continue
  fi

  # (3) generate-and-diff against the committed file
  if ! rendered="$(AGENTS_DIR="$AGENTS_DIR" bash "$GENERATOR" "$name" --stdout 2>/tmp/readme-err.$$)"; then
    echo "ERROR: agents/${name} — המייצר נכשל (README generator failed):" >&2
    sed 's/^/    /' "/tmp/readme-err.$$" >&2 || true
    rm -f "/tmp/readme-err.$$"
    fail=1
    continue
  fi
  rm -f "/tmp/readme-err.$$"

  if ! diff "$readme" <(printf '%s\n' "$rendered") >/tmp/readme-diff.$$ 2>&1; then
    echo "ERROR: agents/${name} — הבלוק המנוהל ב-README לא מסונכרן עם agent.yaml/tools.yaml." >&2
    echo "       ${readme} managed block is out of date. Run: bash scripts/build-agent-readme.sh ${name}" >&2
    sed 's/^/    /' "/tmp/readme-diff.$$" >&2 || true
    fail=1
  fi
  rm -f "/tmp/readme-diff.$$"
done

if [ "$n" = "0" ]; then
  echo "PASS: אין תיקיות-סוכן ב-agents/ (only _spec present — nothing to validate)."
  exit 0
fi

if [ "$fail" -ne 0 ]; then
  echo "agent README check FAILED — every agents/<name>/ needs a README.md with an up-to-date managed block." >&2
  exit 1
fi
echo "PASS: agent README — ${n} agent folder(s) carry a README with an up-to-date managed block."
