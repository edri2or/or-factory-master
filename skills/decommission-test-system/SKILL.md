# Skill: decommission-test-system

Tear down a **reuse-mode TEST system's** per-test resources: delete its Railway
project, remove its Cloudflare DNS records, and **delete** its GitHub repo.
Narrow and test-only.

**User-triggered ONLY.** Dispatch this **only when the user explicitly asks to
delete/decommission a test system** — never as part of, or chained after,
provisioning a system. It is destructive, so **confirm with the user before
dispatching** (per "The one rule").

## What it does / does NOT touch

- Deletes: the Railway project named `<system_name>`, the Cloudflare records
  `n8n-<system_name>` (CNAME) + `_railway-verify.n8n-<system_name>` (TXT), and
  the GitHub repo `edri2or/<system_name>` (a hard, **irreversible** delete — no
  archive, no recycle bin).
- Does **NOT** touch: any GCP project or Secret Manager (in reuse mode the
  shared project's secrets are wiped + reseeded by the next provision), the
  shared WIF/`test_pool`, or the per-system GitHub App (org-admin only —
  tell the user to delete it manually if they want it gone).

## Pre-flight

1. Confirm with the user this is a **deliberate teardown** of a **test** system, and get `system_name`. Validate it matches a test pattern: `^(factory-test-|v2-test-|or-test-)[a-z0-9-]…[a-z0-9]$`. Refuse `factory-test-25` (shared backend) and any control project — the workflow also hard-refuses these.
2. Reuse mode: if the system was provisioned in reuse mode, get the shared backend project (normally `factory-test-25`) — its SM holds the system's `railway-api-token` / `cloudflare-*` creds. Pass it as `shared_gcp_project`.
3. Resolve the Railway project id: call `list_railway_projects` and find the project whose **name == `system_name`**; note its `id`. Pass it as `railway_project_id` (the workflow re-verifies name == system_name before deleting, so a wrong id can't nuke another project). If no project of that name exists, it may already be gone — note that and proceed (the workflow skips Railway).
4. Show the user a summary and **ask for explicit go-ahead**: "I'm about to delete the Railway project + DNS for `<system_name>` and **permanently delete** the repo `edri2or/<system_name>` (irreversible — no archive). GCP/SM untouched. OK?"

## Dispatch

Confirm, then dispatch via the `dispatch_workflow` MCP tool: `workflow_id=decommission-test-system.yml`, `ref=main`, `inputs={system_name:<name>, shared_gcp_project:<shared or omitted>, railway_project_id:<id or omitted>}`. It runs as the org-wide broker App and returns the `run_id`.

> Note: this requires the MCP server to have been redeployed at least once with `decommission-test-system.yml` on its dispatch allowlist (`deploy-mcp-server.yml`, operator-run). If `dispatch_workflow` returns `workflow_not_allowlisted`, the redeploy hasn't happened yet — ask the operator to run `deploy-mcp-server.yml` once.

## Watch + Verify

1. Poll `get_workflow_run` until complete; on failure read the failed step via `read_github_actions_run_logs`.
2. Independently confirm: `list_railway_projects` no longer shows a project named `<system_name>`, and the org-wide `get_repo` MCP tool now returns **404 / not found** for `edri2or/<system_name>` (the repo is gone, not merely archived).
3. The DNS-deletion result comes from the run's own step summary/logs (the Cloudflare read token is a placeholder, so the agent can't independently re-read those — trust the run's PASS lines).
4. Report what was removed.

## Abort conditions

- `system_name` is not a test pattern, or is `factory-test-25` / a control project.
- User does not give explicit go-ahead.
- The workflow's name-verification step fails (the Railway id's project name ≠ `system_name`) — stop and re-resolve the id; do not retry blindly.

## Does NOT

- Soft-delete a GCP project (that's `decommission-system.yml` for real systems — not agent-dispatchable, written approval).
- Run automatically after provision/deploy. Teardown is always a separate, explicit user request.
