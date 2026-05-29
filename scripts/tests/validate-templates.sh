#!/usr/bin/env bash
# validate-templates.sh — Playground gate that renders every *.template file
# under templates/system/ with the same envsubst allow-list provision-system.yml
# uses, then asserts the rendered output is clean.
#
# Why: the existing CI yamllint/shellcheck only inspect the raw .yml / .sh files
# and never see what envsubst actually produces. A typo like ${SYSTEM_NAEM}
# would pass linting and only blow up at provision time, leaving a half-built
# system on a quota-billed GCP project. This script catches it before merge.
#
# Mirrors the allow-list at .github/workflows/provision-system.yml (the
# `ALLOWLIST=` line near the "Render templates with envsubst" step). Keep
# the two in sync — same source of truth.
#
# Per-file checks on the rendered output:
#   1. No leftover ${UPPER_CASE} or $UPPER_CASE placeholders — anything not
#      in the allow-list, or misspelled, is left untouched by envsubst and
#      surfaces here.
#   2. If the original name ends with .yaml.template / .yml.template, the
#      rendered file is piped through yamllint (when yamllint is available).
#   3. If the original name ends with .sh.template, the rendered file is
#      piped through `bash -n` for syntax.
#
# Exits 0 if every template passes; 1 (with named failures) otherwise.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$ROOT/templates/system"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "validate-templates: no $TEMPLATE_DIR — nothing to validate, skip." >&2
  exit 0
fi

# Realistic test values for every variable the provision allow-list covers.
# Values are deliberately recognisable as "test" — if any leaks into a real
# rendered artifact it will jump out.
export SYSTEM_NAME="test-playground-system"
export GCP_PROJECT="test-playground-system"
export PROJECT_NUMBER="123456789012"
export ISO_TIMESTAMP="2026-05-29T00:00:00Z"
export PUBLIC_URL="https://n8n-test-playground-system.or-infra.com"
export HEALTH_URL="https://n8n-test-playground-system.or-infra.com/healthz"
export REPO_URL="https://github.com/edri2or/test-playground-system"
export GITHUB_RUN_ID="99999999999"
export GITHUB_RUN_URL="https://github.com/edri2or/or-factory-master/actions/runs/99999999999"
export WIF_PROVIDER="projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
export MODE="test"
export GENERIC_SECRETS='- `test-secret-one`
- `test-secret-two`'
export SYSTEM_PURPOSE="Test purpose for playground validation"
export AGENT_NAME="Test Agent"

# Source-of-truth allow-list — must match .github/workflows/provision-system.yml.
ALLOWLIST='${SYSTEM_NAME} ${GCP_PROJECT} ${PROJECT_NUMBER} ${ISO_TIMESTAMP} ${PUBLIC_URL} ${HEALTH_URL} ${REPO_URL} ${GITHUB_RUN_ID} ${GITHUB_RUN_URL} ${WIF_PROVIDER} ${MODE} ${GENERIC_SECRETS} ${SYSTEM_PURPOSE} ${AGENT_NAME}'

# Has yamllint? If not, we skip the YAML check rather than fail — the existing
# pipeline-tests job already yamllints raw template files; this check is a
# bonus on rendered output. Track separately so the report names the reason.
if command -v yamllint >/dev/null 2>&1; then
  HAS_YAMLLINT=1
else
  HAS_YAMLLINT=0
fi

FAIL=0
PASS_COUNT=0
SKIP_YAML_COUNT=0

# Find every *.template under templates/system/, deterministically.
mapfile -d '' TEMPLATES < <(find "$TEMPLATE_DIR" -type f -name '*.template' -print0 | sort -z)

if [ "${#TEMPLATES[@]}" -eq 0 ]; then
  echo "validate-templates: no *.template files under $TEMPLATE_DIR — nothing to validate." >&2
  exit 0
fi

for src in "${TEMPLATES[@]}"; do
  rel="${src#"$ROOT/"}"
  rendered="$(mktemp)"
  # shellcheck disable=SC2064  # trap path needs to expand now
  trap "rm -f '$rendered'" EXIT

  if ! envsubst "$ALLOWLIST" < "$src" > "$rendered"; then
    echo "FAIL: $rel — envsubst exited non-zero" >&2
    FAIL=1
    rm -f "$rendered"
    continue
  fi

  # 1. Leftover-placeholder check. envsubst with an allow-list leaves any
  #    other ${FOO} or $FOO untouched, so a misspelled var jumps out here.
  if grep -oE '\$\{[A-Z_][A-Z0-9_]*\}|\$[A-Z_][A-Z0-9_]+' "$rendered" | sort -u > /tmp/leftovers.$$ 2>/dev/null; then
    if [ -s /tmp/leftovers.$$ ]; then
      echo "FAIL: $rel — unresolved placeholders in rendered output:" >&2
      sed 's/^/    /' /tmp/leftovers.$$ >&2
      FAIL=1
      rm -f /tmp/leftovers.$$ "$rendered"
      continue
    fi
    rm -f /tmp/leftovers.$$
  fi

  # 2. YAML check on rendered .yml/.yaml.template (when yamllint is around).
  case "$rel" in
    *.yml.template|*.yaml.template)
      if [ "$HAS_YAMLLINT" = "1" ]; then
        if ! yamllint -d "{extends: default, rules: {line-length: disable, document-start: disable}}" "$rendered" >/tmp/yl.$$ 2>&1; then
          echo "FAIL: $rel — yamllint errors on rendered output:" >&2
          sed 's/^/    /' /tmp/yl.$$ >&2
          FAIL=1
          rm -f /tmp/yl.$$ "$rendered"
          continue
        fi
        rm -f /tmp/yl.$$
      else
        SKIP_YAML_COUNT=$((SKIP_YAML_COUNT + 1))
      fi
      ;;
  esac

  # 3. Shell syntax check on rendered .sh.template.
  case "$rel" in
    *.sh.template)
      if ! bash -n "$rendered" >/tmp/bn.$$ 2>&1; then
        echo "FAIL: $rel — bash -n syntax errors on rendered output:" >&2
        sed 's/^/    /' /tmp/bn.$$ >&2
        FAIL=1
        rm -f /tmp/bn.$$ "$rendered"
        continue
      fi
      rm -f /tmp/bn.$$
      ;;
  esac

  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS: $rel"
  rm -f "$rendered"
done

trap - EXIT

if [ "$FAIL" -eq 1 ]; then
  echo "" >&2
  echo "validate-templates: at least one template failed validation. See above." >&2
  exit 1
fi

echo ""
echo "validate-templates: all ${PASS_COUNT} template(s) rendered cleanly."
if [ "$SKIP_YAML_COUNT" -gt 0 ]; then
  echo "  (skipped yamllint on $SKIP_YAML_COUNT YAML template(s) — yamllint not installed in this environment)"
fi
exit 0
