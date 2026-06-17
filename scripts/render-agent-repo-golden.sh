#!/usr/bin/env bash
# Render the agent-repo template mould (templates/agent-repo/) into a deterministic
# "golden" fingerprint, mirroring what a freshly-provisioned agent-repo receives.
# Twin of scripts/render-system-golden.sh (for the n8n "system" mould).
#
# Output (into the given dir):
#   MANIFEST.sha256   — sha256 of every file in the rendered mould (sorted,
#                       relative paths; *.template files appear as their rendered
#                       target name, just like in a real agent-repo).
#   rendered/AGENTS.md, rendered/CLAUDE.md — full rendered text of the two
#                       orientation templates, stored so a deliberate render change
#                       shows up as a human-readable diff.
#
# Inputs are fixed constants (the SAME allow-list provision-agent-repo.yml will use),
# so the render is fully deterministic.
#
#   scripts/render-agent-repo-golden.sh <output_dir>
#
set -euo pipefail

OUT_DIR="${1:?usage: render-agent-repo-golden.sh <output_dir>}"
TEMPLATES_DIR="${TEMPLATES_DIR:-templates/agent-repo}"

[ -d "$TEMPLATES_DIR" ] || { echo "templates dir not found: $TEMPLATES_DIR" >&2; exit 1; }

# Fixed, deterministic render inputs. Mirrors the allow-list provision-agent-repo.yml uses —
# keep the variable set in sync (the twin gate scripts/check-agent-repo-golden-sync.sh
# enforces byte-identical allow-lists once provision-agent-repo.yml exists).
export AGENT_REPO_NAME="golden-agent-repo"
export REPO_URL="https://github.com/edri2or/golden-agent-repo"
export ISO_TIMESTAMP="2026-01-01T00:00:00Z"
export GITHUB_RUN_ID="000000000000"
export GITHUB_RUN_URL="https://github.com/edri2or/or-factory-master/actions/runs/000000000000"
export AGENT_NAME="Golden Agent"
export AGENT_PURPOSE="Golden reference render — deterministic fixture"
ALLOWLIST='${AGENT_REPO_NAME} ${REPO_URL} ${ISO_TIMESTAMP} ${GITHUB_RUN_ID} ${GITHUB_RUN_URL} ${AGENT_NAME} ${AGENT_PURPOSE}'

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -a "$TEMPLATES_DIR/." "$WORK/"

# Render every *.template into its target name (dropping the .template source),
# exactly as a provisioned agent-repo ends up. Non-.template files (e.g. the worker
# .github/workflows/agent-main.yml) are copied verbatim — never envsubst'd, so their
# ${{ ... }} / ${VAR} expressions are preserved.
while IFS= read -r -d '' tmpl; do
  target="${tmpl%.template}"
  envsubst "$ALLOWLIST" < "$tmpl" > "$target"
  rm -f "$tmpl"
done < <(find "$WORK" -type f -name '*.template' -print0)

mkdir -p "$OUT_DIR/rendered"
cp "$WORK/AGENTS.md" "$OUT_DIR/rendered/AGENTS.md"
cp "$WORK/CLAUDE.md" "$OUT_DIR/rendered/CLAUDE.md"

# Byte-exact fingerprint of the whole rendered mould: sorted, relative paths.
( cd "$WORK" && find . -type f -print0 | LC_ALL=C sort -z \
    | xargs -0 sha256sum | sed 's#  \./#  #' ) > "$OUT_DIR/MANIFEST.sha256"

echo "rendered agent-repo golden into $OUT_DIR ($(wc -l < "$OUT_DIR/MANIFEST.sha256") files)"
