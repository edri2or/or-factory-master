#!/usr/bin/env bash
# GCP risk-tier classifier (consolidated from edri2or/gcp-hands, Phase 3a —
# pure logic, no GCP/network). Reads policy/gcp-risk-tiers.yml and classifies a
# gcloud command (the args after the word "gcloud") into green | yellow | red.
#
# Matching is token-wise: command and pattern are split on spaces and must have
# the SAME token count; a literal "*" pattern token matches any one command
# token; every other token must match exactly. Green is checked before yellow;
# anything unmatched falls through to default_tier (red). Fail-safe by design —
# "*" never spans spaces, so the green set can't widen silently. Empty /
# whitespace-only input is always RED.
#
# In or-factory-master the tiers route as: green = the broker SA runs the read
# now; yellow = run + emit an audit event; red = NOT run here — gcp-action.yml
# routes it to the existing Telegram ✅ approval bridge.
#
# Output: one JSON line {"tier":"...","matched_pattern":"..."|null}.
# Usage: gcp-classify.sh "secrets describe my-secret"   (POLICY_FILE overrides path)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${POLICY_FILE:-$SCRIPT_DIR/../policy/gcp-risk-tiers.yml}"

if [[ ! -r "$POLICY_FILE" ]]; then
  echo "ERROR: policy file not readable: $POLICY_FILE" >&2
  exit 1
fi

# Ordered patterns for one tier. Prints the string between the first pair of
# double quotes on each '      - "..."' line, which also drops trailing
# '# comments'. Tier headers ('  green:') reset the section.
extract_patterns() {
  local tier="$1"
  awk -v want="$tier" '
    /^[[:space:]]*#/                           { next }
    /^  [a-z]+:[[:space:]]*$/                   { h=$1; sub(/:$/,"",h); gsub(/ /,"",h); cur=h; inpat=0; next }
    cur==want && /^    patterns:[[:space:]]*$/  { inpat=1; next }
    inpat && /^      -[[:space:]]+"/            { if (match($0,/"[^"]*"/)) print substr($0,RSTART+1,RLENGTH-2); next }
  ' "$POLICY_FILE"
}

# default_tier from the file; fail-safe red if absent/unparseable.
read_default() {
  local d
  d="$(awk '/^default_tier:/ {v=$2; gsub(/"/,"",v); print v; exit}' "$POLICY_FILE")"
  printf '%s' "${d:-red}"
}

cmd="${*:-}"
# read -ra drops leading/trailing whitespace and collapses runs, so empty or
# whitespace-only input yields a zero-length array.
IFS=' ' read -ra ctok <<< "$cmd"
if [[ ${#ctok[@]} -eq 0 ]]; then
  printf '{"tier":"red","matched_pattern":null}\n'
  exit 0
fi

# Reject a leading "gcloud" token. The contract is that the command is the gcloud
# ARGS only (no leading "gcloud" — gcp-action.yml prepends it at execute). A leading
# "gcloud" — most often a doubled "gcloud gcloud ..." prefix — would otherwise fall
# through to red and be sent to Or's Telegram approval card for a command that can
# only fail at runtime (the execute step re-prepends "gcloud"). Catch it HERE, in the
# risk gate, and exit non-zero so the propose flow aborts BEFORE the approval POST
# (the Classify step runs under `set -e`, so a non-zero exit stops the run). The
# doubled case is a subset; even a single leading "gcloud" is malformed. (follow-up #8)
if [[ "${ctok[0]}" == "gcloud" ]]; then
  echo "ERROR: command must be the gcloud ARGS only — it starts with a 'gcloud' token (doubled/leading 'gcloud'); pass the args without 'gcloud'." >&2
  exit 3
fi

# 0 if the command tokens (ctok) match the given pattern token-wise.
match_pattern() {
  local pat="$1"; local -a ptok; local i
  IFS=' ' read -ra ptok <<< "$pat"
  [[ ${#ptok[@]} -eq ${#ctok[@]} ]] || return 1
  for i in "${!ptok[@]}"; do
    [[ "${ptok[i]}" == "*" ]] && continue
    [[ "${ptok[i]}" == "${ctok[i]}" ]] || return 1
  done
  return 0
}

for tier in green yellow; do
  while IFS= read -r pat; do
    [[ -n "$pat" ]] || continue
    if match_pattern "$pat"; then
      printf '{"tier":"%s","matched_pattern":"%s"}\n' "$tier" "$pat"
      exit 0
    fi
  done < <(extract_patterns "$tier")
done

printf '{"tier":"%s","matched_pattern":null}\n' "$(read_default)"
