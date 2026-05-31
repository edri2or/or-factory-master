# Changelog fragment — mcp-project-quota (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md`. Folded into `CHANGELOG.md` with a running Stage number by
> `scripts/compile-changelog.sh`.

## feat: MCP project-quota status tool — autonomous "how many free / when do deleted projects free up"

| Type | Summary |
|---|---|
| feat | **Stage 1 — core logic.** New read-only project-quota helpers in `services/mcp-server/src/gcp-client.ts` so the agent can answer "how many GCP projects are free, and when do deleted ones free up?" autonomously (today the only path is the `list-recoverable-projects.yml` workflow, which needs a manual operator click). `getProjectQuotaStatus()` aggregates the ACTIVE count (reusing the existing `listAllProjects()` v1 call) with `listSoftDeletedProjects()` — a new Cloud Resource Manager **v3** `projects:search?query=state:DELETE_REQUESTED` call (paginated) that exposes the `deleteTime` field the v1 list lacks. A pure, unit-tested helper `computeFreeUpDate(deleteTime, now)` derives the estimated quota free-up date (`deleteTime + ~30d` GCP retention) and whole days remaining (clamped ≥ 0; nulls for missing/unparseable input). No new IAM and no workflow change — the MCP server runs as the broker SA that `list-recoverable-projects.yml` already uses. New `test/project-quota.test.mjs` (node:test, 5 cases) covers the pure helper without network/credentials. `npm test` green (31/31). Honest limitation captured in the tool's `note`: counts reflect only what the broker SA can enumerate, the free-up date is an estimate, and the org-wide absolute project-creation cap is not exposed via API. |
