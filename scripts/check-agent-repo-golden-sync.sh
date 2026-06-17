#!/usr/bin/env bash
# Anti-drift twin gate for the agent-repo template's golden master. Mirror of
# scripts/check-golden-sync.sh (the system mould's twin). Two invariants, both cheap,
# both no-op when already satisfied:
#
#   (A) Path coupling — if this diff touches the agent-repo mould (templates/agent-repo/**),
#       it MUST also touch the committed golden (tests/golden/agent-repo/**). Always
#       satisfiable: run `bash scripts/check-agent-repo-golden.sh --update` and commit.
#
#   (B) Allow-list parity — the envsubst allow-list that drives the render must stay
#       byte-identical across its copies: the golden renderer
#       (scripts/render-agent-repo-golden.sh) and the real provisioner
#       (.github/workflows/provision-agent-repo.yml). The provisioner lands in Stage 3;
#       until it exists this half is skipped (forward-compatible).
set -euo pipefail

GOLDEN_RENDERER="${GOLDEN_RENDERER:-scripts/render-agent-repo-golden.sh}"
PROVISION_WF="${PROVISION_WF:-.github/workflows/provision-agent-repo.yml}"

rc=0

# --- (A) path coupling: mould change ⇒ golden change ---------------------
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
if echo "$CHANGED" | grep -qE '^templates/agent-repo/'; then
  if ! echo "$CHANGED" | grep -qE '^tests/golden/agent-repo/'; then
    echo "ERROR: templates/agent-repo/ changed but the golden (tests/golden/agent-repo/) was not updated." >&2
    echo "Changed mould files:" >&2
    echo "$CHANGED" | grep -E '^templates/agent-repo/' | sed 's/^/  - /' >&2
    echo "Run: bash scripts/check-agent-repo-golden.sh --update   (then commit tests/golden/agent-repo/ in this PR)." >&2
    rc=1
  fi
fi

# --- (B) allow-list parity (renderer ↔ provisioner), once the provisioner exists ---
extract_allowlist() {
  grep -oE "ALLOWLIST='[^']*'" "$1" 2>/dev/null | head -n1 | sed -E "s/^ALLOWLIST='//; s/'\$//"
}
if [ -f "$PROVISION_WF" ]; then
  AL_RENDER=$(extract_allowlist "$GOLDEN_RENDERER")
  AL_PROVISION=$(extract_allowlist "$PROVISION_WF")
  if [ -z "$AL_RENDER" ] || [ -z "$AL_PROVISION" ]; then
    echo "ERROR: could not read the ALLOWLIST from renderer or provisioner:" >&2
    echo "  render=[$GOLDEN_RENDERER] provision=[$PROVISION_WF]" >&2
    rc=1
  elif [ "$AL_RENDER" != "$AL_PROVISION" ]; then
    echo "ERROR: envsubst ALLOWLIST drift between the agent-repo golden renderer and provisioner." >&2
    echo "  render-agent-repo-golden.sh : $AL_RENDER" >&2
    echo "  provision-agent-repo.yml    : $AL_PROVISION" >&2
    echo "Keep both byte-identical (single source of truth for the render)." >&2
    rc=1
  fi
fi

if [ "$rc" -ne 0 ]; then
  exit 1
fi

echo "PASS: agent-repo golden in sync (mould↔golden coupling$([ -f "$PROVISION_WF" ] && echo ' + allow-list parity'))."
