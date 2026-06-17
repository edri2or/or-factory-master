#!/bin/bash
# SessionStart hook: install the dependencies the repo's CI relies on so that
# linters and tests can run inside a Claude Code on the web session.
#
#   - shellcheck + yamllint  -> pipeline-tests.yml "shellcheck + yamllint" job
#   - envsubst (gettext-base)-> scripts/render-system-golden.sh (System golden gate)
#   - bats + git submodules  -> scripts/tests/*.bats
#   - node deps (npm)        -> services/mcp-server `node --test`
#
# Idempotent and non-interactive. Web-only (no-op locally). Installs avoid the
# blocked third-party apt PPAs in the web sandbox: yamllint via pip, bats via
# npm, shellcheck via its official static release binary.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# 1. shellcheck — official static binary (apt's universe pkg isn't reachable
#    in the sandbox). Pinned; installed to a PATH dir.
if ! command -v shellcheck >/dev/null 2>&1; then
  sc_ver="v0.10.0"
  sc_url="https://github.com/koalaman/shellcheck/releases/download/${sc_ver}/shellcheck-${sc_ver}.linux.x86_64.tar.xz"
  tmp="$(mktemp -d)"
  if curl -fsSL "$sc_url" -o "$tmp/sc.tar.xz" \
      && tar -xJf "$tmp/sc.tar.xz" -C "$tmp"; then
    sudo install -m755 "$tmp/shellcheck-${sc_ver}/shellcheck" /usr/local/bin/shellcheck
  fi
  rm -rf "$tmp"
fi

# 2. yamllint — via pip (no apt). Lands on the system PATH under root.
command -v yamllint >/dev/null 2>&1 || python3 -m pip install --quiet yamllint

# 2b. envsubst (gettext-base) — a base Ubuntu pkg. Required by
#     scripts/render-system-golden.sh + scripts/tests/validate-templates.sh
#     (the System golden gate / template validation) — without it a golden render
#     fails with "envsubst: command not found". The sandbox's broken third-party
#     PPAs (deadsnakes/ondrej) can make `apt-get update` exit non-zero, which would
#     otherwise skip this base-package install — so tolerate an update failure and
#     still attempt the install.
command -v envsubst >/dev/null 2>&1 || { sudo apt-get update -qq || true; sudo apt-get install -y -qq gettext-base || true; }

# 3. bats test runner (via npm) + its helper submodules (scripts/tests/*.bats).
command -v bats >/dev/null 2>&1 || npm install -g bats >/dev/null 2>&1
git submodule update --init --recursive

# 4. Node dependencies for the MCP server (`npm test` -> tsc + node --test).
if [ -f services/mcp-server/package.json ]; then
  ( cd services/mcp-server && npm install --no-audit --no-fund )
fi

# Verify each dependency is actually present and report honestly, instead of
# assuming success. Non-fatal: a missing tool emits a ::warning:: (so the CI gate
# that relies on it later fails with a clear cause) but never breaks the session.
missing=""
for tool in shellcheck yamllint envsubst bats; do
  command -v "$tool" >/dev/null 2>&1 || missing="${missing} ${tool}"
done
if [ -n "$missing" ]; then
  echo "::warning::session-start hook: dependencies MISSING:${missing} — the CI gate(s) relying on them will fail until installed (e.g. envsubst → System golden gate)."
else
  echo "session-start hook: dependencies ready (shellcheck, yamllint, envsubst, bats, mcp-server node deps)."
fi
