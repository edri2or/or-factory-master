# CLAUDE.md — or-factory-master operating rules

This file is the entry point for every Claude session in this repo. Read it first.

## The one rule

**Build manually. See every step. Continue only after verifying.**

The previous factory (`edri2or/factory`) automated everything end-to-end. Failures surfaced minutes or hours after the fact through GitHub Issues; fixes landed in the next provisioning run. This repo throws that pattern out. The agent dispatches one workflow, watches it run, verifies the outputs, and then asks the user before doing anything else.

## How to work

1. **Match the user's request to a skill.** The skills below describe the supported flows.
2. **Pre-flight checks first.** Before any dispatch, verify the inputs and the absence/presence of collisions via read-only MCP tools.
3. **Ask before dispatching.** The user clicks the dispatch button. The agent does not auto-dispatch workflows.
4. **Watch the run.** Poll the workflow run. Read failed step logs directly. Report what failed.
5. **Verify outputs.** After success, call the relevant `verify_*` MCP tool to confirm the real state matches the expected state.
6. **Stop at the boundary.** Each skill ends at a clear handoff point. Ask the user what's next; don't chain.

## Never

- Touch the old factory repo (`edri2or/factory`) or its GCP project (`factory-control-9piybr`).
- Use the old broker SA, WIF provider, or App credentials.
- Auto-dispatch a follow-up workflow from a finished workflow run.
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
| `decommission-system` | Tear down a system (archive repo, soft-delete project). Requires written approval. |
| `health-check` | Read-only status report of factory + all managed systems. |

## Workflows

| Workflow | Trigger | Action |
|---|---|---|
| `register-broker-app.yml` | One-shot, already used | Created the GitHub App. Don't re-run. |
| `provision-system.yml` | Manual `workflow_dispatch` | Builds GCP + GitHub for a new system. |

Railway + Cloudflare deployment is **not yet implemented** as a workflow. When required, it will be a separate workflow the user dispatches after `provision-system.yml` succeeds.

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

Pattern: retry only on the specific error class (`PERMISSION_DENIED`, `does not exist`); surface anything else immediately. 10×10s or 12×10s is typical. See `docs/bootstrap-record.md` for the history of each.

## Key files

| File | Purpose |
|---|---|
| `skills/*/SKILL.md` | Skill instructions — read the one that matches the task. |
| `.github/workflows/provision-system.yml` | The one provisioning workflow. |
| `scripts/copy-generic-secrets.sh` | Copies the 16 generic secrets to a new system's SM. |
| `scripts/generate-app-token.sh` | Generates an App installation token from the private key. |
| `src/bootstrap-receiver/` | Receiver code used once to register the App. Reference, not active. |

## MCP

The MCP server `5b6e937f-c064-4cfd-88c4-ef93df38fa87` provides read-only inspection tools (`verify_*_system`, `list_all_systems_inventory`, `inspect_*`, `tail_*_logs`, etc.). The GitHub MCP (`mcp__github__*`) is scoped to `edri2or/or-factory-master` only. Use these to verify; do not call any write tool against another repo from this session.
