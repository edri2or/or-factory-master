# Changelog

## Stage 41 — feat: bundle the gcp-hands-client skill into every scaffolded system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Vendor `templates/system/.claude/skills/gcp-hands-client/{SKILL.md,README.md}` (byte-identical to `edri2or/gcp-hands@main`); `provision-system.yml` now scaffolds the whole `.claude` tree (commands + skills) so each new repo can dispatch GCP ops to `edri2or/gcp-hands` out of the box. Cross-repo dispatch-token requirement is documented in the vendored README (per-system App stays single-repo), not provisioned. Periodic re-sync deferred (gcp-hands PLAN.md "SKILL.md drift"). |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 40 — deploy: fix OpenRouter summary extraction for real n8n 1.121.0 (+ temp debug)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the Stage 39 extraction fell back to the generic label + `?` tokens/duration on a live `factory-test-35` deploy. Root causes (confirmed against n8n 1.121.0 source): the internal `GET /rest/executions` lists under **`.results`** (not `.data`) and filters via **`?filter={"workflowId":…}`** (a bare `workflowId=` is ignored), so `EXEC_ID` came back empty and the whole block was skipped (every value, incl. duration, fell back); `GET /rest/executions/:id` returns the execution directly with `.data` **JSON-stringified** (must `fromjson` before `.resultData.runData`); and token usage is under `.tokenUsage` **or** `.tokenUsageEstimate`. Rewrote the extraction to filter+read `.results`, parse the stringified `.data` (guarded so an unexpected shape — e.g. an n8n `flatted` array — degrades to empty, never errors), and read both token keys. The `model_name` path (`…generations[0][0].generationInfo.model_name`) was already correct and is unchanged. |
| TBD | chore | Added a temporary `DEBUG(temp)` dump (bounded, stderr/build-log only — execution runData carries the prompt/reply but no secrets) of the raw executions list/detail + resolved `EXEC_ID`, to confirm the real response shapes on the next live deploy (esp. plain-JSON vs n8n `flatted`). To be removed in a follow-up once verified, per the Stage 37/38 throwaway-probe pattern. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 39 — deploy: OpenRouter summary shows the routed model + token usage + duration

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the OpenRouter test-fire success branch now surfaces the **actually-routed** model (NotDiamond's pick), prompt/completion token usage, and run duration, pulled from n8n's `/rest/executions/{id}?includeData=true` runData — the AI Agent webhook response drops the resolved model (confirmed by the Stage 37/38 probe), so the old `.model // .data.model` read of the webhook body always fell back to the generic `openrouter/auto` label. Renders them as a table in the job summary. Reuses the existing `_napi` helper + still-open cookie session; every new call is guarded so a missed/mismatched execution lookup degrades to the generic label + `?` usage and never fails the (informational) test-fire. `trap` extended to clean the 2 new temp files; duration computed via a one-line `python3` (a multi-line block can't live in a YAML `run:` scalar). |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 38 — chore: remove the temporary OpenRouter model-attribution probe

| PR | Type | Summary |
|---|---|---|
| TBD | chore | Removed `.github/workflows/or-model-probe.yml` (added Stage 37) now that results are captured. `openrouter/auto` (NotDiamond) routing for the 3 test prompts: easy → `openai/gpt-5-nano`, medium + complex → `google/gemini-2.5-flash-lite`. |

## Stage 37 — chore: temporary OpenRouter model-attribution probe (removed after use)

| PR | Type | Summary |
|---|---|---|
| TBD | chore | Added `.github/workflows/or-model-probe.yml` (throwaway): runs only on `main` (broker WIF), reads `factory-test-33`'s `openrouter-api-key` from `factory-test-25` SM, and calls OpenRouter directly with `model=openrouter/auto` for the 3 prompts to surface the resolved `.model` NotDiamond picks (which n8n's AI Agent node drops). Removed in a follow-up after results are captured. |

## Stage 36 — mcp: verify_* tools resolve systems via repo vars, not manifests

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `services/mcp-server/src/{tools,manifest-helper,github-client}.ts`: the read-only verifier tools (`verify_gcp_system`/`verify_github_system`/`verify_railway_system`/`verify_cloudflare_system`/`list_system_secrets`/`inspect_railway_service`/`inspect_wif_provider`) loaded `factory/manifests/<name>.yml`, but this factory never writes manifests — every call 404'd (hit live verifying `factory-test-33`). New `resolveSystem()` + `getRepoVariable()` resolve a system manifest-free: `githubRepo=edri2or/<name>`, `gcpProjectId` from the repo's `GCP_PROJECT_ID` variable (shared project in reuse/test mode, `<name>` in normal mode). `verify_railway_system` + `inspect_railway_service` now resolve the Railway project live by name (`==systemName`) + `production` env, matching `postgres`/`n8n` by name. `verify_cloudflare_system` degrades to a graceful skip pointing at the direct DNS/probe tools. Removed dead `loadManifest` + its `yaml`/`getRepoFile` imports. |
| TBD | fix | `services/mcp-server/src/tools.ts`: `verify_gcp_system`'s "project-under-correct-folder" check used a stale folder id (`293382608212`, failed 100% of the time); corrected to the real Systems folder `123180924297` (now module-level `SYSTEMS_FOLDER_ID`). |

## Stage 35 — ops: bulk-decommission workflow also prunes leftover Cloudflare DNS

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `.github/workflows/decommission-railway-projects.yml` now also deletes the dangling factory Cloudflare DNS records for the removed systems, not just the Railway projects. New "Read Cloudflare credentials from Secret Manager" step (reads `cloudflare-token-creator` + `cloudflare-zone-id-or-infra` from `or-factory-master-control`, masked) and a "Cloudflare DNS cleanup (plan + delete)" step that mints a 1h scoped DNS:Edit token (revoked on exit), lists the `or-infra.com` zone, and removes every `n8n-*` CNAME and `_railway-verify.n8n-*` TXT **except** the keepers' (the plan step records each keeper's FQDNs to a preserve-set). Reuses the exact mint/list/delete pattern from `decommission-test-system.yml`. Same `dry_run`/`confirm=DELETE` gates: the dry-run prints the full DNS keep/delete table (the only way to enumerate the records, since the MCP `cloudflare-zones-read-token` is a placeholder) and deletes nothing; per-record failures are reported, not fatal mid-loop. DNS is free, so this is dangling-record hygiene — deleting the Railway projects is what stops billing. |
| TBD | chore | Rotated Stages 23-25 into `docs/changelog-archive/CHANGELOG-2026-05-24.md` (newest-first) to keep `CHANGELOG.md` under the 20 KB cap. |

