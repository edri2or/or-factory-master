# CLAUDE.md — or-factory-master operating rules

This file is the entry point for every Claude session in this repo. Read it first.

## The one rule

**Build manually. See every step. Continue only after verifying.**

The previous factory (`edri2or/factory`) automated everything end-to-end. Failures surfaced minutes or hours after the fact through GitHub Issues; fixes landed in the next provisioning run. This repo throws that pattern out. The agent dispatches one workflow, watches it run, verifies the outputs, and then asks the user before doing anything else.

## How to work

1. **Match the user's request to a skill.** The skills below describe the supported flows.
2. **Pre-flight checks first.** Before any dispatch, verify the inputs and the absence/presence of collisions via read-only MCP tools.
3. **Dispatch via the `dispatch_workflow` MCP tool.** The agent triggers the allowlisted lifecycle workflows itself (`provision-system.yml`, `register-system-app.yml`, `deploy-railway-cloudflare.yml`) — no operator button-click, no env-var PAT. Confirm cost/scope with the user before a fresh provision/deploy unless they've opted into autonomy. `decommission-system.yml` is NOT dispatchable by the tool (destructive — written approval required).
4. **Watch the run.** Poll the workflow run. Read failed step logs directly. Report what failed.
5. **Verify outputs.** After success, call the relevant `verify_*` MCP tool to confirm the real state matches the expected state.
6. **Stop at the boundary.** Each skill ends at a clear handoff point. Ask the user what's next; don't chain.

## Never

- Touch the old factory repo (`edri2or/factory`) or its GCP project (`factory-control-9piybr`).
- Use the old broker SA, WIF provider, or App credentials.
- Auto-chain stages without verifying: dispatch the next workflow only after verifying the prior run's outputs. Never dispatch `decommission-system.yml` from the agent (it's off the `dispatch_workflow` allowlist by design).
- Open GitHub Issues to report success/failure — this is interactive, not async.
- Write `factory/manifests/`, `factory/evidence/`, or session-summary files.
- Bypass branch protection or skip CI checks.
- Print, log, or echo secret values.
- Create GCP SA keys. Auth is WIF only.

## Fixed values

