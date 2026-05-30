# Changelog fragment — session-start-hook (2026-05-30)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## chore: session-start-hook — install CI lint/test deps in Claude Code on the web sessions

| Type | Summary |
|---|---|
| chore | New `SessionStart` hook (`.claude/hooks/session-start.sh`, registered in `.claude/settings.json` alongside the existing `devplan-session-start-hook.sh`) so a Claude Code on the web session arrives with the tools the repo's CI uses already installed — no manual setup. The hook installs `shellcheck` (pinned v0.10.0 official static binary from GitHub releases, since apt's `universe` package isn't reachable in the web sandbox), `yamllint` (via pip), and `bats` (via npm); runs `git submodule update --init --recursive` to fetch the bats helper submodules under `scripts/tests/`; and runs `npm install` in `services/mcp-server`. It's web-only (`$CLAUDE_CODE_REMOTE` guard → no-op locally), idempotent, non-interactive, and synchronous (deps guaranteed ready before the session starts). Factory-internal — not propagated to provisioned systems. Verified: hook exits 0; `shellcheck --severity=error scripts/lib.sh`, `yamllint .github/workflows/pipeline-tests.yml`, `bats scripts/tests/lib.bats`, and `scripts/tests/oil-verify-selftest.sh` all green afterwards. |
