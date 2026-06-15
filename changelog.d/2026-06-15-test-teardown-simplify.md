# Changelog fragment — test-teardown-simplify (2026-06-15)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## refactor: test-system teardown now DELETES the repo instead of archiving it

| Type | Summary |
|---|---|
| refactor | `decommission-test-system.yml` now **deletes** a torn-down TEST system's GitHub repo instead of archiving it. Archived test repos only piled up as dead clutter in the `edri2or` org. The former "Archive GitHub repo" step (`PATCH {archived:true}`, expecting HTTP 200) becomes "Delete GitHub repo" — `DELETE /repos/edri2or/<system_name>` expecting HTTP **204** — using the same broker App `administration:write` right it already used to archive (the capability already exists: see `deleteRepoAsBroker()` in `services/mcp-server/src/github-client.ts`). The idempotent `GET` existence probe is kept (404 → skip), the now-meaningless "already archived" branch is dropped, and a defense-in-depth `case` hard-refuses deleting `or-factory-master` / control projects / `factory-test-25` on the destructive step itself (mirroring `ALWAYS_KEEP_REPOS`), since a repo delete is irreversible (no GitHub recycle bin). The existing test-only acceptance gate (test-prefixed name OR reuse-proof via the repo's `GCP_PROJECT_ID == shared test project`) is unchanged, as are the Railway / Cloudflare DNS / OpenRouter-key / Linear-webhook steps. Docs follow: `skills/decommission-test-system/SKILL.md` (intro, "What it does", the go-ahead prompt, and Watch+Verify — which now confirms the delete independently via the org-wide `get_repo` MCP tool returning 404) and the two `CLAUDE.md` table rows. The real-system `decommission-system.yml` is untouched and still archives + soft-deletes under written approval. Test-only; no factory runtime or template touched. |
