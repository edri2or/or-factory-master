# Roadmap

What's working today, what's planned, what's deliberately not planned.

## Working today

`provision-system.yml` provisions a new system end-to-end:

- GCP project under the systems folder, linked to billing
- 7 enabled APIs
- `runtime-sa` and `deploy-sa` with project-level IAM
- `github-pool` / `github-provider` WIF, pinned by CEL to `edri2or/<system_name>` on `refs/heads/main`
- `deploy-sa` workloadIdentityUser binding for the new repo's WIF principal
- Private GitHub repo with `auto_init`, the deploy-workflow scaffold pushed onto `main`, and branch protection on `main`
- 16 generic secrets copied into the system's Secret Manager
- 4 repo variables (`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_PROJECT_ID`, `SYSTEM_NAME`) set on the new repo

`deploy-railway-cloudflare.yml` (lives in each system repo, pushed by `provision-system.yml`) provisions the deploy plane:

- Railway project named after `vars.SYSTEM_NAME`, Postgres service via the official template, n8n service from `n8nio/n8n:1.85.4`, and a persistent volume mounted at `/home/node/.n8n` on the n8n service
- n8n env vars wired to Postgres via Railway reference syntax (`${{Postgres.PGHOST}}` etc.), plus `N8N_HOST`, `WEBHOOK_URL`, `GENERIC_TIMEZONE`, `N8N_ENCRYPTION_KEY` (generated per-system, persisted to system SM)
- Custom domain `n8n.<system>.or-infra.com` attached to the n8n service, with the matching Cloudflare CNAME (DNS-only — Railway issues its own LE cert)
- Railway IDs persisted back to system SM (`railway-project-id`, `railway-n8n-service-id`, `railway-postgres-service-id`) so the workflow is restart-safe

End-to-end: any standalone service can deploy to Cloud Run via the system's `deploy-sa` WIF and SM, AND every system has a one-click n8n on Railway. What's left is the decommission story (Phase B).

## Phase A — done (stage 7)

The deploy plane workflow landed in stage 7. See `templates/system/.github/workflows/deploy-railway-cloudflare.yml` for the workflow and the "Push deploy workflow scaffold to system repo" step in `provision-system.yml` for the delivery mechanism.

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
