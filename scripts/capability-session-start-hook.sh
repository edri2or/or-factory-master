#!/usr/bin/env bash
# SessionStart hook for a PROVISIONED SYSTEM (shipped by provision-system.yml; registered
# in templates/system/.claude/settings.json). It injects a short capability orientation so a
# fresh Claude Code session on a system repo never has to "discover" what the system can do —
# it is told up front where the authoritative capability map lives (docs/CAPABILITIES.md +
# AGENTS.md), so it doesn't wrongly claim "I have no tool to read files / the database / CI".
# Claude Code injects SessionStart stdout into the session context (fresh session AND after a
# compaction), exactly like the devplan hook this mirrors.
#
# Safety: this runs at the start of every session, so it must NEVER break or stall one. It is
# strictly read-only, fast, self-guarding (prints a pointer only for files that actually
# exist, so it is harmless if shipped somewhere without them), and uses `trap 'exit 0' EXIT`
# to guarantee a clean exit no matter what (intentionally NO `set -e`).
trap 'exit 0' EXIT

# Only orient when the authoritative capability docs are present in this repo.
[ -f docs/CAPABILITIES.md ] || [ -f AGENTS.md ] || exit 0

echo "[capabilities] This is a provisioned n8n system. Before saying you cannot read a file,"
echo "[capabilities] the database, GitHub, or Railway, check what this system can actually do:"
[ -f docs/CAPABILITIES.md ] && echo "[capabilities]   • docs/CAPABILITIES.md — the live capability map (read-only tools, named queries, how to read the bot's own conversation)."
[ -f AGENTS.md ] && echo "[capabilities]   • AGENTS.md — system identity, Postgres tables, the system-aware tool list, and the secrets inventory."
echo "[capabilities] Capabilities are install-conditional (a tool is wired only when its credential exists) — confirm against the docs rather than assuming."