| Resource | Value |
|---|---|
| GCP organization | `905978345393` (or-infra.com) |
| GCP control project | `or-factory-master-control` (number `140345952904`) |
| Systems folder | `folders/123180924297` |
| Region | `me-west1` |
| Billing account | `014D0F-AC8E0F-5A7EE7` |
| Broker SA | `factory-master-broker@or-factory-master-control.iam.gserviceaccount.com` |
| WIF provider | `projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| WIF CEL | `repository_owner_id=='259965754' && repository_id=='1245681889' && ref=='refs/heads/main'` |
| GitHub org | `edri2or` (id `259965754`) |
| GitHub App | `factory-master-broker` (installed org-wide, all repos) |
| App credentials | GCP SM secrets `factory-master-broker-app-{id,private-key,installation-id}` |

## Skills available

| Skill | Purpose |
|---|---|
| `build-system` | Provision a new system (GCP + GitHub + secrets). Single workflow, manual dispatch. |
| `register-system-app` | Register the per-system GitHub App after `build-system`. 2-click manual dispatch, scoped to one repo. |
| `decommission-system` | Tear down a system (archive repo, soft-delete project). Requires written approval. |
| `health-check` | Read-only status report of factory + all managed systems. |

## Workflows

| Workflow | Trigger | Action |
|---|---|---|
| `register-broker-app.yml` | One-shot, already used | Created the GitHub App. Don't re-run. |
| `provision-system.yml` | Manual `workflow_dispatch` | Builds GCP + GitHub for a new system. Pre-creates SM shells incl. `n8n-owner-email` and `n8n-owner-password`. |
| `register-system-app.yml` | Manual `workflow_dispatch` (after `provision-system.yml`, before deploy) | Registers a per-system GitHub App via Cloud Run receiver. Narrow permissions (`contents`, `metadata`, `actions`, `workflows`, `secrets`); operator picks "Only select repositories" on click 2, the workflow verifies scope. Writes `github-app-{id,private-key,installation-id}` to the system's SM and `APP_ID` / `APP_INSTALLATION_ID` repo vars on the system repo. Idempotent. |
| `templates/system/.github/workflows/deploy-railway-cloudflare.yml` | Manual `workflow_dispatch` in the *system* repo | Deploys n8n 1.121.0 on Railway (Postgres + persistent volume), creates Cloudflare CNAME + `_railway-verify` TXT (DNS-only), waits for Railway to issue the LE cert (retriggers via `customDomainDelete` + recreate if `verified=false`), then POSTs `/rest/owner/setup` so the URL lands on the n8n login screen. Pushed into every new system repo by `provision-system.yml`. Idempotent. |
| `changelog-check.yml` | `push: main` + `pull_request: main` | Fails any diff that changes `.sh` / `.json` / `.yml` / `.yaml` without updating `CHANGELOG.md`, and any `CHANGELOG.md` over 20 KB. |
| `decommission-test-projects.yml` | Manual `workflow_dispatch` | One-off cleanup of `factory-test-*` / `v2-test-*` GCP projects via the broker SA. Hard-guards against the control project. |
| `deploy-mcp-server.yml` | Manual `workflow_dispatch` | Builds + deploys the `factory-master-actions-mcp` Cloud Run service in `or-factory-master-control`. Creates a dedicated runtime SA, mints `mcp-server-{admin-secret,bearer-signing-key}` if missing, grants the runtime SA `secretAccessor` on the 9 mounted secrets + project-level read roles. Idempotent. After first deploy, operator updates the MCP server URL in Claude Code to the printed Region URL. |

The deploy workflow lives in each system's own repo and is dispatched there by the user after `provision-system.yml` succeeds. It is provisioned, not orchestrated, by the factory.

## Validation rules

`system_name` must satisfy: `^[a-z][a-z0-9-]{4,28}[a-z0-9]$` (6–30 chars total). The same string becomes the GCP project ID and the GitHub repo name.

## Propagation patterns

GCP IAM has *eventual consistency* between policy update and effective permissions. Any `gcloud` call against a resource that was just created (in the same workflow run) can fail with `PERMISSION_DENIED` or `does not exist` for up to ~60s, even though `get-iam-policy` or `describe` already shows the resource/binding.

If you add a new step that touches a fresh resource, wrap it in a retry. Three windows are known and handled:

| Window | Symptom | Where handled |
|---|---|---|
| SA → IAM policy member (~5-30s) | `add-iam-policy-binding` says SA "does not exist" | `Grant project-level IAM`, see `_bind` helper |
| role-grant → effective permission (~30-60s) | API call returns `PERMISSION_DENIED` for a role the principal visibly has | `Create system-level WIF pool and provider`, see `_wif_op` helper |
| SA → setIamPolicy on the SA resource (~30-60s) | `service-accounts add-iam-policy-binding` says permission denied | `Grant deploy-sa workloadIdentityUser binding` |
| Railway scheduler throttle (no clear timeout) | Postgres `serviceCreate` stuck in `DEPLOYING` indefinitely with **zero container logs** | Out-of-band: delete stale Railway projects via `projectDelete` GraphQL mutation. Confirmed today on factory-test-{16,17} after ~15 fresh projects in one workspace within a day; cleared by deleting 11 stale ones; factory-test-18 then deployed cleanly. Not handled in the workflow — surface as a "this isn't a code bug, free Railway quota" warning to the user. |

Pattern: retry only on the specific error class (`PERMISSION_DENIED`, `does not exist`); surface anything else immediately. 10×10s or 12×10s is typical. See `docs/bootstrap-record.md` for the history of each.

## Key files

| File | Purpose |
|---|---|
| `skills/*/SKILL.md` | Skill instructions — read the one that matches the task. |
| `.github/workflows/provision-system.yml` | The one provisioning workflow. |
| `templates/system/.github/workflows/deploy-railway-cloudflare.yml` | Scaffold workflow pushed into every new system repo. Edits here propagate only to systems provisioned after the edit. |
| `scripts/copy-generic-secrets.sh` | Copies the 16 generic secrets to a new system's SM. |
| `scripts/generate-app-token.sh` | Generates an App installation token from the private key. |
| `scripts/lib.sh` | Shared helpers sourced by check scripts (`get_code_files`). |
| `scripts/check-changelog-updated.sh` | CI guard: fails if code changed without a `CHANGELOG.md` entry. |
| `scripts/check-changelog-size.sh` | CI guard: fails if `CHANGELOG.md` exceeds 20 KB. |
| `src/bootstrap-receiver/` | Receiver code used once to register the App. Reference, not active. |

## MCP

The MCP server `5b6e937f-c064-4cfd-88c4-ef93df38fa87` provides read-only inspection tools (`verify_*_system`, `list_all_systems_inventory`, `inspect_*`, `tail_*_logs`, etc.) plus one WRITE tool — `dispatch_workflow`, which triggers the allowlisted lifecycle workflows (`provision-system.yml`, `register-system-app.yml`, `deploy-railway-cloudflare.yml`) on `or-factory-master` or any system repo via the org-wide broker App (`decommission-system.yml` is excluded by design). The GitHub MCP (`mcp__github__*`) is scoped to `edri2or/or-factory-master` only. Use the read tools to verify; `dispatch_workflow` is the only sanctioned cross-repo write (workflow_dispatch events only).

The MCP server's source lives in `services/mcp-server/` and is deployed to Cloud Run in `or-factory-master-control` via `deploy-mcp-server.yml`. Railway visibility tools (extended beyond the old factory's set):

| Tool | Returns |
|---|---|
| `inspect_railway_service` / `inspect_railway_service_direct` | latest deployment + serviceDomains **+ customDomains** with `verified`, `verificationDnsHost`, `verificationToken`, `certificateStatusDetailed`, `certificateErrorMessage`, `dnsRecords` |
| `list_railway_service_variables` | env-var NAMES (values redacted unless `reveal=true`) |
| `list_railway_service_volumes` | volume id, name, mountPath, sizeMB |
| `list_railway_deployments` | recent deployment history (id/status/createdAt) |
| `railway_graphql_read` | read-only passthrough — any `query { … }` document, mutations refused server-side. Forward-compatible escape hatch for any future Railway schema field. |

The forward path: deprecate the old factory's MCP service in `factory-control-9piybr` once the new one is verified.
