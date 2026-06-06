# Changelog fragment — consolidate-to-master (2026-06-06)

> Per-development changelog fragment (date + slug ⇒ collision-free). Folded into the numbered
> `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## feat: consolidate-to-master — fold org-reader's org-wide READ tools into the one MCP (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of consolidating the three session-connected systems into `or-factory-master` alone. Folds the unique capability of the retired `org-reader` MCP (edri2or/factory, `services/org-reader-mcp`, the Railway box `mcp-server-production-882d`) — reading issues / PRs / code / commits / Actions variables across **every** edri2or repo — into this repo's existing single MCP server, rather than taking over the Railway service. New `services/mcp-server/src/org-read-tools.ts` registers **20 net-new** read-only tools (`list_repos`, `get_repo`, `list/get_pull_requests`, `list_pull_request_files`, `list/get_issues`, `list_issue_comments`, `list_commits`, `get_file_contents`, `search_code`, `search_issues`, `get_workflow`, `list/get_repo_variable`, `list/get_org_variable`, and the 3 permission-gated Phase-4 tools `list_repo_secrets_names`/`list_branch_protection_rules`/`list_github_environments`), deliberately NOT duplicating the 8 Actions-run tools already in `tools.ts`. `github-client.ts` gains `orgGet`/`searchGet`/`fetchFileContents`/`repoGet`/`ORG`, all reusing the existing org-wide broker `installationToken()` — so no new GitHub App, no new credentials, no new mounted secret. Registered via `registerOrgReadTools(server)` in `index.ts` alongside `registerTools`. The 3 Phase-4 tools self-return a clean `permission_denied` hint until the broker App is granted `secrets:read` + `administration:read`; the other 17 work immediately. `tsc` compiles clean. Verified live after deploy via `verify_mcp_server` + a cross-repo `list_repos`/`get_file_contents` call. |

## feat: consolidate-to-master — port the GCP risk-tier classifier (Stage 2)

| Type | Summary |
|---|---|
| feat | Stage 2 — ports gcp-hands' green/yellow/red GCP risk classifier into or-factory-master as pure logic (no GCP, no execution yet). New `scripts/gcp-classify.sh` (token-wise matcher, fail-safe RED default), `policy/gcp-risk-tiers.yml` (the proven minimal tier set: green = reads, yellow = versions-add/run-deploy/services-enable, red = everything else incl. create/delete/IAM), `tests/gcp-classify-fixtures.yml` + `scripts/test-gcp-classify.sh` (9-row self-test), wired into `pipeline-tests.yml` ("shellcheck + yamllint" job) as a new "GCP classifier self-test" step. Self-test 9/9 green; `shellcheck --severity=error` + `yamllint` clean. Stage 3 wires this to a gcp-action workflow + the existing Telegram approval bridge. |

## feat: consolidate-to-master — GCP risk-gate workflow + RED Telegram approval bridge (Stage 3)

| Type | Summary |
|---|---|
| feat | Stage 3 — the GCP "head-guard" capability of gcp-hands, the simplest-safe way (owner's choice): green/yellow run autonomously, RED goes through the **existing** Telegram ✅ approval bridge rather than a new approval system. New `.github/workflows/gcp-action.yml` (two phases): `propose` classifies the command (Stage 2 classifier) — green/yellow run immediately as the broker SA via the existing WIF, RED is NOT run but POSTed to the MCP's new `/gcp-approval-register`; `execute` (dispatched by the MCP only after Or's ✅) runs the approved command. New `services/mcp-server/src/gcp-approval.ts` mirrors `oil-approval.ts`/`system-request.ts`: sends a ✅/❌ card (`gcpok:`/`gcpno:` callback namespace), reuses the **same** `OIL_APPROVER_TELEGRAM_ALLOWLIST`, `sendTelegramKeyboard`, `answerCallbackQuery`, `editTelegramMessage`; state-free — the command is recovered from the card's own message text (sentinel-wrapped) on ✅, so no Linear/DB/issue state. `index.ts` adds a `/gcp-approval-register` admin-gated endpoint and routes `gcpok:`/`gcpno:` in the unified `/telegram-webhook` (existing `oilapprove:`/`oilreject:`/`sysreq:`/`sysno:`/chat branches untouched). Command charset is metacharacter-free in both the bridge and the workflow (split to argv, no shell re-parse — no injection). JIT/PAM deferred (owner chose simplest): the broker SA's existing standing roles on `or-factory-master-control` run red ops; accepted tradeoff documented in the devplan. `tsc` + `yamllint` + `shellcheck` clean. |
