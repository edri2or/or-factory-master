# Changelog

## Stage 49 — ops: audit `keep_names` input protects keys from deletion

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `audit-openrouter-orphan-keys.yml`: added a `keep_names` manual-dispatch input (comma-separated key names) that are **never deleted**, even on a live run. A protected orphan/stale key is reported with action `🔒 Kept (protected)` and counted in a new `kept` tally (job summary + `BREAKDOWN:` stdout line). Lets a real cleanup spare specific keys (e.g. `n8n-railway-production,n8n-telegram-bot`, which are orphan-by-no-repo but may still back a manually-run system) instead of the previous all-orphan-and-stale-or-nothing behavior. Matching is exact per name (wrapped in commas, spaces stripped). No change to dry-run/scheduled behavior when the input is empty. |

## Stage 48 — ops: audit emits per-key classification to stdout

| PR | Type | Summary |
|---|---|---|
| TBD | chore | `audit-openrouter-orphan-keys.yml`: the per-key classification table was only written to `$GITHUB_STEP_SUMMARY`, which GitHub exposes via no REST API — so the full result couldn't be read back from a finished run (only the aggregate counts were on stdout). Added a per-key `echo` to stdout (status, name, hash prefix, created, project, disabled, action) plus a `BREAKDOWN:` line carrying all five counts (live/orphan/stale/uncertain/total), so the complete audit is recoverable from the run logs. Also reset `GCP_PROJECT_ID` at the top of each loop iteration so the log line never reports a stale project for an orphan key. No classification or deletion behavior changed. |

