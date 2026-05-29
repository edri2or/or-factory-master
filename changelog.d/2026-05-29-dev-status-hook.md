# Changelog fragment — dev-status-hook (2026-05-29)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md`. Folded into `CHANGELOG.md` with a running Stage number by
> `scripts/compile-changelog.sh`.

## feat: /dev-stage phase 2 — SessionStart plan-state hook + /dev-status command

| Type | Summary |
|---|---|
| feat | The "phase 2" of the `/dev-stage` mechanism (core only, per Or's choice — no PostToolUse): make plan-state ambient and add an on-demand summary. New `scripts/devplan-session-start-hook.sh` + `.claude/settings.json` register a **committed `SessionStart` hook** whose stdout Claude Code injects into every session (and after compaction), so the agent re-orients on the active development(s) automatically — no more losing the thread in long sessions. New `.claude/commands/dev-status.md` (mirrored byte-identical to `templates/system/.claude/commands/` per `check-skills-mirror.sh`) is the user-triggered `/dev-status` command: a plain-Hebrew, read-only summary of the active plan(s), never the raw file. Both reuse the gate's exact path-scoped detection (root `DEVPLAN.md` + `devplans/*.md`, `status: active` on the value only so the `templates/devplan/` seed never trips them) and support **multiple** parallel active plans (aligned with the parallel-dev-stage + changelog-concurrency tracks now on `main`). The hook is strictly read-only, silent when no plan is active (zero noise for ordinary factory work), and can never break a session (`trap 'exit 0' EXIT`, no `set -e`). Hooks/settings are **factory-internal** — deliberately NOT added to `templates/system/` (systems don't run `/dev-stage`); only the `/dev-status` command mirrors, like the other 64. Named `/dev-status` (not `/status`, which is a built-in Claude Code command). `CLAUDE.md` "Development workflow" updated. Verified: `shellcheck --severity=error` + `yamllint` clean; `.claude/settings.json` valid JSON; hook proven in 3 scenarios (no plan → silent/exit 0; active plan → correct block; completed → silent); skills-mirror in sync (65/65). |
