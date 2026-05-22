# Skill: build-system

Build a new system from scratch — GCP project + GitHub repo + SAs + WIF + secrets.

## Pre-flight

Before doing anything:
1. Confirm with the user that this is a real provisioning request, not a test.
2. Get `system_name` from the user. Validate locally:
   - Lowercase ASCII letters, digits, hyphens only.
   - 6–30 characters.
   - Starts with a letter, ends with `[a-z0-9]`.
   - Regex: `^[a-z][a-z0-9-]{4,28}[a-z0-9]$`
   - If the user proposed an uppercase or out-of-range name, suggest a normalized version and ask before continuing.

3. Verify nothing collides:
   - GCP project: call `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__list_gcp_projects` and confirm `<system_name>` is not present.
   - GitHub repo: call `mcp__github__get_file_contents` on `edri2or/<system_name>` — 404 means available; 200 means collision (abort).

4. Show the user a summary of what's about to happen and **ask for explicit go-ahead**:
   - "I'm about to create GCP project `<name>`, GitHub repo `edri2or/<name>`, and copy 16 secrets. OK to proceed?"

## Dispatch

1. Open the workflow run via GitHub UI URL: `https://github.com/edri2or/or-factory-master/actions/workflows/provision-system.yml`.
2. The user dispatches `provision-system.yml` with input `system_name=<name>` on branch `main`.
3. **Do not dispatch via API yourself.** This is an explicit-action step — the user is the one who clicks the button. You watch.

## Watch

While the run is in flight:
1. Get the run ID — `mcp__github__list_pull_requests` or list_workflow_runs filtered to this workflow.
2. Poll `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__get_workflow_run` every ~30s, OR ask the user to share a URL once finished.
3. If the run fails, read the failed step's log via `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__read_github_actions_run_logs`. Report what failed, why, and a proposed fix. Do not re-dispatch automatically.

## Verify

After the run completes successfully:
1. `verify_gcp_system` — confirm project, SAs, WIF, secrets.
2. `verify_github_system` — confirm repo exists, main is protected, variables set.
3. Read the run's job summary for the table of resources created.
4. Report the summary to the user.

## What this skill does NOT do

- Does not deploy Railway or Cloudflare. That's a separate step the user requests next.
- Does not write a manifest file or evidence record.
- Does not open or close GitHub Issues.
- Does not re-run on failure without explicit user approval.

## Handoff to the user (post-provision)

After `provision-system.yml` succeeds, point the user at:

1. Dispatch `deploy-railway-cloudflare.yml` in `edri2or/<system_name>` (Actions tab → manual `workflow_dispatch` on `main`). The workflow auto-runs Postgres + n8n + Cloudflare + LE cert + owner-setup.
2. The URL is **`https://n8n-<system_name>.or-infra.com`** (single-level subdomain — multi-level doesn't get an LE cert through Railway's customDomain).
3. Owner credentials:
   - email: `admin@<system_name>.or-infra.com`
   - password: `gcloud secrets versions access latest --secret=n8n-owner-password --project=<system_name>`
4. If the deploy hangs on Postgres `DEPLOYING` with zero container logs, that's the Railway account-throttle gotcha documented in `CLAUDE.md` (delete stale Railway projects via `projectDelete` and re-dispatch — it's not a code bug).

## Abort conditions

- Validation fails on `system_name`.
- Project or repo already exists.
- User does not give explicit go-ahead.
- Run fails — stop, report, ask.