## Stage 47 — ops: daily OpenRouter orphan-key audit

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `.github/workflows/audit-openrouter-orphan-keys.yml`: runs daily at 06:00 UTC (dry-run; reports only) and on manual dispatch (with `dry_run=false`+`confirm=DELETE` for real cleanup). Lists all OpenRouter keys via the management key, classifies each as **Live** (repo exists + SM hash matches), **Orphan** (no repo), **Stale** (repo exists but SM hash mismatch — leftover from a reuse-mode re-provision), or **Uncertain** (can't read SM hash — broker SA not yet granted access on pre-Stage-47 systems). Renders a table in the job summary; Telegram notification when issues are found. Deletion is opt-in via manual dispatch only (scheduled runs are always read-only). |
| TBD | fix | `provision-system.yml` "Mint per-system OpenRouter inference key" step: after storing `openrouter-key-hash`, now also grants `roles/secretmanager.secretAccessor` to the broker SA (`factory-master-broker@or-factory-master-control`) on that secret — enabling the audit workflow to do hash reconciliation for systems provisioned going forward. Pre-Stage-47 systems remain Uncertain until re-provisioned or manually backfilled. |

## Stage 46 — deploy: patient TLS-cert wait fixes the recurring first-deploy failure

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the first deploy of a new system almost always failed at "Wait for Railway TLS cert" (step 8), needing a manual re-dispatch (4 of 6 first-deploys this session). Root cause (from `factory-test-40`'s failed step-8 log): the cert needs ~8-15 min on a stable domain, but the step polled only 5 min then **recreated the customDomain** — which changes the CNAME target and **resets verification progress**, and whose `customDomainCreate` itself intermittently returns Railway `INTERNAL_SERVER_ERROR` (500), killing the step (seen on test-36 + test-40). Replaced the symmetric `2×5min + recreate-between` loop with a **patient ~15-min poll on the stable domain (no recreate)**, falling back to **one last-resort recreate (+~8-min poll)** only if that fails; and **guarded `_recreate_custom_domain`'s `customDomainCreate` with a 6× retry** on the flaky 500 (returns instead of `exit 1`). Wall-clock cap ~23 min. Most first-deploys should now pass without a manual retry. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 45 — feat: bundle the gcp-hands-client skill into every scaffolded system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Vendor `templates/system/.claude/skills/gcp-hands-client/{SKILL.md,README.md}` (byte-identical to `edri2or/gcp-hands@main`); `provision-system.yml` now scaffolds the whole `.claude` tree (commands + skills) so each new repo can dispatch GCP ops to `edri2or/gcp-hands` out of the box. Cross-repo dispatch-token requirement is documented in the vendored README (per-system App stays single-repo), not provisioned. Periodic re-sync deferred (gcp-hands PLAN.md "SKILL.md drift"). |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 44 — deploy: get the OpenRouter resolved model + tokens from a direct API call

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the Stage 43 `DBGMODEL` dump proved (live on `factory-test-39`) that n8n **strips the resolved model** from its stored runData (`generationInfo` holds only `finish_reason`), so it cannot be recovered from the execution at all. Per OpenRouter docs the chat-completion **response `.model`** is the model `openrouter/auto` actually routed to (and `.usage` has the tokens) — exactly what the Activity page shows. So the OpenRouter step now reads model + tokens from a **direct `POST {OR_CRED_URL}/chat/completions`** (Bearer = the per-system inference key already in scope; `max_tokens:16`; ~$0.0005; guarded so it never fails the deploy). Duration still comes from the **actual n8n demo execution** (the `.data.results[]` list summary's `startedAt`/`stoppedAt`). Removed the `/rest/executions/:id` detail fetch, the Python flatted decoder, and all temporary `DEBUG(temp)`/`DBGMODEL` lines — finalizes Stages 40–43. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 43 — deploy: search runData for the OpenRouter model + dump generationInfo (diagnostic)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: live on `factory-test-38` the Stage 42 flatted decoder made **tokens (7+1) and duration (1.7s) render**, but the model stayed on the fallback — `generations[0][0].generationInfo.model_name` was empty. Replaced the single-path model read with a recursive search of the decoded `response` for a `model_name`/`model` key whose value matches a `provider/model` pattern (finds it wherever n8n places it; ignores the reply text). Added a temporary `DBGMODEL` stderr line dumping the decoded `generationInfo` so the next deploy reveals the model's location — or confirms n8n strips it (the model lives in langchain's `llmOutput`, which n8n may drop from the per-generation payload). Tokens/duration unchanged; dropped `2>/dev/null` on the python call so the diagnostic shows. Validated locally with a real flatted encoder: model-present → `provider/model\t7\t1`, model-absent → `\t7\t1`. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 42 — deploy: decode n8n 'flatted' execution data for OpenRouter model + tokens

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: live on `factory-test-37` the Stage 41 fix made `EXEC_ID` + duration render, but the `DEBUG(temp)` dump showed the execution **detail** returns the run payload (`exec.data`) in n8n's **`flatted`** format (a JSON array of registry slots with numeric-string refs, possibly cyclic), which jq can't decode — so model/tokens stayed on the fallback. Replaced the jq model/tokens extraction with a small **memoised, cycle-safe Python flatted decoder** that resolves the registry, then reads `model_name` from the OpenRouter sub-node's `generations` and tokens from `tokenUsage`/`tokenUsageEstimate`. Also handles plain-JSON string/object shapes; any failure prints a tab fallback (never errors the step). Validated locally (realistic flatted sample → `model\tprompt\tcomp`; `tokenUsageEstimate` variant; cyclic input degrades with no hang). `EXEC_ID` + duration (from the list summary) unchanged. `DEBUG(temp)` exec-detail kept one more cycle to confirm the live shape, then removed. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 41 — deploy: fix OpenRouter exec-list envelope (.data.results) + duration from list

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: Stage 40 still fell back to `?` on a live `factory-test-36` deploy — the `DEBUG(temp)` dump showed the internal `GET /rest/executions` wraps the array as **`.data.results[]`** (Stage 40 read `.results`, missing the top-level `.data` envelope), so `EXEC_ID` was empty and the block was skipped. Now reads `.data.results`; and since the list summary carries `startedAt`/`stoppedAt`, **duration is taken straight from the list** (no detail call) — verified against the captured payload (`EXEC_ID=2`, duration `1.3s`). Model + tokens still come from the execution detail; hardened that jq to resolve the run payload across wrapped/unwrapped shapes and parse the stringified `.data` (graceful empty if it is a `flatted` array). The `DEBUG(temp)` dump stays one more cycle to confirm the detail payload shape (plain-JSON vs flatted), then is removed. |

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

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md`; Stages 11-17 to `docs/changelog-archive/CHANGELOG-2026-05-23.md`; Stages 18-25 to `docs/changelog-archive/CHANGELOG-2026-05-24.md`; Stages 26-32 to `docs/changelog-archive/CHANGELOG-2026-05-25.md` — keeping this file under the 20 KB scan-friendly cap.

## Bootstrap stages 1-4

Pre-repo work, done in Cloud Shell and the GitHub UI. Documented in `docs/bootstrap-record.md` and the manual grants in `docs/external-state.md`.

- Stage 1: GCP control project `or-factory-master-control`, org policy override, manual API enables
- Stage 2: `factory-master-broker` SA, WIF pool/provider on control project, folder IAM
- Stage 3: 16 generic secrets copied from old factory (`factory-control-9piybr`) to `or-factory-master-control`
- Stage 4: GitHub App `factory-master-broker` registered via Cloud Run receiver, installed org-wide, App credentials stored in SM
