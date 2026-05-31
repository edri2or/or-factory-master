#!/usr/bin/env bash
# Anti-drift twin gate for the reference system's golden master.
#
# Two invariants, both cheap, both no-op when already satisfied:
#
#   (A) Path coupling — if this diff touches the system mould
#       (templates/system/**, which includes the deploy-railway-cloudflare.yml
#       template), it MUST also touch the committed golden (tests/golden/system/**).
#       Any byte change under the mould changes the golden manifest, so this is
#       always satisfiable: run `bash scripts/check-system-golden.sh --update`
#       and commit the result in the same PR.
#
#   (B) Allow-list parity — the envsubst allow-list that drives the render must
#       stay byte-identical across its three copies: the golden renderer
#       (scripts/render-system-golden.sh), the real provision
#       (.github/workflows/provision-system.yml), and the template validator
#       (scripts/tests/validate-templates.sh). This is the part of a
#       provision-system.yml change that actually moves the golden, guarded
#       directly so an unrelated provision edit is never forced to touch the
#       golden.
#
# Twin of check-changelog-updated.sh / check-devplan-updated.sh in spirit.
set -euo pipefail

GOLDEN_RENDERER="${GOLDEN_RENDERER:-scripts/render-system-golden.sh}"
PROVISION_WF="${PROVISION_WF:-.github/workflows/provision-system.yml}"
TEMPLATE_VALIDATOR="${TEMPLATE_VALIDATOR:-scripts/tests/validate-templates.sh}"

rc=0

# --- (A) path coupling: mould change ⇒ golden change ---------------------
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
if echo "$CHANGED" | grep -qE '^templates/system/'; then
  if ! echo "$CHANGED" | grep -qE '^tests/golden/system/'; then
    echo "ERROR: templates/system/ changed but the golden (tests/golden/system/) was not updated." >&2
    echo "Changed mould files:" >&2
    echo "$CHANGED" | grep -E '^templates/system/' | sed 's/^/  - /' >&2
    echo "Run: bash scripts/check-system-golden.sh --update   (then commit tests/golden/system/ in this PR)." >&2
    rc=1
  fi
fi

# --- (B) allow-list parity across the three copies -----------------------
extract_allowlist() {
  # Prints the value inside the first ALLOWLIST='...' assignment in $1.
  grep -oE "ALLOWLIST='[^']*'" "$1" 2>/dev/null | head -n1 | sed -E "s/^ALLOWLIST='//; s/'\$//"
}

AL_RENDER=$(extract_allowlist "$GOLDEN_RENDERER")
AL_PROVISION=$(extract_allowlist "$PROVISION_WF")
AL_VALIDATE=$(extract_allowlist "$TEMPLATE_VALIDATOR")

if [ -z "$AL_RENDER" ] || [ -z "$AL_PROVISION" ] || [ -z "$AL_VALIDATE" ]; then
  echo "ERROR: could not read the ALLOWLIST from one of the three sources:" >&2
  echo "  render=[$GOLDEN_RENDERER] provision=[$PROVISION_WF] validate=[$TEMPLATE_VALIDATOR]" >&2
  rc=1
elif [ "$AL_RENDER" != "$AL_PROVISION" ] || [ "$AL_RENDER" != "$AL_VALIDATE" ]; then
  echo "ERROR: envsubst ALLOWLIST drift between the golden renderer, provision, and validator." >&2
  echo "  render-system-golden.sh : $AL_RENDER" >&2
  echo "  provision-system.yml    : $AL_PROVISION" >&2
  echo "  validate-templates.sh   : $AL_VALIDATE" >&2
  echo "Keep all three byte-identical (single source of truth for the render)." >&2
  rc=1
fi

if [ "$rc" -ne 0 ]; then
  exit 1
fi

echo "PASS: reference golden in sync (mould↔golden coupling + allow-list parity)."