## Stage 34 — deploy: notifier step rides out Railway custom-domain cert flap

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the `Create "n8n is ready" Telegram notifier workflow` step had unguarded n8n REST curls (`HTTP=$(curl …)` with no `\|\| echo`), so a transient Railway custom-domain cert flap (`curl: (60) SSL: no alternative certificate subject name matches`, right after the TLS-wait step) aborted the step under `set -e` with exit 60 — killing the "n8n ready" ping **and** skipping the downstream OpenRouter step (observed live on `factory-test-32`). Applied the same `_napi` helper used by the OpenRouter step (Stage 31, #64): all post-login calls (`GET /rest/workflows`, `POST /rest/credentials`, `POST /rest/workflows`, activate `POST`/`PATCH`, and the webhook fire) now guard curl-level failures and retry **only** on `000` (no HTTP request reached the server → safe to retry, even POSTs), never on a real HTTP status; login retries the same way. Existing semantics unchanged: skip-when-`n8n-telegram-*`-empty, idempotent skip-if-exists, and non-fatal Telegram send (a real non-2xx still only warns). Also closes the create-vs-notify idempotency gap — with no mid-run crash, create+activate+fire complete in one run, so skip-on-redeploy is then correct. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 33 — decommission: fix Railway find-by-name (cross-workspace query)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `.github/workflows/decommission-test-system.yml` found the Railway project to delete via the top-level `query { projects(first:200) { edges … } }`, which returns **empty** on a workspace/team-token account (Railway owns projects under `me.workspaces[].projects`, not `me` directly). So a single-system teardown without an explicit `railway_project_id` silently logged `SKIP: no Railway project found` and **leaked the Railway project** (confirmed live on `factory-test-30/31` — had to pass explicit IDs). Switched the find-by-name to `query { me { workspaces { projects { edges { node { id name } } } } } }` and flattened across workspaces in jq, mirroring the proven `listProjects` in `services/mcp-server/src/railway-client.ts` and the Stage 32 bulk-cleanup workflow. The name-verify guard (`project(id).name == system_name` before `projectDelete`) and the `railway_project_id` short-circuit are unchanged. |

No behavior change when `railway_project_id` is passed; this only repairs the by-name fallback.

## Stage 32 — ops: bulk Railway project cleanup workflow (keep-list, operator-dispatched)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `.github/workflows/decommission-railway-projects.yml` — a manual `workflow_dispatch` that deletes **every** Railway project the factory token can see, across all workspaces, **except** those whose project id is in the `keep_ids` input. Fills a real gap: the MCP `railway_graphql_read` tool refuses mutations, and `decommission-test-system.yml` hard-refuses any non-`{factory,v2,or}-test-*` name (and `factory-test-25`) and deletes one-at-a-time with repo/DNS side effects — neither can do a bulk Railway-only prune. Reuses the proven WIF→broker-SA auth, `_gql` helper, and `projectDelete` mutation from `decommission-test-system.yml`; lists across workspaces via `me { workspaces { projects { edges } } }` (mirrors the MCP `listProjects`, so the second workspace's `or-project39-railway` is included, unlike `projects(first:N)`). Railway token is read from `or-factory-master-control` SM (`railway-api-token`). |
| TBD | safety | Guards: defaults to **dry-run** (prints a KEEP/DELETE plan table to the job summary, deletes nothing); a real run requires `dry_run=false` **and** `confirm=DELETE`; refuses an empty `keep_ids`; aborts if **none** of the `keep_ids` match a live project (a stale keep-list can never wipe the workspace) and if Railway returns zero projects; per-project delete failures are collected and reported (exit 1 at end) without blocking the rest. Keep-list is by **project id** (not name) because names duplicate (e.g. `project-life-34` ×6). Default `keep_ids` = the 5 keepers (`factory-org-reader-mcp`, `project-life-130`, `factory-test-30`, `factory-test-31`, `factory-test-25`). |

Operator-triggered only — intentionally **not** on the MCP `dispatch_workflow` allowlist, and runs on `main` (WIF trusts `refs/heads/main`). Railway-only: no GCP project, Secret Manager, GitHub repo, or DNS is touched.

## Stage 31 — deploy: ride out Railway custom-domain cert flap in the OpenRouter step

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: a live deploy of `factory-test-31` failed at the OpenRouter step with `curl: (60) SSL: no alternative certificate subject name matches target host name` — Railway's freshly-issued custom-domain cert briefly served a non-matching cert right after the TLS-wait step (login succeeded, the next call hit the flap). Because that `curl` was unguarded, `set -e` aborted the step with curl's exit 60, **bypassing the Stage 30 soft-fail** (`_soft_exit0` never ran; `Persist Railway IDs` + `Summary` were skipped). All post-login n8n calls now route through a `_napi` helper that guards curl-level failures (`\|\| echo "000"`) and retries **only** on `000` (no HTTP request reached the server, so retrying is safe even for POSTs — cannot double-create), never on a real HTTP status; login gets the same retry loop. This rides out the transient cert flap and makes the Stage 30 soft-fail actually hold for connection-level failures, not just non-2xx. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md). The notifier step has the same latent unguarded-curl pattern but is out of scope here.

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

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md`; Stages 11-17 to `docs/changelog-archive/CHANGELOG-2026-05-23.md`; Stages 18-25 to `docs/changelog-archive/CHANGELOG-2026-05-24.md`; Stages 26-27 to `docs/changelog-archive/CHANGELOG-2026-05-25.md` — keeping this file under the 20 KB scan-friendly cap.

## Bootstrap stages 1-4

Pre-repo work, done in Cloud Shell and the GitHub UI. Documented in `docs/bootstrap-record.md` and the manual grants in `docs/external-state.md`.

- Stage 1: GCP control project `or-factory-master-control`, org policy override, manual API enables
- Stage 2: `factory-master-broker` SA, WIF pool/provider on control project, folder IAM
- Stage 3: 16 generic secrets copied from old factory (`factory-control-9piybr`) to `or-factory-master-control`
- Stage 4: GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, App credentials stored in SM
