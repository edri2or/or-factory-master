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

# --- E2E surface registry helpers --------------------------------------------
# Generalized, risk-tiered E2E enforcement: every runtime surface that needs an
# E2E proof is a data entry in e2e-surfaces.json (see docs/e2e-enforcement-standard.md).
# Each surface declares its trigger paths, proof producer, proof glob, hash inputs,
# freshness window, and whether it is enforced. The gate (check-e2e-proof.sh) and
# the proof producers source these helpers — single source of truth.
#
# A repo is either the factory (templates/system/... present) or a provisioned
# system (paths at the root). A scope=system surface is matched/hashed UNDER
# templates/system/ in the factory, and at the root in a system. When the registry
# file is absent (e.g. a system provisioned before this shipped), a built-in
# default = the telegram-bot surface preserves the original behavior exactly.

# Emit the registry JSON (the file if present, else the built-in bot default).
_e2e_registry() {
  if [ -f e2e-surfaces.json ]; then
    cat e2e-surfaces.json
  else
    printf '%s' '{"version":1,"surfaces":[{"id":"telegram-bot","name_he":"בוט inbound","risk_tier":"critical","scope":"system","trigger_paths":["workflows/n8n/*.json",".github/workflows/configure-agent-router.yml"],"proof_producer":"e2e-verify.yml","proof_glob":"e2e-proofs/*.json","hash_inputs":["workflows/n8n/*.json",".github/workflows/configure-agent-router.yml"],"freshness_days":14,"enforce":true}]}'
  fi
}

# True (0) when running inside the factory repo.
_e2e_in_factory() { [ -d templates/system ]; }

# Path prefix for a surface scope: scope=system lives under templates/system/ in
# the factory, at the root in a system; scope=factory is always root-relative.
_e2e_scope_prefix() {
  if [ "$1" = "system" ] && _e2e_in_factory; then echo "templates/system/"; fi
}

# Convert a restricted glob (literal + single-segment '*') to an ERE body.
_e2e_glob_to_regex() {
  printf '%s' "$1" | sed -e 's/\./\\./g' -e 's#\*#[^/]*#g'
}

# Read one field of a surface (jq -r; empty if missing).
e2e_surface_get() {
  _e2e_registry | jq -r --arg id "$1" --arg f "$2" \
    '.surfaces[]|select(.id==$id)|.[$f] // empty'
}

# IDs of all ENFORCED surfaces (enforce==true), one per line.
e2e_enforced_surface_ids() {
  _e2e_registry | jq -r '.surfaces[]|select(.enforce==true)|.id'
}

# Allowed proof systems for a surface (proof_systems[]), one per line; empty (no
# constraint) when the field is absent — keeps the gate backward-compatible.
# Pins the live proof to a specific standing proving system (e.g. or-edri-4): the
# factory's rule is "prove on or-edri-4 first, then lock into the template".
e2e_surface_proof_systems() {
  _e2e_registry | jq -r --arg id "$1" \
    '.surfaces[]|select(.id==$id)|.proof_systems[]? // empty'
}

# True (0) when a proof's system satisfies a surface's proof_systems constraint:
# allowed empty -> any system passes; else the system must be one of the listed.
# Pure helper (no I/O) — unit-testable in isolation.
e2e_proof_system_allowed() {
  local system="$1" allowed="$2" a
  [ -n "$allowed" ] || return 0
  while IFS= read -r a; do
    [ -n "$a" ] || continue
    [ "$system" = "$a" ] && return 0
  done <<< "$allowed"
  return 1
}

# The default surface = the first enforced surface (the bot). Back-compat anchor.
_e2e_default_surface() {
  local id; id="$(e2e_enforced_surface_ids | head -n1)"; echo "${id:-telegram-bot}"
}

# Anchored alternation regex matching a surface's trigger paths (prefix-applied).
e2e_surface_trigger_regex() {
  local id="$1" prefix glob; local parts=()
  prefix="$(_e2e_scope_prefix "$(e2e_surface_get "$id" scope)")"
  while IFS= read -r glob; do
    [ -n "$glob" ] || continue
    parts+=("$(_e2e_glob_to_regex "${prefix}${glob}")")
  done < <(_e2e_registry | jq -r --arg id "$id" '.surfaces[]|select(.id==$id)|.trigger_paths[]?')
  [ ${#parts[@]} -eq 0 ] && { echo 'a^'; return 0; }   # 'a^' matches no line
  local IFS='|'; echo "^(${parts[*]})$"
}

# Changed files (from $changed) matching a surface's triggers.
e2e_changed_surface_files() {
  echo "$2" | grep -E "$(e2e_surface_trigger_regex "$1")" || true
}

# The existing files a surface hashes (hash_inputs globs, prefix-applied), sorted.
e2e_surface_hash_files() {
  local id="$1" prefix glob f; local out=()
  prefix="$(_e2e_scope_prefix "$(e2e_surface_get "$id" scope)")"
  while IFS= read -r glob; do
    [ -n "$glob" ] || continue
    # shellcheck disable=SC2086
    for f in ${prefix}${glob}; do [ -f "$f" ] && out+=("$f"); done
  done < <(_e2e_registry | jq -r --arg id "$id" '.surfaces[]|select(.id==$id)|.hash_inputs[]?')
  [ ${#out[@]} -eq 0 ] && return 0
  printf '%s\n' "${out[@]}" | LC_ALL=C sort -u
}

# Deterministic content hash over a surface's hash files: for each file (sorted)
# feed its path then NUL then its bytes into sha256. Prints "sha256:<hex>".
e2e_surface_hash() {
  local f
  {
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      printf '%s\0' "$f"; cat "$f"; printf '\0'
    done < <(e2e_surface_hash_files "$1")
  } | sha256sum | awk -v p="sha256:" '{print p $1}'
}

# --- Back-compat wrappers (default = the first enforced surface, the bot) ------
# Kept so the proof producers (e2e-verify.yml) need no change; they prove the bot.
e2e_behavior_regex()         { e2e_surface_trigger_regex "$(_e2e_default_surface)"; }
e2e_changed_behavior_files() { e2e_changed_surface_files "$(_e2e_default_surface)" "$1"; }
e2e_behavior_files()         { e2e_surface_hash_files "$(_e2e_default_surface)"; }
e2e_behavior_hash()          { e2e_surface_hash "$(_e2e_default_surface)"; }
