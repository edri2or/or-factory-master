## feat: enable repo `allow_auto_merge` for siblings + a one-shot flip workflow

| Type | Summary |
|---|---|
| feat | New `set-repo-automerge.yml` (manual `workflow_dispatch(repo)`) — turns ON a repo's `allow_auto_merge` setting via the broker App (`administration:write`, WIF-only, token scoped to the target repo). Reads the prior value into the run log, PATCHes it `true`, and verifies in-run. Mirrors `set-repo-visibility.yml`. This is what lets the operator's "Auto-merge when ready" toggle work: GitHub refuses to arm native auto-merge on a PR with `Auto merge is not allowed for this repository` unless the repo has `allow_auto_merge` on. `or-aios` got it at provision time; the lean `/new-system` path never set it, so `or-agents` (and the factory, if off) needed a flip. Idempotent — setting it when already on is a no-op. |
| fix | `protect-system-main.yml` now enables `allow_auto_merge:true` alongside `delete_branch_on_merge:true` in its single idempotent repo-settings PATCH, so every **future** `/new-system` sibling is hardened with auto-merge allowed and never hits this gap. `CLAUDE.md` updated (the `protect-system-main.yml` row + the utility-workflows list) to reflect both. |
