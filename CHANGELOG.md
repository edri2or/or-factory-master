# Changelog

## Stage 10 — MCP migration (Railway visibility expansion)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Migrate the read-only MCP server out of the old factory (`edri2or/factory/services/factory-actions-mcp/` + Cloud Run in `factory-control-9piybr`) into `or-factory-master`. New code: `services/mcp-server/` (ported verbatim, then patched), `.github/workflows/deploy-mcp-server.yml` (manual dispatch, idempotent — creates `factory-master-actions-mcp-runtime` SA, mints `mcp-server-{admin-secret,bearer-signing-key}` if missing, grants secretAccessor on the 9 mounted secrets + project-level read roles on `or-factory-master-control`, builds Docker image, deploys to Cloud Run, probes `/health`). Service name `factory-master-actions-mcp` in `or-factory-master-control` me-west1. After first deploy the operator updates the MCP server URL in Claude Code to the printed Region URL — one-time action; documented in the workflow's job summary. |
| TBD | fix | Railway `inspect_railway_service` / `inspect_railway_service_direct` now return **customDomains** with `verified`, `verificationDnsHost`, `verificationToken`, `certificateStatusDetailed`, `certificateErrorMessage`, `dnsRecords{hostlabel,recordType,requiredValue}` — the missing data that left factory-test-19/20 diagnosis dependent on the operator's Railway dashboard (`domains: []` was always returned even when a custom domain existed, because the old query only selected `serviceDomains`). The GraphQL selection in `services/mcp-server/src/railway-client.ts:getServiceInstance` now mirrors what the deploy template's `customDomainCreate` query has been using all along. `RailwayServiceInstance.domains` stays populated from `serviceDomains` so existing callers don't break. |
| TBD | feature | Add four new typed Railway tools + one passthrough: `list_railway_service_variables` (env-var names; values redacted unless `reveal=true`), `list_railway_service_volumes` (mountPath + sizeMB per volume), `list_railway_deployments` (history beyond latest), and `railway_graphql_read` — read-only passthrough that forwards any GraphQL query to Railway and refuses any document containing a `mutation` operation (server-side regex on the comment-and-string-stripped document). The passthrough closes every future Railway visibility gap without an MCP redeploy. |

Out of this stage's scope: cleanup of the old factory's MCP Cloud Run service in `factory-control-9piybr` (separate decommission step after the new MCP is verified in production); backfill of customDomain status on factory-test-{18,19,20} (re-inspect with the new tools once live).

## Stage 9 — deploy-plane race + owner-setup masking

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Eliminate the Postgres init race in `templates/system/.github/workflows/deploy-railway-cloudflare.yml`. Railway's `serviceCreate` starts Postgres BEFORE our env-var upsert lands, so the first `initdb` runs with default env (creates db `postgres`); the volume then mounts and Postgres logs `PostgreSQL Database directory appears to contain a database; Skipping initialization` on every restart, silently ignoring `POSTGRES_DB=railway`. n8n configured against the absent `railway` db crash-loops with `FATAL: database "railway" does not exist`. factory-test-18 won the race yesterday, factory-test-19 lost it today. Fix: use `postgres` (the image's race-proof default db name) everywhere — `POSTGRES_DB`, the `DATABASE_URL` suffix, and n8n's `DB_POSTGRESDB_DATABASE` (now a literal `postgres` instead of the `${{Postgres.POSTGRES_DB}}` Railway reference). |
| TBD | fix | Make `Set up n8n owner account` fail fast when n8n isn't actually serving. The old `curl -sS … \|\| echo '{}'` swallowed 403/5xx bodies as `{}`, defaulted `showSetupOnFirstLoad` to `false`, and the step `exit 0`d with `INFO: n8n owner already set up — skipping` — masking a crash-looping n8n (the masking that hid factory-test-19's broken state from the workflow summary). New code captures the HTTP status, fails the step with the response body if not 200, then parses the flag from the saved JSON. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). Existing systems (or-test-50, or-test-51, factory-test-18, factory-test-19) keep their pre-fix workflows frozen in their repos.

