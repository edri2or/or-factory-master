# Changelog

## Stage 31 — ops: bulk Railway project cleanup workflow (keep-list, operator-dispatched)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `.github/workflows/decommission-railway-projects.yml` — a manual `workflow_dispatch` that deletes **every** Railway project the factory token can see, across all workspaces, **except** those whose project id is in the `keep_ids` input. Fills a real gap: the MCP `railway_graphql_read` tool refuses mutations, and `decommission-test-system.yml` hard-refuses any non-`{factory,v2,or}-test-*` name (and `factory-test-25`) and deletes one-at-a-time with repo/DNS side effects — neither can do a bulk Railway-only prune. Reuses the proven WIF→broker-SA auth, `_gql` helper, and `projectDelete` mutation from `decommission-test-system.yml`; lists across workspaces via `me { workspaces { projects { edges } } }` (mirrors the MCP `listProjects`, so the second workspace's `or-project39-railway` is included, unlike `projects(first:N)`). Railway token is read from `or-factory-master-control` SM (`railway-api-token`). |
| TBD | safety | Guards: defaults to **dry-run** (prints a KEEP/DELETE plan table to the job summary, deletes nothing); a real run requires `dry_run=false` **and** `confirm=DELETE`; refuses an empty `keep_ids`; aborts if **none** of the `keep_ids` match a live project (a stale keep-list can never wipe the workspace) and if Railway returns zero projects; per-project delete failures are collected and reported (exit 1 at end) without blocking the rest. Keep-list is by **project id** (not name) because names duplicate (e.g. `project-life-34` ×6). Default `keep_ids` = the 5 keepers (`factory-org-reader-mcp`, `project-life-130`, `factory-test-30`, `factory-test-31`, `factory-test-25`). |

Operator-triggered only — intentionally **not** on the MCP `dispatch_workflow` allowlist, and runs on `main` (WIF trusts `refs/heads/main`). Railway-only: no GCP project, Secret Manager, GitHub repo, or DNS is touched.

## Stage 30 — deploy: fix OpenRouter workflow create (missing `active`) + enforce soft-fail

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the Stage 29 `Create OpenRouter credential + demo workflow in n8n` step posted a workflow body without a top-level `active` field, so n8n 1.121.0's `POST /rest/workflows` returned `HTTP 500 — null value in column "active" of relation "workflow_entity" violates not-null constraint` (same class as Stage 17's notifier fix). Added `active: false` to the workflow JSON (it is activated immediately after via the activate endpoint). Caught on a live deploy of `factory-test-30`: the credential created fine (`openRouterApi` apiKey+url validated), the workflow POST 500'd. |
| TBD | fix | Same step violated the non-negotiable soft-fail rule: every n8n REST failure (login, `GET`/`POST /rest/credentials`, `GET`/`POST /rest/workflows`, missing id) did a hard `exit 1`, which failed the whole deploy (steps `Persist Railway IDs` + `Summary` were skipped). All hard exits replaced with a `_soft_exit0` helper that writes a Hebrew warning to `$GITHUB_STEP_SUMMARY` and `exit 0`, so an OpenRouter/n8n hiccup can never fail an otherwise-successful deploy. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md); existing system repos keep their current deploy workflow until re-provisioned.

## Stage 29 — OpenRouter per-system inference keys with management-key isolation

| PR | Type | Summary |
|---|---|---|
| TBD | security | `scripts/copy-generic-secrets.sh` EXCLUDE broadened from `^factory-master-broker-app-(id\|private-key\|installation-id)$` to `^(factory-master-broker-app-.*\|.*-management-key\|.*-provisioning-key\|.*-master-key)$`. `openrouter-management-key` (a super-credential that can mint/revoke inference keys account-wide) — and any future `*-management-key` / `*-provisioning-key` / `*-master-key` — is no longer copied into tenant Secret Managers; it stays exclusively in `or-factory-master-control`. Closes a propagation gap. |
| TBD | feature | `.github/workflows/provision-system.yml` gains a `Mint per-system OpenRouter inference key` step (after generic copy, before runtime-shell pre-create): reads `openrouter-management-key` from control SM, `POST /api/v1/keys` (`limit:25`, `limit_reset:"monthly"`, `include_byok_in_limit:false`), and stores the live key as `openrouter-api-key` + its revocation id as `openrouter-key-hash` in the tenant SM (both granted `secretAccessor` to runtime-sa + deploy-sa). Idempotent (skips if `openrouter-api-key` already has a version). Soft-fail: API/parse failure masks the key, attempts orphan-key `DELETE` if a hash was returned, writes a Hebrew job-summary warning, and `exit 0`. |
| TBD | feature | `templates/system/.github/workflows/deploy-railway-cloudflare.yml` gains a `Create OpenRouter credential + demo workflow in n8n` step (after the Telegram notifier): fresh n8n login, creates the `openRouterApi` credential `OpenRouter (factory-master)` (both `apiKey` + `url` in `data`) and the `factory-master: OpenRouter auto-router demo` workflow (Webhook → AI Agent → OpenRouter Chat Model, model `openrouter/auto`), activates it, and test-fires the webhook. Idempotent by name for both credential and workflow; test-fire is informational (soft-fail with a Hebrew warning, deploy stays green). Verified against n8n 1.121.0: `openRouterApi` (apiKey + hidden url, default `https://openrouter.ai/api/v1`), `@n8n/n8n-nodes-langchain.lmChatOpenRouter` typeVersion 1, `@n8n/n8n-nodes-langchain.agent` typeVersion 2, sub-node `ai_languageModel` wiring under the model node's own name. |
| TBD | feature | `.github/workflows/decommission-test-system.yml` gains a `Revoke OpenRouter inference key` step (before Railway delete): reads `openrouter-key-hash` from the system SM and `DELETE /api/v1/keys/:hash` with the control-project management key, verifying `{"deleted":true}`. Best-effort — a revoke failure warns and continues teardown (an orphaned inference key is not a blocker). |
| TBD | docs | New `docs/openrouter-integration.md` (Hebrew): what OpenRouter + `openrouter/auto` are, the one-time manual management-key setup, the automatic per-system flow, troubleshooting, costs, and manual revoke. `docs/external-state.md` corrected to list `openrouter-management-key` as a never-copied super-credential rather than a generic copied secret. |

Provision/deploy/decommission changes are repo-level and reach newly-provisioned systems only; existing system repos keep their current deploy workflow until re-provisioned (per CLAUDE.md). `openrouter-api-key` / `openrouter-key-hash` are minted per system and never shared.

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

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md`; Stages 11-17 to `docs/changelog-archive/CHANGELOG-2026-05-23.md`; Stages 18-21 to `docs/changelog-archive/CHANGELOG-2026-05-24.md` — keeping this file under the 20 KB scan-friendly cap.

## Bootstrap stages 1-4

Pre-repo work, done in Cloud Shell and the GitHub UI. Documented in `docs/bootstrap-record.md` and the manual grants in `docs/external-state.md`.

- Stage 1: GCP control project `or-factory-master-control`, org policy override, manual API enables
- Stage 2: `factory-master-broker` SA, WIF pool/provider on control project, folder IAM
- Stage 3: 16 generic secrets copied from old factory (`factory-control-9piybr`) to `or-factory-master-control`
- Stage 4: GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, App credentials stored in SM
