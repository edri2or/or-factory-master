#!/usr/bin/env bash
# Render the system template mould (templates/system/) into a deterministic
# "golden" fingerprint, mirroring what a freshly-provisioned system receives.
#
# Output (into the given dir):
#   MANIFEST.sha256   — sha256 of every file in the rendered mould (sorted,
#                       relative paths; *.template files appear as their
#                       rendered target name, just like in a real system).
#   rendered/AGENTS.md, rendered/CLAUDE.md — full rendered text of the two
#                       orientation templates, stored so a deliberate render
#                       change shows up as a human-readable diff.
#
# Inputs are fixed constants (same 14-var allow-list as provision-system.yml),
# so the render is fully deterministic — no volatile fields to normalise.
#
#   scripts/render-system-golden.sh <output_dir>
#
set -euo pipefail

OUT_DIR="${1:?usage: render-system-golden.sh <output_dir>}"
TEMPLATES_DIR="${TEMPLATES_DIR:-templates/system}"

[ -d "$TEMPLATES_DIR" ] || { echo "templates dir not found: $TEMPLATES_DIR" >&2; exit 1; }

# Fixed, deterministic render inputs. Mirrors the allow-list at
# .github/workflows/provision-system.yml — keep the variable set in sync.
export SYSTEM_NAME="golden-reference-system"
export GCP_PROJECT="golden-reference-system"
export PROJECT_NUMBER="000000000000"
export ISO_TIMESTAMP="2026-01-01T00:00:00Z"
export PUBLIC_URL="https://n8n-golden-reference-system.or-infra.com"
export HEALTH_URL="https://n8n-golden-reference-system.or-infra.com/healthz"
export REPO_URL="https://github.com/edri2or/golden-reference-system"
export GITHUB_RUN_ID="000000000000"
export GITHUB_RUN_URL="https://github.com/edri2or/or-factory-master/actions/runs/000000000000"
export WIF_PROVIDER="projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
export MODE="test"
export GENERIC_SECRETS='- `golden-secret-one`
- `golden-secret-two`'
export SYSTEM_PURPOSE="Golden reference render — deterministic fixture"
export AGENT_NAME="Golden Agent"
ALLOWLIST='${SYSTEM_NAME} ${GCP_PROJECT} ${PROJECT_NUMBER} ${ISO_TIMESTAMP} ${PUBLIC_URL} ${HEALTH_URL} ${REPO_URL} ${GITHUB_RUN_ID} ${GITHUB_RUN_URL} ${WIF_PROVIDER} ${MODE} ${GENERIC_SECRETS} ${SYSTEM_PURPOSE} ${AGENT_NAME}'

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -a "$TEMPLATES_DIR/." "$WORK/"

# Render every *.template into its target name (dropping the .template source),
# exactly as a provisioned system ends up.
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

echo "rendered golden into $OUT_DIR ($(wc -l < "$OUT_DIR/MANIFEST.sha256") files)"
