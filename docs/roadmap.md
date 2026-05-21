# Roadmap

What's working today, what's planned, what's deliberately not planned.

## Working today

`provision-system.yml` provisions a new system end-to-end:

- GCP project under the systems folder, linked to billing
- 7 enabled APIs
- `runtime-sa` and `deploy-sa` with project-level IAM
- `github-pool` / `github-provider` WIF, pinned by CEL to `edri2or/<system_name>` on `refs/heads/main`
- `deploy-sa` workloadIdentityUser binding for the new repo's WIF principal
- Private GitHub repo with `auto_init` and a protected `main`
- 16 generic secrets copied into the system's Secret Manager
- 4 repo variables (`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_PROJECT_ID`, `SYSTEM_NAME`) set on the new repo

What the system can do with that: any GitHub Actions workflow inside the system repo can authenticate to its own GCP project via WIF, read secrets from its own SM, and deploy to Cloud Run. That's enough to land any standalone service. What it can't do yet: deploy Railway or Cloudflare anything (because there's no workflow for it on the system side).

## Phase A — Deploy workflow (next)

`provision-system.yml` builds the *control plane* of a new system. The deploy plane — Railway project, n8n service, Postgres, Cloudflare DNS — is one more workflow.

**Where it lives:** in the *system* repo, not in `or-factory-master`. The factory provisions it; the system runs it. The scaffold for this workflow is something `provision-system.yml` should push as part of repo creation (`auto_init` + a commit with `.github/workflows/deploy-railway-cloudflare.yml`).

**Inputs:** none (workflow_dispatch). It reads everything from the repo's own variables and from its own SM.

**Outline:**
- WIF auth as `deploy-sa` (using `vars.GCP_WIF_PROVIDER` + `vars.GCP_DEPLOY_SA`).
- Read `railway-api-token`, `cloudflare-token-creator`, `cloudflare-zone-id-or-infra` from system SM.
- Idempotent Railway create: project (named after `vars.SYSTEM_NAME`), Postgres service with persistent volume, n8n service. Use the same GraphQL pattern as the old factory (`/tmp/factory/factory/templates/scaffold/cloud-run-service/.github/workflows/railway-cloudflare-bootstrap.yml` is the reference — ~780 lines, but most of the complexity is monitoring/retry that we don't need here).
- Idempotent Cloudflare DNS create: `n8n.<system>.or-infra.com` CNAME → Railway public domain.
- Store the resulting IDs (`RAILWAY_PROJECT_ID`, etc.) back into system SM so the workflow is restart-safe.

**Effort estimate:** 1-2 sessions. Most of it is translating the old factory's GraphQL boilerplate into a workflow that doesn't try to monitor itself.

**Dependencies:** none beyond what `provision-system.yml` already provides.

## Phase B — Decommission workflow

`skills/decommission-system/SKILL.md` describes the intended flow; the workflow itself doesn't exist yet.

**Where it lives:** in `or-factory-master`, dispatched manually.

**Inputs:** `system_name` + `confirmed_destructive=true` (input validation rejects anything else).

**Outline:**
- Preflight: GCP project and GitHub repo both exist.
- Refuse if `system_name` is `or-factory-master` or `or-factory-master-control` (hard guard).
- Archive the GitHub repo (`PATCH /repos/edri2or/<name> {"archived": true}`).
- Soft-delete the GCP project (`gcloud projects delete`, 30-day grace period).
- *Optionally* call out to Railway / Cloudflare cleanup (only if `vars.RAILWAY_PROJECT_ID` etc. are populated).
- Summary.

**Effort estimate:** half a session.

**Dependencies:** none.

## Phase C — Idempotency / resume (optional)

`provision-system.yml` is not idempotent today: any partial failure leaves orphan GCP resources, and the preflight rejects re-runs because the project already exists. The user's stated principle is "ידני וברור" — fail and restart with a new name. That works fine because the project is small and creating from scratch costs ~3 minutes.

But: as the system grows (real Cloud Run services, real data, real cost), restart-from-scratch becomes expensive. At that point we'd want:

- Each step to detect "already done" (e.g. `if gcloud projects describe ...` instead of `gcloud projects create ...` failing).
- A workflow input `--resume` (or just defaulting to idempotent) so the same `system_name` can be re-run after fixing a transient bug.
- Tagging so we can find "factory-created but not-yet-finished" projects and either complete or clean them up.

**Effort estimate:** 1 session, but only when the cost of restart-from-scratch starts to bite.

**Trigger to start:** first time someone has to wait more than 10 minutes to recover from a failed real-system provision.

## Things we are deliberately not building

The previous factory had these and they bought less than they cost:

- **factory-actions MCP server.** The read-only inspection MCP (`5b6e937f-*`) already covers every verify/inspect/list we need. Building a write-tools MCP would mean more code paths to secure with no real upside.
- **Manifests** (`factory/manifests/<system>.yml`). The state lives in GCP IAM and GitHub settings; reconstructing it from a manifest would duplicate the source of truth.
- **Evidence records** (`factory/evidence/*.json`). The workflow runs *are* the audit log; GitHub keeps them.
- **Issue-based reporting** (`factory-success` / `factory-failure` labels). The agent watches workflow runs in real time; Issues are async clutter.
- **Handoff gates / direct verification**. The factory builds; the user verifies in the same session via the inspection MCP. If verification fails, fix and re-run — no separate gate workflow.
- **Auto-chain between workflows**. Every workflow is a separate manual dispatch. The user decides when to move to the next step.

If you want one of these later, that's fine, but each one needs to justify itself against the "manual, visible, restart-from-scratch" principle in CLAUDE.md.

## Maintenance cadence

There's no scheduled work. Things to watch for:

- **GCP IAM model changes.** If GCP changes what's in `roles/owner`, the workflow's `_bind` for `iam.workloadIdentityPoolAdmin` may become redundant or insufficient. The retries will surface the change.
- **GitHub App permissions.** New endpoints sometimes need new permissions. Add them in the UI when they break something.
- **Old factory archival.** `edri2or/factory` is still live and burning $0. At some point we'll want to formally archive it (`PATCH /repos/edri2or/factory {"archived": true}`). Not blocking anything.

## When to call this "done"

The factory has been done since `v2-test-6` succeeded. Phase A makes it useful for the actual workflow the user cares about (running n8n systems on Railway). Phase B makes it round-trippable. Phase C is a "nice to have."

Stop building when adding features stops paying for itself. Right now, the simplest path is: do Phase A, build the first real system, see what breaks.
