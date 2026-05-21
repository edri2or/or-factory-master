# Bootstrap record

This file records how `or-factory-master` was bootstrapped end-to-end. It is operational history — read it once when onboarding, then move on. The live source of truth for state is the running infrastructure itself, observed via the read-only inspection MCP (`5b6e937f-*`).

## Stages

The bootstrap had 6 stages, defined upfront and worked through in order. Stages 1-4 set up the control plane; stages 5-6 added the working content and proved it end-to-end.

| Stage | What | When | Notes |
|---|---|---|---|
| 1 | GCP control project, billing link, org policy override (`iam.allowedPolicyMemberDomains` → `allowAll`), Cloud Shell env | done | Manual; documented in `docs/external-state.md`. |
| 2 | Broker SA `factory-master-broker`, WIF pool `github-pool` + provider `github-provider` on control project, IAM grants on folder | done | Manual; pinned to `repository_id=1245681889` and `ref=refs/heads/main`. |
| 3 | 16 generic secrets copied from old factory to control SM | done | One-time copy. |
| 4 | GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, 3 App credentials stored in SM | done | App ID 3800903, install ID 134450329. |
| 5 | Repo content: `CLAUDE.md`, 3 skills, `provision-system.yml`, helper scripts | PR #1 | This is what an agent reads first. |
| 6 | First end-to-end provision run | PRs #2-#5 + `v2-test-6` | All 15 workflow steps succeeded with no manual intervention on the final run. |
| 7 | Deploy plane: `templates/system/.github/workflows/deploy-railway-cloudflare.yml` + push step in `provision-system.yml` | PR #7 | Idempotent Railway (project + Postgres + n8n + volume) + Cloudflare CNAME. n8n encryption key generated per-system on first deploy. |

## What went wrong on the way to a clean run

`provision-system.yml` exposed four hidden gaps that the original design didn't anticipate. Each was fixed in one tight PR. The pattern in all four: GCP IAM has *eventual consistency* between policy update and effective permissions — different APIs have different propagation windows.

### PRs

| PR | Trigger | Fix |
|---|---|---|
| [#2](https://github.com/edri2or/or-factory-master/pull/2) | `gcloud projects add-iam-policy-binding` failed with *"Service account ... does not exist"* 2s after `service-accounts create` returned | Wrap each binding in a 6×5s retry. SA→IAM-member propagation is ~5-30s. |
| [#3](https://github.com/edri2or/or-factory-master/pull/3) | `gcloud iam workload-identity-pools create` failed `PERMISSION_DENIED` even though broker SA had `roles/owner` on the new project | `roles/owner` does not include `iam.workloadIdentityPools.*` (deliberate GCP design). Add `roles/iam.workloadIdentityPoolAdmin` self-binding in-workflow, plus the same role at the folder level (done manually). |
| [#4](https://github.com/edri2or/or-factory-master/pull/4) | WIF create still `PERMISSION_DENIED` even after the binding from PR #3 was visible in `get-iam-policy` | Role-grant → effective-permission propagation is ~30-60s. Wrap both WIF creates (pool and provider) in 12×10s retry on `PERMISSION_DENIED` only. |
| [#5](https://github.com/edri2or/or-factory-master/pull/5) | `gcloud iam service-accounts add-iam-policy-binding` on the freshly-created `deploy-sa` failed `iam.serviceAccounts.setIamPolicy` denied | SA→setIamPolicy propagation is ~30-60s. Wrap the WIF user binding in 10×10s retry. Was masked earlier when PR #4's retries gave the SA time to settle; surfaced after PR #4 made WIF succeed on attempt 1. |

### One App permission gap, fixed in the GitHub UI

The App registration manifest used in stage 4 didn't include the `variables` permission — GitHub's App Manifest API doesn't accept it. After stage 6's first end-to-end run failed at `Set repo variables` with 403, the permission was added in the UI (Settings → Apps → factory-master-broker → Permissions → Variables: Read and write → Accept new permissions on the installation).

This is now recorded in `docs/external-state.md`.

## The 3 propagation windows, named

These come up enough that any future `gcloud` call against a fresh resource needs to assume one of them is in play:

1. **SA → IAM policy member** (~5–30s). After `gcloud iam service-accounts create`, calling `gcloud projects add-iam-policy-binding` with that SA as `--member` fails *"does not exist"*. PR #2.
2. **Role-grant → effective permission** (~30–60s). After `add-iam-policy-binding` returns, the principal can `get-iam-policy` and see the binding, but actual API calls that need that permission can fail `PERMISSION_DENIED`. PR #4.
3. **SA → setIamPolicy on the SA resource itself** (~30–60s). After `service-accounts create`, calling `gcloud iam service-accounts add-iam-policy-binding` on that SA (to grant something *to* the SA) fails. PR #5.

`CLAUDE.md` has a short reference for this pattern under "Propagation patterns".

## The clean run (`v2-test-6`)

After PRs #1-#5 merged and `docs/external-state.md`'s manual grants were in place, run `26258161582` provisioned `v2-test-6` end-to-end with no manual steps:

```
Set up job:                                        success
Validate inputs:                                   success
Authenticate to GCP via WIF:                       success
Resolve broker App credentials:                    success
Preflight — verify repo and project don't exist:   success
Create GCP project + link billing:                 success
Enable APIs:                                       success
Create runtime-sa and deploy-sa:                   success
Grant project-level IAM:                           success
Create system-level WIF pool and provider:         success
Grant deploy-sa workloadIdentityUser binding:      success
Create GitHub repo with auto_init:                 success
Branch protection on main:                         success
Copy generic secrets:                              success
Set repo variables:                                success
Summary:                                           success
```

Total wall time: ~3 minutes. No retries fired on the happy path; the retry budgets are headroom, not a regular cost.

## How long this took

Stage 6 — from first dispatch (which immediately failed at IAM binding) to clean end-to-end — was 7 workflow runs across roughly an hour, with 5 PRs and 3 manual IAM/permission grants in between. Each failure surfaced exactly one bug, and each PR fixed exactly one bug. That is the dividend of running provisioning manually and watching: every failure is visible immediately and is small enough to fix in one commit.
