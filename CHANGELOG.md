# Changelog

## Stage 28 — provision: scaffold global skills package into every system repo

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `.github/workflows/provision-system.yml` now scaffolds the **global skills package** into every new system repo: a new `Push global skills package to system repo` step (after the deploy-workflow scaffold, **before** branch protection so the push to `main` needs no bypass) clones `edri2or/<system_name>` with the broker `APP_TOKEN`, copies `templates/system/.claude/commands/*.md` into the repo's `.claude/commands/`, and pushes a single `ci: scaffold global skills package` commit. Every provisioned system (test **and** real — repo content, no GCP/quota impact) ships with the same 63 reusable slash-command skills the factory has. `APP_TOKEN` is `::add-mask::`-ed and `set -x` stays off so the token in the clone URL is never echoed; the step guards on a non-empty source and a successful push. |
| TBD | chore | New `templates/system/.claude/commands/` — the mirror that becomes the package pushed into system repos (makes `templates/system/` the single canonical description of "what a system repo gets", consistent with the deploy workflow already living there). Seeded byte-identical to the factory's own `.claude/commands/` (63 files). |
| TBD | chore | New `scripts/check-skills-mirror.sh` (`diff -rq` guard, `PASS:`/`ERROR:` style matching `check-changelog-updated.sh`) wired into `.github/workflows/changelog-check.yml` as a third step, so the mirror can never silently drift from `.claude/commands/`. |

Provision change is repo-level (all future provisions); existing system repos keep their current contents until re-provisioned (per CLAUDE.md).

## Stage 27 — workflows: move actions off Node.js 20 (checkout v5, auth v3)

