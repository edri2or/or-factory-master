## feat: Stage 83 — OIL auto-fix loop extended to system repositories

| Type | Summary |
|---|---|
| feat | The OIL auto-fix loop now fixes a bug diagnosed as an `actionable-bug` in a **system's own repo**, not only `or-factory-master` (the factory stays the orchestrator — both workflows still run in the factory; only the fix target moves). `oil-autofix-investigate.yml` gains a "prepare target working tree" step that shallow-clones `edri2or/<system>` into `./target` (broker token scoped to that repo, `contents:read`, one-shot auth header — no token persisted), so the read-only investigator, the write-mode fixer, and the deterministic gate all act on the system's code; the central `!= or-factory-master` brake in `decide` is replaced by a factory-OR-valid-system check, and the branch/CHANGELOG/push all operate on the target tree (`git -C`). `scripts/oil-autofix-validate.sh` runs unchanged with `cwd=./target` (the candidate is diffed in the system tree); its only change is a new `OIL_FIX_META` override so `fix-meta.json` can stay at the workspace root. The DRAFT PR runs through the system's own 4 required CI checks. |

## feat: Stage 83 — per-merge repo-scoped approver + repo-aware Telegram bridge

| Type | Summary |
|---|---|
| feat | The Telegram approval bridge carries the target repo end-to-end: `callback_data` is now `oilapprove:<repo>:<pr>` / `oilreject:<repo>:<pr>` (`parseCallbackData` decodes the repo with a backward-compatible fallback to `or-factory-master` for the legacy two-segment form; a malformed repo segment is rejected), `registerApproval` takes a `repo` and shows it to Or, and `handleTelegramCallback` merges/closes in the carried repo. `/oil-approval-register` accepts a `repo` field; `oil-autofix-investigate.yml` sends `repo=$TARGET_REPO`. `github-client.ts` adds `repoScopedToken` so `mergePullRequestAsApprover`/`closePullRequestAsApprover` mint an installation token **down-scoped to the one target repo** + the merge permission subset at merge time (org-wide install, App-per-repo-equivalent isolation), and both refuse any owner≠`edri2or` / empty-repo target. `register-oil-approver-app.yml` now installs the approver **org-wide** (replacing the single-repo scope check with an org-wide + covers-the-factory assertion), keeping its permissions exactly `contents:write`+`pull_requests:write`+`metadata:read`. |

## feat: Stage 83 — cross-repo post-merge verification

| Type | Summary |
|---|---|
| feat | `oil-autofix-verify.yml` gains a `repo` input: for a **system** merge the MCP dispatches the verify workflow on the factory right after a confirmed synchronous merge (`handleTelegramCallback` → `dispatchWorkflow`), and the workflow clones the system's `main` with a repo-scoped `contents:read` token into `./target`, recovers the OIL id + reproducer from the system's merge commit, and re-runs the reproducer there via `scripts/oil-verify.sh` (still scrubbed `env -i`, after revoking cloud creds). The factory's own merges keep using `push: main` and remain token-free. Known v1 limitation: a system PR approved while its CI is still running (async auto-merge) isn't auto-verified — documented; a system-side merge notifier is deferred. |

## docs: Stage 83 — document the system flow + template-vs-live policy

| Type | Summary |
|---|---|
| docs | `docs/oil-autofix.md`: rewrote the "v1 limitations" (dropped "fixes only `or-factory-master`"), added a "Fixing a system's own code" section, the template-vs-live policy (root cause in factory template → fix the system's live copy only + flag a back-port; no auto back-port in v1), per-merge repo scoping in the safety model, and the async-auto-merge limitation. `CLAUDE.md`: updated the `oil-autofix-investigate.yml` / `oil-autofix-verify.yml` Workflows-table rows. The fixer prompt also flags template-vs-live in the PR body + the Linear comment. |
