# Changelog fragment — repo-delete-gate (2026-06-07)

> Per-development changelog fragment. Folded into `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## feat: repo-delete-gate — permanent, Telegram-gated repo deletion (AI proposes, Or approves)

| Type | Summary |
|---|---|
| feat | A standing capability to delete edri2or repos that executes ONLY after Or's Telegram ✅ — the agent can propose, never delete. New `services/mcp-server/src/repo-approval.ts` (twin of `gcp-approval.ts`): `/repo-delete-register` sends a ✅/❌ card listing the repos (sentinel-wrapped, stateless recovery); `rmok:`/`rmno:` callbacks routed in the unified `/telegram-webhook`; on ✅ it deletes each via new `github-client.deleteRepoAsBroker` (broker App `administration:write`, hard-refuses `or-factory-master` + the ALWAYS_KEEP set). Deletion lives ONLY in the verified callback — there is no dispatchable execute path, so it can't run without the tap. New `.github/workflows/propose-repo-delete.yml` (proposal only — reads `mcp-server-admin-secret`, POSTs the card; cannot delete). New skill `.claude/commands/delete-repos.md` (factory-only) + `monitoring/registry-exempt.txt` entry. Reuses the existing bot + `OIL_APPROVER_TELEGRAM_ALLOWLIST` — no new token/permission. `test/repo-approval.test.mjs` (6 cases incl. the protected-repo drop). `tsc` + `node --test` + yamllint clean. |
