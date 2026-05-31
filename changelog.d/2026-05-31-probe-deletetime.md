# Changelog fragment — probe-deletetime (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md`. Folded into `CHANGELOG.md` with a running Stage number by
> `scripts/compile-changelog.sh`.

## chore: one-off read-only probe to diagnose empty project deleteTime

| Type | Summary |
|---|---|
| chore | New `.github/workflows/probe-project-deletetime.yml` — a ONE-OFF, READ-ONLY diagnostic that explains why `gcp_project_quota_status` returns a null `deleteTime` (and therefore null `freeUpDate`/`daysRemaining`) for every soft-deleted project. For two probe projects (`factory-test-23`, the newest soft-deleted; `v2-test-1`, the oldest) it compares three timestamp sources side by side: Cloud Resource Manager v3 `projects.get` (authoritative per-resource field), v3 `projects:search` (what the MCP tool uses today), and the `DeleteProject` Admin Activity audit log at both Systems-folder and org scope (version-independent ground truth). Touches nothing — no create/delete/undelete/write. Authenticates as the broker SA via WIF (SHA-pinned `auth@v3`), so it is gated to `main` and self-runs once on merge via a push path-filter on its own file (no operator click). The result tells us whether a per-project v3 `get` fallback suffices or whether the quota tool must read the audit log to surface a real free-up date. Workflow is expected to be removed once the quota-tool fix lands. |
