#!/usr/bin/env bash
# Agent-repo risk-tier classifier (Stage 4a). Twin-in-spirit of scripts/gcp-classify.sh, but
# for FREEFORM agent tasks: scans the task text case-insensitively against
# policy/agent-risk-tiers.yml and classifies it green | yellow | red. RED is checked first
# (a dangerous / cross-boundary request wins), then YELLOW (self-write), else GREEN (the
# default — the read-only worker is inherently safe). Heuristic red-flag gate, not a
# structured parser; false-positives merely route to Or's Telegram ✅ (safe).
#
# Output: one JSON line {"tier":"...","matched_pattern":"..."|null}.
# Usage: agent-classify.sh "summarise the README"      (POLICY_FILE overrides the path)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${POLICY_FILE:-$SCRIPT_DIR/../policy/agent-risk-tiers.yml}"

if [[ ! -r "$POLICY_FILE" ]]; then
  echo "ERROR: policy file not readable: $POLICY_FILE" >&2
  exit 1
fi

# Ordered patterns for one tier (same YAML shape as gcp-risk-tiers.yml): prints the string
# between the first pair of double quotes on each '      - "..."' line; tier headers reset.
extract_patterns() {
  local tier="$1"
  awk -v want="$tier" '
    /^[[:space:]]*#/                           { next }
    /^  [a-z]+:[[:space:]]*$/                   { h=$1; sub(/:$/,"",h); gsub(/ /,"",h); cur=h; inpat=0; next }
    cur==want && /^    patterns:[[:space:]]*$/  { inpat=1; next }
    inpat && /^      -[[:space:]]+"/            { if (match($0,/"[^"]*"/)) print substr($0,RSTART+1,RLENGTH-2); next }
  ' "$POLICY_FILE"
}

read_default() {
  local d
  d="$(awk '/^default_tier:/ {v=$2; gsub(/"/,"",v); print v; exit}' "$POLICY_FILE")"
  printf '%s' "${d:-green}"
}

task="${*:-}"
# Lowercase once for case-insensitive substring matching.
lc="$(printf '%s' "$task" | tr '[:upper:]' '[:lower:]')"
if [[ -z "${lc// /}" ]]; then
  # Empty task — the broker validates non-empty separately; nothing to flag.
  printf '{"tier":"green","matched_pattern":null}\n'
  exit 0
fi

# RED first (a dangerous request wins even if the task also mentions safe work), then YELLOW.
for tier in red yellow; do
  while IFS= read -r pat; do
    [[ -n "$pat" ]] || continue
    plc="$(printf '%s' "$pat" | tr '[:upper:]' '[:lower:]')"
    if [[ "$lc" == *"$plc"* ]]; then
      printf '{"tier":"%s","matched_pattern":"%s"}\n' "$tier" "$pat"
      exit 0
    fi
  done < <(extract_patterns "$tier")
done

printf '{"tier":"%s","matched_pattern":null}\n' "$(read_default)"