## Stage 8 — per-system GitHub App

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add `.github/workflows/register-system-app.yml` + `skills/register-system-app/SKILL.md` for per-system GitHub Apps (ADR-012 pattern from `edri2or/factory`, adapted to the master factory's manual model). Mirrors `register-broker-app.yml`: deploys Cloud Run receiver into `or-factory-master-control`, reuses the existing `bootstrap-images/receiver:latest` image (built once by the broker workflow, persists in Artifact Registry after teardown). Per-system App name `<system_name>-app`; narrow permissions (`contents:write`, `metadata:read`, `actions:write`, `workflows:write`, `secrets:write`) — no `administration`, no `organization_administration`, no `pull_requests`. Operator picks "Only select repositories" on click 2; workflow verifies via the new App's own `GET /installation/repositories` that `total_count==1` and the single repo matches the system name (no PAT-based PATCH narrowing — the only API path would need an App owner user OAuth token). Writes `github-app-{id,private-key,installation-id}` to the system project's SM, grants `secretAccessor` to deploy-sa and runtime-sa, sets `APP_ID` + `APP_INSTALLATION_ID` as Actions repo variables on the system repo. Idempotent (short-circuits if `github-app-private-key` + `github-app-installation-id` already in system SM). Service `system-app-receiver-<system_name>` is torn down with `if: always()`. |

## Stage 7 — deploy-plane stabilization (today)

| PR | Type | Summary |
|---|---|---|
| TBD | docs | Refresh `README.md`, `docs/roadmap.md`, `CLAUDE.md`, `CHANGELOG.md`, `skills/build-system/SKILL.md` to match today's merged code: single-level subdomain, n8n 1.121.0, auto owner-setup, TXT verification record, customDomain recreate-on-unverified, Railway throttle gotcha. |
| [#30](https://github.com/edri2or/or-factory-master/pull/30) | fix | Revert Postgres env-vars-before-volumeCreate from PR #28. That reorder hung Postgres in `DEPLOYING` on factory-test-16 (same symptom as factory-test-9/10/11 earlier in the session). Restore `edri2or/factory`'s verbatim order: serviceCreate → volumeCreate → env vars. |
| TBD | ci | Port three more CI gates from `edri2or/factory`: `supply-chain-check.yml` (actions pinned to SHA, no `permissions: write-all`, no `pull_request_target`, no `id-token: write` on PR triggers), `secret-scan.yml` (greps the tree for `ghp_*`, `github_pat_*`, `ya29.*`, PEM keys, GCP SA JSON, committed `.env`), and `pipeline-tests.yml` (shellcheck on `scripts/*.sh` + yamllint on every workflow YAML). 5 helper scripts under `scripts/`, plus `.yamllint` to silence line-length on our long jq / GraphQL one-liners. Also pins `actions/checkout`, `google-github-actions/auth`, and `google-github-actions/setup-gcloud` in `register-broker-app.yml` (caught by the new gate). |
| [#29](https://github.com/edri2or/or-factory-master/pull/29) | ci | Add `Changelog Check` workflow (mirrors `edri2or/factory`'s gate): fails any push to `main` / PR whose `.sh` / `.json` / `.yml` / `.yaml` diff is missing a `CHANGELOG.md` update, and enforces a 20KB cap on `CHANGELOG.md`. Backed by `scripts/check-changelog-updated.sh`, `scripts/check-changelog-size.sh`, `scripts/lib.sh`. |
| [#28](https://github.com/edri2or/or-factory-master/pull/28) | fix | Bump n8n image to `n8nio/n8n:1.121.0` (patches CVE-2026-21858 "Ni8mare", CVSS 10.0 unauthenticated RCE; vulnerable range 1.65-1.120.4). Originally also reordered Postgres env-vars-before-volumeCreate; that part reverted in PR #30. |
| [#27](https://github.com/edri2or/or-factory-master/pull/27) | feat | Auto-create the n8n owner account after first deploy: extend "Resolve or generate n8n encryption key" step to also resolve/generate `n8n-owner-email` (defaults to `admin@<system>.or-infra.com`, idempotent) and `n8n-owner-password` (fresh per-run, `Aa1!<32 hex>`). Add new "Set up n8n owner account" step that POSTs to `/rest/owner/setup` with name derived from `SYSTEM_NAME`. Two new SM shells pre-created in `provision-system.yml`. |
| [#26](https://github.com/edri2or/or-factory-master/pull/26) | fix | End-to-end provision + LE-cert n8n on a custom domain. Loop over Railway's full `dnsRecords` (CNAME + verify TXT, both required by Cloudflare); strip `DNS_RECORD_TYPE_` enum prefix Railway returns; switch host to single-level `n8n-<system>.or-infra.com`; write `_railway-verify` TXT from `status.verificationToken`; force `customDomainDelete` + `customDomainCreate` when `verified=false` so Railway re-runs its DNS check and issues the LE cert; new "Wait for Railway TLS cert" step polls until the per-host cert is live (or warns on timeout). |

End-to-end clean run today: `factory-test-18` from `provision-system.yml` → `deploy-railway-cloudflare.yml` → `https://n8n-factory-test-18.or-infra.com` lands on the n8n login screen with a valid LE cert and the owner account already created, no manual intervention.

## Stage 7 — deploy plane (Phase A)

| PR | Type | Summary |
|---|---|---|
| [#7](https://github.com/edri2or/or-factory-master/pull/7) | feature | Add `templates/system/.github/workflows/deploy-railway-cloudflare.yml` (n8n + Postgres + persistent volume + custom domain + Cloudflare CNAME, idempotent). Add "Push deploy workflow scaffold to system repo" step to `provision-system.yml`. Update `CLAUDE.md`, `docs/roadmap.md`, `docs/external-state.md`, `docs/bootstrap-record.md`. |

End-to-end after this stage: `provision-system.yml` creates a system AND ships its deploy workflow; the user dispatches `deploy-railway-cloudflare.yml` in the system repo. Further follow-up fixes landed today (see PRs #26-#30 above) so the URL actually lands on a working n8n login screen.

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
