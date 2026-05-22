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
