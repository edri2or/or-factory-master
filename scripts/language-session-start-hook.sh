#!/usr/bin/env bash
# SessionStart hook for a PROVISIONED SYSTEM (shipped by provision-system.yml; registered
# in templates/system/.claude/settings.json). It injects a short reminder of the LANGUAGE
# BOUNDARY so a fresh Claude Code session on a system repo always knows the rule up front,
# instead of discovering it only when a skill happens to trigger: the system works in
# ENGLISH on the inside, and speaks HEBREW only at the edge the operator (Or) sees. Without
# this, a new session handed a request written in Hebrew might mirror it and write internal
# material in Hebrew, quietly undoing the boundary. Claude Code injects SessionStart stdout
# into the session context (fresh session AND after a compaction), exactly like the
# capability/devplan hooks this mirrors.
#
# Safety: this runs at the start of every session, so it must NEVER break or stall one. It is
# strictly read-only, fast, self-guarding (prints nothing if the orientation docs are absent,
# so it is harmless if shipped somewhere without them), and uses `trap 'exit 0' EXIT` to
# guarantee a clean exit no matter what (intentionally NO `set -e`).
trap 'exit 0' EXIT

# Only orient when this system's orientation docs are present in this repo.
[ -f docs/language-boundary.md ] || [ -f AGENTS.md ] || exit 0

echo "[language-boundary] This system works in ENGLISH internally and speaks HEBREW only at the edge Or sees."
echo "[language-boundary] When you write or change anything, keep to the boundary:"
echo "[language-boundary]   • INTERNAL → English: code, files agents read, skills, docs, prompts, comments, plans, commits."
echo "[language-boundary]   • THE EDGE → Hebrew: your session replies to Or, the Telegram bot's replies, the websites."
echo "[language-boundary]     The edge is the coordinator (this session) — NOT each specialist; specialists work in English."
echo "[language-boundary]   • NEVER translate functional Hebrew (C): classifier few-shot, keyword/verb/trigger arrays, eval.yaml,"
echo "[language-boundary]     test fixtures, skill trigger phrases — Hebrew there is behavior, not text. NEVER translate operator surfaces (D)."
echo "[language-boundary] So: if Or dictates a new skill/doc in Hebrew, write it in English and give HIM the answer in Hebrew."
[ -f docs/language-boundary.md ] && echo "[language-boundary] Authoritative source: docs/language-boundary.md (the A/B/C/D categories + the boundary mechanism)."
