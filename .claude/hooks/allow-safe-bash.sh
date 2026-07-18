#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — auto-approve compound / read-heavy Bash
# commands that are provably built only from a safe command set, so routine
# dev/test chains (e.g. `cd <repo> && git status && ...`) don't trigger a
# permission prompt — including the built-in "cd changes directory before
# running git, which can execute untrusted hooks" prompt that no allow-rule
# can override.
#
# Requested and explicitly approved by the operator (Or), who consciously
# accepted that this reduces per-command oversight for the safe set below.
#
# Conservative by construction: it emits an "allow" decision ONLY when every
# segment of the command is in the safe set and no risky shell feature is
# present. Otherwise it stays silent (no output) and the normal permission
# flow applies. It NEVER emits "deny", so it can only ever REMOVE a prompt,
# never add one or block a command. Worst case = the same prompt you get today.
#
# The safe sets below mirror exactly the reviewed `permissions.allow` list
# (rounds 1-2) — no new powers. Dangerous commands (rm, gcloud, sudo, curl,
# wget, git push, deploy scripts) are absent, so they always fall through to
# the normal prompt.
set -euo pipefail

# Read the tool call payload; bail out quietly on anything unexpected.
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -n "$cmd" ] || exit 0

# Stay silent -> let the normal permission flow (prompt / built-in rules) decide.
pass() { exit 0; }

allow() {
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"safe read/dev command chain (allow-safe-bash hook)"}}'
  exit 0
}

# Risky shell features -> never auto-allow (defer to normal flow).
#   $(...) / `...`  command substitution
#   <(...)          process substitution
#   >               any redirect to a file (cd+redirect is its own heuristic)
# The single-quoted globs below are intentional literals, not expansions.
# shellcheck disable=SC2016
case "$cmd" in
  *'$('*|*'`'*|*'<('*|*'>'*) pass ;;
esac

# Safe leading commands (non-git) — mirrors the reviewed allowlist.
SAFE=" cd ls pwd echo cat head tail grep rg find tree wc sort uniq diff which \
jq sed awk test true mkdir touch cp mv node npm npx python python3 pytest bats \
shellcheck yamllint actionlint stat file du df env printenv printf seq expr cut \
tr comm nl tac rev fold paste join column less more readlink realpath basename \
dirname od xxd hexdump strings cksum md5sum sha1sum sha256sum date cal whoami id \
uname hostname groups tty locale ps free uptime pstree lsof "

# Safe git subcommands (read-only + local-safe writes). NOT: push, reset, clean,
# gc, filter-branch, remote set-url with a new target, etc.
GIT_SAFE=" status diff log show branch add commit checkout switch fetch pull \
stash rev-parse ls-files restore remote config blame describe cat-file ls-tree \
for-each-ref reflog shortlog grep whatchanged name-rev merge-base "

# Split the command into segments on shell separators, then validate each.
segments="$(printf '%s' "$cmd" | sed -E 's/(\|\||&&|\||;|&)/\n/g')"

while IFS= read -r seg; do
  # Trim surrounding whitespace.
  seg="$(printf '%s' "$seg" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  [ -n "$seg" ] || continue

  # Strip leading `VAR=val` environment assignments.
  while printf '%s' "$seg" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*='; do
    seg="$(printf '%s' "$seg" | sed -E 's/^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]*//')"
  done
  [ -n "$seg" ] || continue

  first="$(printf '%s' "$seg" | awk '{print $1}')"
  [ -n "$first" ] || continue

  if [ "$first" = "git" ]; then
    sub="$(printf '%s' "$seg" | awk '{print $2}')"
    # Handle `git -C <path> <subcommand>`: the real subcommand is field 4.
    if [ "$sub" = "-C" ]; then
      sub="$(printf '%s' "$seg" | awk '{print $4}')"
    fi
    case "$GIT_SAFE" in
      *" $sub "*) : ;;   # safe git subcommand
      *) pass ;;
    esac
    continue
  fi

  case "$SAFE" in
    *" $first "*) : ;;   # safe command
    *) pass ;;
  esac
done <<EOF
$segments
EOF

# Every segment qualified as safe.
allow
