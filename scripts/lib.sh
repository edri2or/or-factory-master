#!/usr/bin/env bash
# Shared helpers sourced by documentation check scripts.

# Prints code files changed in HEAD~1..HEAD, restricted to extensions we
# consider "code" for changelog gating: .sh / .json / .yml / .yaml.
# Returns empty (not exit 1) when no matching files exist so callers are
# safe under set -euo pipefail.
get_code_files() {
  local changed="$1"
  echo "$changed" | grep -E '\.(sh|json|yml|yaml)$' || true
}

# --- E2E verification gate helpers -------------------------------------------
# "Behavior-bearing" files are the ones whose change alters how the running bot
# *behaves* (its n8n workflows + the installer that wires them). A change to any
# of them must be accompanied by a fresh E2E proof in the same diff. Used by both
# the proof producer (e2e-verify.yml) and the enforcing gate (check-e2e-proof.sh),
# so the SET and the HASH are defined here once — a single source of truth.
#
# A repo is either the factory (templates/system/...) or a provisioned system
# (workflows/... at the root). Matching both path families is harmless: only one
# family exists in any given repo.

# Regex (anchored) matching a behavior-bearing path in a `git diff --name-only` list.
e2e_behavior_regex() {
  echo '^(templates/system/workflows/n8n/.*\.json|templates/system/\.github/workflows/configure-agent-router\.yml|workflows/n8n/.*\.json|\.github/workflows/configure-agent-router\.yml)$'
}

# Prints the behavior-bearing paths from `$CHANGED` that the diff touched (empty
# if none). Returns 0 always; callers test for emptiness.
e2e_changed_behavior_files() {
  local changed="$1"
  echo "$changed" | grep -E "$(e2e_behavior_regex)" || true
}

# Prints the FULL set of behavior-bearing files that currently exist in the repo
# (factory set if present, else system set), one per line, sorted. Used to hash
# the proven tree — so the proof binds to the whole behavior surface, not just the
# files one PR happened to touch.
e2e_behavior_files() {
  local f out=()
  if [ -d templates/system/workflows/n8n ]; then
    for f in templates/system/workflows/n8n/*.json; do [ -f "$f" ] && out+=("$f"); done
    [ -f templates/system/.github/workflows/configure-agent-router.yml ] \
      && out+=(templates/system/.github/workflows/configure-agent-router.yml)
  elif [ -d workflows/n8n ]; then
    for f in workflows/n8n/*.json; do [ -f "$f" ] && out+=("$f"); done
    [ -f .github/workflows/configure-agent-router.yml ] \
      && out+=(.github/workflows/configure-agent-router.yml)
  fi
  [ ${#out[@]} -eq 0 ] && return 0
  printf '%s\n' "${out[@]}" | LC_ALL=C sort
}

# Deterministic content hash over the behavior-bearing files: for each file (in
# sorted order) feed its path then a NUL then its bytes into sha256. Prints
# "sha256:<hex>". Identical computation on both producer and gate, so editing any
# behavior file after proving changes the hash and invalidates the proof.
e2e_behavior_hash() {
  local f
  {
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      printf '%s\0' "$f"
      cat "$f"
      printf '\0'
    done < <(e2e_behavior_files)
  } | sha256sum | awk -v p="sha256:" '{print p $1}'
}
