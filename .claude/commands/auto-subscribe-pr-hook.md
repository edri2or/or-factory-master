---
audience: shared
description: Install a SessionStart hook so each new Claude Code session auto-subscribes to GitHub PR webhook activity (CI, reviews, merges) for the current branch's open PR. Use when PR subscriptions must persist across sessions and compacts.
synthesis-required: false
adapted-by: skill-adapter
adapted-on: 2026-05-24
---

# Auto-subscribe to PR Activity on SessionStart

## Role

You are a Workflow Plumber installing a two-file change in the target repo so PR-activity subscription becomes a SessionStart invariant instead of a manual `mcp__github__subscribe_pr_activity` call the user has to remember on every fresh session, `/compact`, or `/clear`.

## Context — Read First

- `.claude/settings.json` in the target repo (may not exist — create if absent).
- `.claude/hooks/` in the target repo (may not exist — create if absent).
- The target repo's doc-policy enforcer, if any (e.g. `scripts/check_policies.py`), so you can dry-run it before advising commit.

## Instructions

### Step 1: Confirm the environment

- The target repo uses Claude Code with the GitHub MCP server (`mcp__github__*` tools must be available to sessions).
- The user has explicit intent to install a persistent subscription hook — not a one-time `subscribe_pr_activity` call on the current PR.

If either is false, stop and clarify.

### Step 2: Write the hook script

Create `.claude/hooks/auto-subscribe-pr.sh` with this exact body and `chmod +x`:

```bash
#!/bin/bash
# MCP isn't connected at SessionStart, so subscribe via a stdout instruction
# the model executes once its tools are live — not via `type: mcp_tool`.
set -euo pipefail

branch="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

case "$branch" in
  "" | "HEAD" | "main" | "master") exit 0 ;;
esac

echo "[auto-subscribe-pr] Branch: $branch — if an open PR has this branch as head, call mcp__github__subscribe_pr_activity (find it via mcp__github__list_pull_requests state=\"open\" head=\"<owner>:$branch\")."
```

**Judgment call — non-standard default branch:** if the repo's default is `trunk`, `develop`, or similar, add it to the `case` arm so the hook stays silent on it.

### Step 3: Register the hook in `.claude/settings.json`

**Judgment call — existing SessionStart hook:**

- **If `.claude/settings.json` has no `hooks.SessionStart`** (or no file): create/merge the minimal scaffold with a single-entry array pointing at the new script.
- **If a SessionStart hook already exists** (e.g. `session-start.sh` for `npm install`): add the new script as a **sibling inner hook within the same outer entry**, not as a second outer array entry. Both run on every SessionStart, so collapsing them into one `hooks` array is the clean form:

```json
"SessionStart": [
  {
    "hooks": [
      { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh" },
      { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/auto-subscribe-pr.sh" }
    ]
  }
]
```

### Step 4: Validate locally

Run all three before advising commit:

```bash
# 1. On the default branch — hook must be silent.
git switch main 2>/dev/null || git switch master
./.claude/hooks/auto-subscribe-pr.sh; echo "exit=$?"   # expect: exit=0, no stdout

# 2. On a feature branch — hook must emit one instruction line.
git switch -c _test_auto_subscribe
./.claude/hooks/auto-subscribe-pr.sh; echo "exit=$?"   # expect: "[auto-subscribe-pr] Branch: ..." then exit=0
git switch - && git branch -D _test_auto_subscribe

# 3. settings.json parses as JSON.
python3 -c "import json; json.load(open('.claude/settings.json'))"
```

If the repo has `scripts/check_policies.py` (or equivalent), run it against the working diff too.

### Step 5: End-to-end validation (post-merge)

After the install PR merges, open a fresh Claude Code session on any branch with an open PR. The model should call `mcp__github__subscribe_pr_activity` on turn 1 without being asked. If it doesn't: see Troubleshooting in the source-experiment repo.

## Safety Rules

1. **Never use `type: "mcp_tool"` for this hook.** MCP servers are not connected at SessionStart — a direct tool call would fail silently. Always use `type: "command"` and emit the subscribe instruction as stdout text.
2. **Never skip Step 4's local dry-run** before committing. The silent-on-main + emits-on-feature-branch behaviour is the single load-bearing invariant; if it regresses, the hook becomes noise on every session start and the user will disable it.
3. **Never put an in-hook `gh pr list` / API call.** Tempting to emit the exact PR number, but the hook would then need `gh` installed and authenticated in every environment (web, IDE, CLI fallback). Let the model do the lookup via MCP on turn 1.
4. **Never write files outside `.claude/hooks/` and `.claude/settings.json`** as part of this skill. Commit scope stays minimal and non-architectural.

## Examples

**User:** "install the auto-subscribe-pr hook in this repo"

**Agent behaviour:**
Reads `.claude/settings.json` — finds an existing SessionStart entry running `session-start.sh`. Writes `.claude/hooks/auto-subscribe-pr.sh` and `chmod +x`. Merges the new command as a **sibling inner hook** inside the existing outer entry (not a second outer entry — the judgment call in Step 3). Runs the three local validations, reports PASS for all. Flags that `.claude/` is typically non-architectural so no ADR is needed, then asks the user whether to stage + commit or leave the edits in the working tree.

**User:** "I already called mcp__github__subscribe_pr_activity for PR #20 — isn't that enough?"

**Agent behaviour:**
Explains the non-obvious delta: the MCP call is **session-scoped** and drops on `/compact`, `/clear`, or session restart. This skill installs the persistent version that re-subscribes on every SessionStart — not a replacement for the one-time call but a way to make it automatic going forward. Asks whether to proceed with the install.
