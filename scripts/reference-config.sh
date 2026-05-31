#!/usr/bin/env bash
# Reader/validator for reference-system/config.yml — the standing reference
# system's declarative descriptor. The file is flat `key: value` YAML, so this
# parses it with sed (no `yq` dependency on CI runners). Sourced as a library
# by the reconcile (Stage 4) and smoke (Stage 5) flows, or run directly:
#
#   scripts/reference-config.sh get <key> [file]   # print one value
#   scripts/reference-config.sh validate [file]     # check required keys present
#
set -euo pipefail

REF_CONFIG_FILE="${REF_CONFIG_FILE:-reference-system/config.yml}"

# ref_config_get KEY [FILE] -> prints the value (empty string if unset/blank).
# Strips an inline "# comment", surrounding quotes, and trailing whitespace.
ref_config_get() {
  local key="$1" file="${2:-$REF_CONFIG_FILE}"
  sed -n -E "s/^${key}:[[:space:]]*//p" "$file" \
    | head -n1 \
    | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

# ref_config_validate [FILE] -> 0 if every required identity key is non-empty.
ref_config_validate() {
  local file="${1:-$REF_CONFIG_FILE}"
  if [ ! -f "$file" ]; then
    echo "reference config not found: $file" >&2
    return 1
  fi
  local key missing=()
  for key in system_name repo gcp_project_id region public_url health_url; do
    if [ -z "$(ref_config_get "$key" "$file")" ]; then
      missing+=("$key")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "reference config $file missing required keys: ${missing[*]}" >&2
    return 1
  fi
  echo "reference config OK: $file"
}

# CLI entrypoint — only when executed directly, not when sourced.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  cmd="${1:-validate}"
  case "$cmd" in
    get) ref_config_get "${2:?usage: reference-config.sh get <key> [file]}" "${3:-$REF_CONFIG_FILE}" ;;
    validate) ref_config_validate "${2:-$REF_CONFIG_FILE}" ;;
    *) echo "usage: reference-config.sh {get <key> [file]|validate [file]}" >&2; exit 2 ;;
  esac
fi
