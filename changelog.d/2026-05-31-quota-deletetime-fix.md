# Changelog fragment — quota-deletetime-fix (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md`. Folded into `CHANGELOG.md` with a running Stage number by
> `scripts/compile-changelog.sh`.

## fix: hydrate soft-deleted project deleteTime via v3 projects.get

| Type | Summary |
|---|---|
| fix | `gcp_project_quota_status` returned a null `deleteTime` (and therefore null `freeUpDate` / `daysRemaining`) for **every** soft-deleted project, so the agent couldn't tell Or *when* a deleted project's quota slot frees up. Root cause, proven empirically by the one-off `probe-project-deletetime.yml` (run on `factory-test-23` + `v2-test-1`): Cloud Resource Manager v3 `projects:search` returns a **reduced projection that omits `deleteTime`** (yields only `createTime`), while v3 `projects.get` on the same project **does** return `deleteTime`. The audit-log path was unnecessary (and the broker SA lacks `roles/logging.viewer` anyway). Fix: `listSoftDeletedProjects` in `services/mcp-server/src/gcp-client.ts` now enumerates DELETE_REQUESTED projects via `projects:search` as before, then **hydrates each project's `deleteTime` with a parallel per-project `projects.get`** (new best-effort `getProjectDeleteTimeV3` helper — a failed get just yields a null free-up date for that one project, never breaking the aggregate). No new IAM (same `resourcemanager.projects.get` the search already proves). The pure `computeFreeUpDate` helper and its 5 unit tests are unchanged; `npm test` green (31/31), `tsc` clean. Also removes the now-spent one-off `probe-project-deletetime.yml` diagnostic. **Requires redeploying the MCP server (`deploy-mcp-server.yml`) for the fix to take effect.** |