| PR | Type | Summary |
|---|---|---|
| TBD | chore | Bump pinned actions to versions that declare `runs.using: node24`, ahead of GitHub's Node 20 deprecation (forced to Node 24 on 2026-06-02, removed from runners 2026-09-16). `actions/checkout` `v4.2.2` → **`v5.0.1`** (`93cb6efe…`) across all 10 `.github/workflows/` files; `google-github-actions/auth` `v2.1.13` → **`v3.0.0`** (`7c6bc770…`) across 7 `.github/workflows/` files **and** the scaffold `templates/system/.github/workflows/deploy-railway-cloudflare.yml`. `google-github-actions/setup-gcloud` was already `v3.0.1`/node24 — left unchanged (the deprecation warning named only checkout + auth). SHA-pin posture preserved; auth v3's "removed old parameters" do not touch the WIF inputs we use (`workload_identity_provider` / `service_account`, confirmed still present in v3.0.0's `action.yml`), so GCP auth is unaffected. Pure pin bumps — no workflow logic changed. The template edit reaches newly-provisioned systems only (per CLAUDE.md); existing system repos keep their pin until re-provisioned. |

## Stage 26 — provision seeds n8n-telegram-chat-id; deploy notifier test send non-fatal

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `.github/workflows/provision-system.yml`'s `Pre-create runtime secret shells` step now **seeds `n8n-telegram-chat-id` from `telegram-chat-id`** (placed in the project moments earlier by `scripts/copy-generic-secrets.sh`). The per-system n8n bot is a different bot — `n8n-telegram-bot-token` is still filled manually — but it messages the **same** operator chat, and a Telegram `chat_id` is global across bots, so the factory-admin chat-id is the right default. Seeds only when the secret has no version (same seed-if-empty pattern as `copy-generic-secrets.sh`) so reuse re-runs and any manual override aren't clobbered; the value is `::add-mask::`-ed and never echoed. Removes the redundant manual step of re-typing a chat-id already sitting in the same SM. Runs in both normal and reuse mode, no IAM change (broker SA is owner), applies to all future provisions immediately. |
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the `Create "n8n is ready" Telegram notifier workflow` step's final test send (the webhook fire) is now **non-fatal** — a non-200 from api.telegram.org writes a `$GITHUB_STEP_SUMMARY` warning and continues instead of `exit 1`; credential / workflow-create / activate stay fatal. With the chat-id now seeded, the notifier attempts a real send as soon as the bot token is filled; if that per-system bot was never `/start`-ed by (or added to) the seeded chat the send is rejected — operator-side bot setup, not a deploy failure, so it must not fail an otherwise-successful deploy. The warning is retry-accurate: the workflow is created + active but the step's name-based idempotency skips it on redeploy, so it tells the operator to `/start` the bot and re-run the notifier workflow manually from n8n. Template edit → newly-provisioned systems only. |

Provision change is repo-level (all future provisions); the deploy-template change reaches systems provisioned after the edit only (per CLAUDE.md).

## Stage 25 — MCP: GitOps auto-deploy on merge to main

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add a `push` trigger (branches `main`, paths `services/mcp-server/**` + the workflow file) to `.github/workflows/deploy-mcp-server.yml`, alongside the existing `workflow_dispatch`, so a reviewed PR that changes the server (e.g. the `dispatch_workflow` allowlist) **auto-redeploys on merge** — no manual dispatch. The `concurrency` queue (`cancel-in-progress: false`), `environment: production`, and `if: github.ref=='refs/heads/main'` were already present. Security is unchanged and sits where it belongs: branch protection (PR review — the agent can't self-merge) + the WIF CEL pinned to `refs/heads/main` (off-`main` runs can't authenticate), **not** a manual button. The agent only *proposes* via PR; the human *merge* activates. Merging this PR itself fires the first auto-deploy, shipping current `main` (incl. Stage 24's allowlist) and activating `decommission-test-system`. |

## Stage 24 — decommission-test-system: agent-driven test teardown

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `.github/workflows/decommission-test-system.yml` (manual, agent-dispatchable) tears down a reuse-mode TEST system: deletes its Railway project (name-verified first), removes its Cloudflare `n8n-<name>` CNAME + `_railway-verify` TXT, archives `edri2or/<system_name>`. Reuse-aware via `shared_gcp_project`; hard-refuses control projects + `factory-test-25`; touches no GCP/SM. Added to the `dispatch_workflow` allowlist (`services/mcp-server/src/tools.ts`; one `deploy-mcp-server.yml` redeploy activates it). New skill + CLAUDE.md updates. **User-triggered only, never auto-chained.** |

## Stage 23 — register-system-app: reuse-mode parity

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Extend `.github/workflows/register-system-app.yml` with the same optional `shared_gcp_project` input added to provision in Stage 22, so a system provisioned in reuse mode (no GCP project of its own) can still register its per-system GitHub App. Introduces `SYS_PROJECT` (exported to `$GITHUB_ENV` from Validate): the GCP project for the App's SM secrets + `deploy-sa`/`runtime-sa` grants — `== system_name` normally, `== shared_gcp_project` in reuse mode (guarded to test patterns, refuses control projects). Every per-system SM/SA operation now targets `SYS_PROJECT` (preflight `projects describe`, the `github-app-*` existence check, the Cloud Run receiver's `GCP_PROJECT_ID` env where it writes the credentials, secret verification, the `secretAccessor` grants + SA emails, the install-scope token reads, the repo-var secret reads, and the operator/recovery/summary text that names the SM project). Everything tied to the **repo** stays `system_name`: the App name (`<system_name>-app`), the receiver service name, `GITHUB_REPO` (App install scope), the narrow-scope check (`total_count==1 && first==edri2or/<system_name>`), and the `APP_ID`/`APP_INSTALLATION_ID` repo vars. Empty input → byte-identical to the prior behavior. Reuse nuance: the `github-app-*` secrets land in the shared project's SM, which provision's clean-secrets wipes on the next reuse run — fine for one-off tests, re-register after a re-clean. Still a HITL 2-click step. |

Opt-in per dispatch; normal `register-system-app.yml` runs (no `shared_gcp_project`) are unchanged.

## Stage 22 — provision: reuse-mode (shared GCP test project; fresh repo/Railway/secrets)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add an optional `shared_gcp_project` input to `.github/workflows/provision-system.yml` so repeated end-to-end tests can reuse one fixed GCP project instead of creating a new one each run (the GCP project-creation quota is exhausted at 156 active+soft-deleted; soft-deleted projects keep counting for 30 days). **Empty input → behavior is byte-identical to before** (creates a new project; `gcp_project` output falls back to `system_name`). **Set to a test project (`factory-test-*`/`v2-test-*`/`or-test-*`) → reuse mode:** the `Create GCP project + link billing` step, the normal WIF-create step, and the per-repo `deploy-sa` workloadIdentityUser binding are gated `if: reuse != 'true'`; all other GCP-operating steps target a new `$GCP_PROJECT` env (== `system_name` in normal mode). The repo, Railway, Cloudflare, and all secrets stay fresh every run — only the GCP project + its billing link are reused (the deploy template already reads `GCP_PROJECT_ID` and `SYSTEM_NAME` as separate repo vars, so it needs no change). Reuse mode adds three steps: (a) idempotent WIF widening via a `test_pool` custom attribute-mapping (`assertion.repository.startsWith('edri2or/factory-test-') ? 'factory-test' : 'blocked'`) + matching attribute-condition, so any `factory-test-*` repo on `main` authenticates with **no per-test WIF mutation** ("set once", self-healing); (b) a `deploy-sa` `workloadIdentityUser` binding on the `attribute.test_pool/factory-test` principalSet (set semantics — idempotent); (c) a clean-secrets step. New `scripts/clean-project-secrets.sh` wipes every Secret Manager secret in the shared project before generics are re-copied and runtime shells re-created (the deploy workflow regenerates `n8n-encryption-key`/`n8n-owner-password`/`railway-*` on first deploy, so a wipe is safe and login still works) — hard-guarded to the test patterns and refusing both control projects, mirroring `decommission-test-projects.yml`. `Create runtime-sa and deploy-sa` is now idempotent (describe-then-create) so reuse runs don't abort on `ALREADY_EXISTS`. Repo vars in reuse mode: `GCP_WIF_PROVIDER`/`GCP_DEPLOY_SA`/`GCP_PROJECT_ID` point at the shared project, `SYSTEM_NAME` stays the repo. **Security tradeoff (accepted):** in reuse mode any `edri2or/factory-test-*` repo on `main` can impersonate the shared project's `deploy-sa` and read/write its (throwaway, per-run-regenerated) secrets — contained to a dedicated test project. No new GCP SA keys, no new secret types, billing stays linked (never unlinked/relinked per run). |

Reuse mode is opt-in per dispatch; production provisioning (no `shared_gcp_project`) is unchanged. First reuse run against a project sets up its `test_pool` WIF; subsequent runs are no-ops on WIF/IAM and only re-clean + re-seed secrets.

## Stage 21 — provision/deploy: per-system Railway project token (parity with old factory)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Port edri2or/factory's Railway project-token step. `.github/workflows/provision-system.yml` adds `railway-project-token` to the `RUNTIME_SHELLS` array so the empty SM shell (and the existing `deploy-sa`/`runtime-sa` `secretAccessor` grants) is created at provision time — no new IAM, since `deploy-sa` already holds project-level `secretVersionManager`. `templates/system/.github/workflows/deploy-railway-cloudflare.yml` gains a `Create Railway project token (idempotent)` step between `Provision Railway` and `Configure Cloudflare DNS` (where `RAILWAY_TOKEN`/`PROJECT_ID_RW`/`ENV_ID` are already in `$GITHUB_ENV`): it mints a project-scoped token via the `projectTokenCreate(input:{projectId,environmentId,name:"github-actions"})` mutation using the account `railway-api-token` (Bearer), masks it, and stores it in the system SM as `railway-project-token`. Idempotent (skips if a version exists). Nothing in this repo consumes the token yet — it is created for parity / future use; a future consumer must read it with the `Project-Access-Token` header, not `Authorization: Bearer` (old-factory `docs/adr/184`). Existing deploy auth is unchanged. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). Existing systems are not backfilled.

## Stage 20 — MCP: `dispatch_workflow` write tool (agent dispatches without a PAT)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add one WRITE tool, `dispatch_workflow`, to the factory MCP server (`services/mcp-server/`) so the agent triggers lifecycle workflows itself instead of an operator clicking "Run workflow" or curling the API with a temporary classic PAT (`$GITHUB_CLASSIC_TOKEN`). `github-client.ts` gains `dispatchWorkflow()` — POSTs `/actions/workflows/{file}/dispatches` via the existing `ghFetchRepo` (already mints the org-wide `factory-master-broker` App token, which has `actions:write` and is installed on all repos) — plus `getLatestWorkflowRun()` for the post-204 run-id lookback (the dispatch API returns 204 with no body). `tools.ts` registers `dispatch_workflow` gated on a hardcoded allowlist (`provision-system.yml`, `register-system-app.yml`, `deploy-railway-cloudflare.yml`); `decommission-system.yml` is intentionally excluded (destructive, written-approval-only). Works cross-repo (pass `repo`, e.g. `factory-test-24`) and returns `{run_id, run_url}`. No new secret / IAM / App-permission — the broker creds are already mounted by `deploy-mcp-server.yml`. `smoke.mjs` gains a side-effect-free check asserting a non-allowlisted id is refused. CLAUDE.md "How to work #3" + the Never list + the MCP table updated (the agent now dispatches via the allowlisted tool; watch-and-verify between stages still required). |

Redeploy via `deploy-mcp-server.yml` to take effect; MCP URL unchanged. Retires the env-var `$GITHUB_CLASSIC_TOKEN` dispatch path.

## Stage 19 — deploy-plane: single-redeploy env upsert + n8n HTTP readiness gate

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Two compounding fixes to `templates/system/.github/workflows/deploy-railway-cloudflare.yml` that made redeploys flaky — a deploy could fail at step 8 "Set up n8n owner account" with `GET /rest/settings` HTTP 404/403 and then pass on an immediate re-dispatch (observed on factory-test-23: run 26331335520 failed → 26331473093 passed). **(A) Collapse the env-var redeploy storm.** `_upsert` issued one Railway `variableUpsert` per variable and step 5 fired 15 in parallel for n8n + 5 for Postgres; the old comment claimed the parallel `&` fan-out "lands a single redeploy" — it does not, each `variableUpsert` triggers its own redeploy (proven: `list_railway_deployments` showed **12 n8n deployments created within ~4 s** on one run, 11 superseded). Replaced with `_upsert_collection` → one `variableCollectionUpsert` per service (all vars in a single `EnvironmentVariables` JSON map; schema verified by introspection: `VariableCollectionUpsertInput{projectId!,environmentId!,serviceId,variables!,replace,skipDeploys}`), so each service redeploys once instead of ~15×. Railway reference values (`${DLR}{{Postgres.X}}`) are preserved verbatim inside the jq map. **(B) HTTP readiness gate.** Step 7 only verifies the TLS cert (`_probe_tls_cn`), which does not imply the edge routes HTTP to a healthy n8n — after a redeploy the edge can return 404/403 ("Host not in allowlist") for minutes while the custom domain re-propagates, and step 8's single no-retry `curl /rest/settings` raced that window. Replaced with a bounded poll loop (36×10 s ≈ 6 min) that waits for HTTP 200 before proceeding, mirroring the cert-wait loop; still fails fast after the cap so a genuinely crash-looping n8n is not masked. The notifier (step 9) runs right after step 8, so it inherits the gate. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). factory-test-23 gets the same two edits in its frozen copy so its own redeploys are reliable; other existing systems are not backfilled.

## Stage 18 — deploy-plane: idempotent n8n-owner-password (notifier login on redeploy)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Make `n8n-owner-password` idempotent in `templates/system/.github/workflows/deploy-railway-cloudflare.yml` (~line 124): reuse the existing SM `latest` version if present (mirroring the `n8n-owner-email` block just above it); only mint a fresh password when none exists. The old code minted a fresh password every run on the assumption it was "only consumed once at /rest/owner/setup" — true until Stage 15's notifier step began logging into n8n on every deploy. On a redeploy, step 8 skips owner-setup (`showSetupOnFirstLoad=false`) so n8n keeps the first-run password, while the notifier logs in with the freshly-minted one → `POST /rest/login` 401 (surfacing as a confusing `400 emailOrLdapLoginId Required` from the `email` fallback). Surfaced on factory-test-23 deploy run 26330453235, immediately after PR #47's `active:false` fix unmasked it (login is upstream of the workflow-create call that failed before). New systems are correct from first deploy; an existing system whose password already rotated needs a one-time SM resync (re-promote the owner-creation run's version to `latest`). |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). factory-test-23 gets the same fix in its frozen copy plus a one-time SM resync before re-dispatch; not auto-backfilled to other systems.

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md`; Stages 11-17 to `docs/changelog-archive/CHANGELOG-2026-05-23.md` — keeping this file under the 20 KB scan-friendly cap.

## Bootstrap stages 1-4

Pre-repo work, done in Cloud Shell and the GitHub UI. Documented in `docs/bootstrap-record.md` and the manual grants in `docs/external-state.md`.

- Stage 1: GCP control project `or-factory-master-control`, org policy override, manual API enables
- Stage 2: `factory-master-broker` SA, WIF pool/provider on control project, folder IAM
- Stage 3: 16 generic secrets copied from old factory (`factory-control-9piybr`) to `or-factory-master-control`
- Stage 4: GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, App credentials stored in SM
