#!/usr/bin/env bash
# Agent-repo risk-tier classifier (Stage 4a). Twin-in-spirit of scripts/gcp-classify.sh, but
# for FREEFORM agent tasks: scans the task text case-insensitively against
# policy/agent-risk-tiers.yml and classifies it green | yellow | red. RED is checked first
# (a dangerous / cross-boundary request wins), then YELLOW (self-write), else GREEN (the
# default — the read-only worker is inherently safe). Heuristic red-flag gate, not a
# structured parser; false-positives merely route to Or's Telegram ✅ (safe).
#
# CAPABILITY-AWARE CAP (Fix 1): the second argument (or $WORKER_REPO) is the worker repo the
# task is routed to. A READ-ONLY worker (per `worker_capabilities` in the policy) cannot perform
# any RED action — Read/Grep/Glob only — so its EFFECTIVE tier is capped at YELLOW (the RED
# Telegram gate is skipped; it would only add false friction on a task that merely *mentions* a
# risky word — the exact false-positive that blocked Nuriel's read-only research). The RED gate
# stays fully active for write-capable workers. Fail-safe: a worker absent from the map defaults
# to `default_worker_capability` (write) → still RED-gated. With NO worker passed, behaviour is
# unchanged (treated as the write default → no cap) — backward compatible.
#
# Output: one JSON line
#   {"tier":"<effective>","content_tier":"<from-text>","matched_pattern":"..."|null,"worker_capability":"..."}
# `tier` is what the broker routes on (the capped value); `content_tier` is the raw text verdict.
# Usage: agent-classify.sh "<task>" [worker_repo]   (POLICY_FILE / WORKER_REPO env override)
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

# The fail-safe default capability for a worker absent from the map (or no worker).
read_default_worker_capability() {
  local d
  d="$(awk '/^default_worker_capability:/ {v=$2; gsub(/"/,"",v); print v; exit}' "$POLICY_FILE")"
  printf '%s' "${d:-write}"
}

# Look up a worker's capability from the `worker_capabilities:` map. Normalises owner/repo →
# repo. Empty/unlisted worker → fail-safe default (no cap).
read_worker_capability() {
  local worker="${1:-}" cap=""
  [[ -n "$worker" ]] || { read_default_worker_capability; return 0; }
  worker="${worker##*/}"
  cap="$(awk -v w="$worker" '
    /^worker_capabilities:[[:space:]]*$/ { inmap=1; next }
    inmap && /^[[:space:]]*#/            { next }
    inmap && /^[^[:space:]]/             { inmap=0 }
    inmap {
      key=$1; sub(/:$/,"",key)
      if (key==w) { print $2; exit }
    }
  ' "$POLICY_FILE")"
  [[ -n "$cap" ]] || cap="$(read_default_worker_capability)"
  printf '%s' "$cap"
}

task="${1:-}"
worker_repo="${2:-${WORKER_REPO:-}}"
# Lowercase once for case-insensitive substring matching.
lc="$(printf '%s' "$task" | tr '[:upper:]' '[:lower:]')"

content_tier=""
matched=""
if [[ -z "${lc// /}" ]]; then
  # Empty task — the broker validates non-empty separately; nothing to flag.
  content_tier="green"
else
  # RED first (a dangerous request wins even if the task also mentions safe work), then YELLOW.
  for tier in red yellow; do
    while IFS= read -r pat; do
      [[ -n "$pat" ]] || continue
      plc="$(printf '%s' "$pat" | tr '[:upper:]' '[:lower:]')"
      if [[ "$lc" == *"$plc"* ]]; then
        content_tier="$tier"; matched="$pat"; break 2
      fi
    done < <(extract_patterns "$tier")
  done
  [[ -n "$content_tier" ]] || content_tier="$(read_default)"
fi

# Capability-aware cap: a read-only worker can never act on a red flag → cap red→yellow.
cap="$(read_worker_capability "$worker_repo")"
effective="$content_tier"
if [[ "$cap" == "read-only" && "$content_tier" == "red" ]]; then
  effective="yellow"
fi

if [[ -n "$matched" ]]; then
  mp="\"$matched\""
else
  mp="null"
fi
printf '{"tier":"%s","content_tier":"%s","matched_pattern":%s,"worker_capability":"%s"}\n' \
  "$effective" "$content_tier" "$mp" "$cap"
