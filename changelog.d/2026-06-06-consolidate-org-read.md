# Changelog fragment — consolidate-to-master (2026-06-06)

> Per-development changelog fragment (date + slug ⇒ collision-free). Folded into the numbered
> `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## feat: consolidate-to-master — fold org-reader's org-wide READ tools into the one MCP (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of consolidating the three session-connected systems into `or-factory-master` alone. Folds the unique capability of the retired `org-reader` MCP (edri2or/factory, `services/org-reader-mcp`, the Railway box `mcp-server-production-882d`) — reading issues / PRs / code / commits / Actions variables across **every** edri2or repo — into this repo's existing single MCP server, rather than taking over the Railway service. New `services/mcp-server/src/org-read-tools.ts` registers **20 net-new** read-only tools (`list_repos`, `get_repo`, `list/get_pull_requests`, `list_pull_request_files`, `list/get_issues`, `list_issue_comments`, `list_commits`, `get_file_contents`, `search_code`, `search_issues`, `get_workflow`, `list/get_repo_variable`, `list/get_org_variable`, and the 3 permission-gated Phase-4 tools `list_repo_secrets_names`/`list_branch_protection_rules`/`list_github_environments`), deliberately NOT duplicating the 8 Actions-run tools already in `tools.ts`. `github-client.ts` gains `orgGet`/`searchGet`/`fetchFileContents`/`repoGet`/`ORG`, all reusing the existing org-wide broker `installationToken()` — so no new GitHub App, no new credentials, no new mounted secret. Registered via `registerOrgReadTools(server)` in `index.ts` alongside `registerTools`. The 3 Phase-4 tools self-return a clean `permission_denied` hint until the broker App is granted `secrets:read` + `administration:read`; the other 17 work immediately. `tsc` compiles clean. Verified live after deploy via `verify_mcp_server` + a cross-repo `list_repos`/`get_file_contents` call. |
