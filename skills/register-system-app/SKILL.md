# Skill: register-system-app

Register a per-system GitHub App, narrowly scoped to a single system repo. Runs after `build-system` succeeds and before the operator dispatches `deploy-railway-cloudflare.yml` in the system repo.

## Pre-flight

Before doing anything:
1. Confirm with the user the system is already provisioned. **If it was provisioned in reuse mode (a test system), pass the same `shared_gcp_project=factory-test-25`** here too — the App's SM secrets + `deploy-sa`/`runtime-sa` grants then land in the shared project, while the repo, App name, App scope, and `APP_*` repo vars stay `system_name`. (See CLAUDE.md → "Test systems vs. real systems".)
2. Get `system_name`. Validate the same regex as `build-system`:
   - `^[a-z][a-z0-9-]{4,28}[a-z0-9]$`, 6–30 chars.
3. Read-only existence + collision checks:
   - `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__verify_gcp_system` on `system_name` — project, SAs, WIF must all be present.
   - `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__verify_github_system` on `system_name` — repo and branch protection must exist.
   - `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__list_system_secrets` on `system_name` — if all 3 of `github-app-id`, `github-app-private-key`, `github-app-installation-id` exist with non-zero versions, abort: "App already registered for this system."
4. Show the user a summary and **ask for explicit go-ahead**:
   - "I'm about to register App `<system_name>-app` with narrow permissions (`contents`, `metadata`, `actions`, `workflows`, `secrets`), scoped to only `edri2or/<system_name>`. OK to proceed?"

## Dispatch

1. Confirm with the user, then dispatch via the `dispatch_workflow` MCP tool: `workflow_id=register-system-app.yml`, `ref=main`, with:
   - **Normal:** `inputs={system_name:<name>}`.
   - **Reuse (test):** `inputs={system_name:<name>, shared_gcp_project:factory-test-25}`.
   It triggers the run as the org-wide broker App and returns the `run_id`.
2. **The 2 browser clicks are still the operator's** — dispatching only *starts* the run; the operator must complete GitHub App creation within ~10 min (the run sends the receiver URL via Telegram and polls for the credentials):
   - Click 1: GitHub shows "Create GitHub App" — click it.
   - Click 2: GitHub shows the install page — **choose "Only select repositories" and tick `edri2or/<system_name>`**. Do NOT pick "All repositories" — the workflow will fail loudly if you do.

## Watch

While the run is in flight:
1. Get the run ID — `mcp__github__list_workflow_runs` filtered to this workflow.
2. Poll `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__get_workflow_run` every ~30s.
3. If the run fails, read the failed step's log via `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__read_github_actions_run_logs`. Report what failed, why, and a proposed fix. Do not re-dispatch automatically.
4. The most common failure mode is the operator picking "All repositories" on click 2 — the "Verify install scope is narrow" step fails fast with recovery instructions in the Step Summary.

## Verify

After the run completes successfully:
1. `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__list_system_secrets` on `system_name` — confirm `github-app-id`, `github-app-private-key`, `github-app-installation-id` are all present with `enabledVersionCount >= 1`.
2. `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__verify_github_system` on `system_name` — confirm `APP_ID` and `APP_INSTALLATION_ID` repo variables exist on `edri2or/<system_name>`.
3. Read the run's Step Summary — confirm the "Verify install scope is narrow" step recorded `PASS: install scope is narrow (1 repo: edri2or/<system_name>)`.
4. Confirm Cloud Run teardown: `gcloud run services list --project=or-factory-master-control --region=me-west1` shows no `system-app-receiver-<system_name>` service.
5. Report the summary to the user.

## What this skill does NOT do

- Does not dispatch `deploy-railway-cloudflare.yml`. That's the next handoff, in the system repo.
- Does not re-register on failure without explicit user approval.
- Does not write evidence or manifest files.
- Does not open or close GitHub Issues.

## Handoff to the user (post-registration)

After `register-system-app.yml` succeeds, tell the user:

1. App `<system_name>-app` is registered, narrowly scoped to `edri2or/<system_name>`, credentials in the system's SM.
2. Repo variables `APP_ID` and `APP_INSTALLATION_ID` are set on `edri2or/<system_name>` so the system's own workflows can reach them via `${{ vars.APP_ID }}` and `${{ vars.APP_INSTALLATION_ID }}`.
3. **Next step**: dispatch `deploy-railway-cloudflare.yml` via the `dispatch_workflow` MCP tool (`repo=<system_name>`, `workflow_id=deploy-railway-cloudflare.yml`, `ref=main`).

## Abort conditions

- Validation fails on `system_name`.
- GCP project or GitHub repo does not exist (system not provisioned).
- All 3 `github-app-*` secrets already exist (App already registered).
- User does not give explicit go-ahead.
- Run fails — stop, report, ask.
- Install-scope check fails (operator picked "All repositories" on click 2) — instruct the user to uninstall the App, delete the SM secrets, and re-dispatch with the right radio.
