# Changelog

## Stage 7 — fixes (cont.)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Revert Postgres env-vars-before-volumeCreate from PR #28. That reorder hung Postgres in `DEPLOYING` on factory-test-16 (same symptom as factory-test-9/10/11 earlier in the session). Restore `edri2or/factory`'s verbatim order: serviceCreate → volumeCreate → env vars. |

## CI / process

| PR | Type | Summary |
|---|---|---|
| TBD | ci | Add `Changelog Check` workflow (mirrors `edri2or/factory`'s gate): fails any push to `main` / PR whose `.sh` / `.json` / `.yml` / `.yaml` diff is missing a `CHANGELOG.md` update, and enforces a 20KB cap on `CHANGELOG.md`. Backed by `scripts/check-changelog-updated.sh`, `scripts/check-changelog-size.sh`, `scripts/lib.sh`. |

## Stage 7 — deploy plane (Phase A)

| PR | Type | Summary |
|---|---|---|
| [#7](https://github.com/edri2or/or-factory-master/pull/7) | feature | Add `templates/system/.github/workflows/deploy-railway-cloudflare.yml` (n8n + Postgres + persistent volume + custom domain + Cloudflare CNAME, idempotent). Add "Push deploy workflow scaffold to system repo" step to `provision-system.yml`. Update `CLAUDE.md`, `docs/roadmap.md`, `docs/external-state.md`, `docs/bootstrap-record.md`. |

End-to-end after this stage: `provision-system.yml` creates a system AND ships its deploy workflow; the user dispatches `deploy-railway-cloudflare.yml` in the system repo to stand up n8n at `https://n8n.<system>.or-infra.com`.

## Stage 6 — first end-to-end provision

| PR | Type | Summary |
|---|---|---|
| [#1](https://github.com/edri2or/or-factory-master/pull/1) | feature | `stage 5`: CLAUDE.md, three skills, provision-system workflow, helper scripts |
| [#2](https://github.com/edri2or/or-factory-master/pull/2) | fix | Retry IAM policy bindings to ride out SA → IAM-member propagation (~5-30s window) |
| [#3](https://github.com/edri2or/or-factory-master/pull/3) | fix | Grant broker SA `workloadIdentityPoolAdmin` on the new project (roles/owner doesn't include it) |
| [#4](https://github.com/edri2or/or-factory-master/pull/4) | fix | Retry WIF create on PERMISSION_DENIED for role-grant → effective-permission propagation (~30-60s) |
| [#5](https://github.com/edri2or/or-factory-master/pull/5) | fix | Retry deploy-sa workloadIdentityUser binding on SA → setIamPolicy propagation (~30-60s) |
| [#6](https://github.com/edri2or/or-factory-master/pull/6) | docs | Stage-6 record, external-state, roadmap, this changelog |

End-to-end clean run: `v2-test-6` (run [26258161582](https://github.com/edri2or/or-factory-master/actions/runs/26258161582)), all 15 workflow steps succeeded with no manual intervention.

## Bootstrap stages 1-4

Pre-repo work, done in Cloud Shell and the GitHub UI. Documented in `docs/bootstrap-record.md` and the manual grants in `docs/external-state.md`.

- Stage 1: GCP control project `or-factory-master-control`, org policy override, manual API enables
- Stage 2: `factory-master-broker` SA, WIF pool/provider on control project, folder IAM
- Stage 3: 16 generic secrets copied from old factory (`factory-control-9piybr`) to `or-factory-master-control`
- Stage 4: GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, App credentials stored in SM
