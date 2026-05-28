# Changelog — archive

Older stages were moved out of the root `CHANGELOG.md` to keep it under the 20 KB CI cap (`scripts/check-changelog-size.sh`). The newest stages live in [`../../CHANGELOG.md`](../../CHANGELOG.md).

## Stage 94 — docs: Telegram chat bot (Phase F) + suppress n8n attribution footer

| PR | Type | Summary |
|---|---|---|
| TBD | docs | PR 4/4 of Phase F — documentation + one cosmetic polish, after the bot was verified end-to-end on a live test system (Telegram → real system-aware answer). New `docs/telegram-chat-bot.md` (Hebrew, analogous to `openrouter-integration.md`): the two-bot architecture (chat bot `n8n-telegram-bot-token` + alerts bot `telegram-bot-token`, shared `chat_id`), the inbound flow (Telegram → `setWebhook` → Caddy `/webhook/telegram-in/*` exemption → `tg-inbound` Webhook → internal `localhost:5678` router call → reply), the secrets, **what v1 ships vs what's deferred** (persistent Postgres memory, style learning + `style-refresh`, daily `tg-proactive`, dedup/spend, HITL writes — all need live DB discovery), the single manual action (bot-token paste), troubleshooting, and migration. `docs/openrouter-integration.md` gains §8 (Telegram chat integration); `docs/roadmap.md` gains **Phase F** (analogous to Phase D, with the 5 architecture adaptations + PR/hotfix history); `templates/system/AGENTS.md.template` updated (Agent Router → "Agent Router + Telegram Chat Bot", `n8n-telegram-webhook-secret` added to runtime shells, two-bot note). Polish: `tg-inbound`'s Send Reply sets `appendAttribution: false`, so the bot's messages no longer carry the "This message was sent automatically with n8n" footer. No behaviour change beyond the footer. |

## Stage 93 — fix: tg-inbound calls the router internally (the public path is Caddy HMAC-gated)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Caught on the live test of `factory-test-tgbot1`: `tg-inbound`'s "Call Agent Router" node POSTed to the **public** `https://<domain>/webhook/agent-router`, which Caddy HMAC-gates (→ 401, same as the `configure-agent-router` smoke probe's `http=401`), so the workflow errored before replying. Fix: call n8n **internally** at `http://localhost:5678/webhook/agent-router` (the `tg-inbound` HTTP node runs in the n8n container, so this bypasses the Caddy edge — the standard internal-webhook pattern) and set the node `onError: continueRegularOutput` so a router hiccup degrades to the bot's fallback reply instead of a silent failure. `@@N8N_DOMAIN@@` is no longer used by tg-inbound (its configure sed becomes a harmless no-op). The rest of provision → deploy → configure verified clean end-to-end on the live test system (Telegram credential + `tg-inbound` active + `setWebhook` registered). |

## Stage 92 — feat: activate the Telegram chat bot (Phase F core — Telegram → router → reply)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | **PR 3/4 of Phase F — activates the chat bot's verifiable core.** Implementation surfaced + verified five conflicts between the planned design and the live architecture (deploy-sa can't reach the control project's SM; n8n's built-in Telegram Trigger registers an internal webhook path that bypasses the Caddy `/webhook/telegram-in/*` gate; the unchanged `agent-router` forwards only the message text, not context/approval flags; the system's Postgres is Railway-private and its password isn't in SM, so GitHub Actions can't `CREATE TABLE` or build a PG credential there; nested HITL is fragile). The verifiable core ships now; Postgres-backed features + HITL writes are a live-verified follow-up. **`tg-inbound.json`** rewritten to a generic **Webhook node** at path `telegram-in/inbound` (the Telegram Trigger can't sit behind the Caddy exemption) → single-operator chat-id filter → POST the existing `/webhook/agent-router` → Telegram `sendMessage` (🤖). **`unknown-agent.json`** rewritten from the ops-only fallback into a smart **general + system-aware chat agent** (Claude Haiku 4.5 + window memory keyed `tg:<chat_id>` + read-only n8n tools: list workflows, recent failed executions) with a friendly Hebrew-first tone; it says it can't perform writes yet rather than pretending. **`configure-agent-router.yml`** now also reads the system's own `n8n-telegram-bot-token`/`n8n-telegram-chat-id` (soft-halt with a Hebrew one-command instruction if the token is absent — the operator's single manual action), creates the `Telegram (factory-master)` credential, installs + activates `tg-inbound`, and registers Telegram `setWebhook` → `https://<domain>/webhook/telegram-in/inbound` with the per-system secret token. `agent-router.json` (classifier + Macro-F1 gate) untouched; all soft-fail + idempotent. **Deferred to a live-verified follow-up:** Postgres tables + credential, persistent chat history, style-profile learning + weekly refresh, daily proactive summary (`tg-proactive`/`style-refresh` stay inert templates), dedup/spend logging, and approval-gated (HITL) write actions. |

## Stage 91 — feat: Caddy /webhook/telegram-in/* exemption + per-system Telegram webhook secret

| PR | Type | Summary |
|---|---|---|
| TBD | feature | **PR 2/4 of Phase F — the highest-risk PR (touches the Caddy edge that fronts every webhook).** `templates/system/Caddyfile` gains a `/webhook/telegram-in/*` exemption: two `handle` blocks placed BEFORE the existing `@webhook` HMAC handler (handle blocks evaluate in source order, first match wins) — `@telegram_authed` (path + exact `X-Telegram-Bot-Api-Secret-Token` header match against `{$N8N_TELEGRAM_WEBHOOK_SECRET}`) reverse-proxies to n8n; `@telegram_unauthed` (path only) returns 401. Telegram cannot compute the factory HMAC, so it authenticates with its own secret-token header; an empty env ⇒ the path is fail-closed (401), never fail-open. The existing `/webhook/*` HMAC + rate-limit handler and the `hmacguard` module are untouched; `Dockerfile.caddy` needs no change (Caddy reads `{$VAR}` at runtime). The per-system `n8n-telegram-webhook-secret` is pre-created as a runtime shell **and minted** (`openssl rand -hex 32`, idempotent only-when-empty) in `provision-system.yml` by the broker SA — deploy-sa has `versions.add` but not `secrets.create`, and minting at provision means the value exists before the first deploy/configure read (single source for both Caddy and PR-3's setWebhook). `deploy-railway-cloudflare.yml` reads it and includes it in the first-create Caddy env collection (omitted when absent → fail-closed; no separate step, ~0.4 KB added to stay under the 128 KiB workflow cap). No active listener yet — PR 3 installs `tg-inbound`. Idempotent + soft-fail throughout; the secret is never rotated once set (a new value would break an already-registered webhook). |

## Stage 90 — feat: add Telegram chat-bot workflow templates (tg-inbound, tg-proactive, style-refresh)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | **Additive only — first of 4 PRs that turn every new system's Telegram bot into a smart chat agent (Phase F).** Adds 3 new n8n workflow JSONs under `templates/system/workflows/n8n/`: **`tg-inbound.json`** (Telegram Trigger → normalize message/callback/edited → `tg_updates_seen` dedupe → load `style_profile`+last-20 `n8n_chat_histories`+`pending_actions` → POST the existing `/webhook/agent-router` → HITL `Send and Wait` approval for mutating actions, else direct reply → `n8n_chat_histories`+`spend_log`+`audit_log` persist), **`tg-proactive.json`** (Schedule `0 8 * * *` → aggregate 24h `audit_log`/`spend_log` + n8n API error executions → Haiku 4.5 daily summary → Telegram 🟢), and **`style-refresh.json`** (Schedule `0 3 * * 0` → last-50 messages → Haiku 4.5 extract style JSON → validate/fallback → UPSERT `style_profile`). All three follow the existing `@@…@@` placeholder + credential-reference convention; new tokens introduced for later substitution: `@@CRED_TELEGRAM_ID@@`, `@@CRED_POSTGRES_ID@@`, `@@CHAT_ID@@`, `@@TG_WEBHOOK_SECRET@@`, `@@SYSTEM_NAME@@` (they reuse the existing `@@CRED_OPENROUTER_ID@@`/`@@N8N_DOMAIN@@`/`@@CRED_N8N_API_ID@@`). **No behaviour change for any system: `configure-agent-router.yml` does not install or activate these yet, the agent JSONs are untouched, the Caddyfile is untouched, and no system references them — they are inert template files until PR 3 wires them. `agent-router.json` (classifier + Macro-F1 gate) is deliberately not touched.** |

## Stage 89 — feat: scaffold CI governance (branch protection + required checks) into every system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Every provisioned system now enforces the same governance as or-factory-master: **PR-only merge to `main` + 4 required green CI checks + a documentation policy**. New `templates/system/.github/workflows/{changelog-check,pipeline-tests,secret-scan,supply-chain-check}.yml` (system-adapted: pipeline-tests lints `scripts/*.sh` + `.github/workflows/` only; changelog-check drops the factory-only skills-mirror step), `templates/system/.yamllint` (relaxed + line-length disable — needed so yamllint passes the large deploy workflow), and a seed `templates/system/CHANGELOG.md`. `provision-system.yml`'s scaffold step now also copies those 4 workflows + `.yamllint` + `CHANGELOG.md` into the system repo and the **8 portable** check scripts (`lib.sh`, `check-changelog-updated.sh`, `check-changelog-size.sh`, `scan-for-secrets.sh`, `check-actions-pinned.sh`, `check-workflow-permissions.sh`, `check-no-pull-request-target.sh`, `check-no-privileged-pr-workflows.sh`) from the factory's own `scripts/` (single source of truth; `check-skills-mirror.sh` is factory-specific and excluded); the `git add` list gains `.github/workflows` (whole dir) + `.yamllint` + `CHANGELOG.md`. The "Branch protection on main" step now sets `required_status_checks{strict:true, contexts:["Changelog gates","shellcheck + yamllint","Scan for committed secrets","Supply chain gates"]}` alongside the existing PR-required (0 approvals) + no force-push/deletion. The already-scaffolded workflows (deploy, configure-agent-router) pass all gates (SHA-pinned, `workflow_dispatch`-only, no `pull_request_target`/`write-all`). `CLAUDE.md` provision row updated. `adhd-agent` (provisioned before this) gets the same bundle applied via a one-off PR. Stages 73–74 rotated to the changelog archive. |

## Stage 88 — fix: adopt-mode completeness — register-system-app + orientation-doc MODE

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Two adopt-mode gaps surfaced while provisioning the first real adopt system (`adhd-agent` onto recovered `factory-test-7`). **(1)** `register-system-app.yml` only had `shared_gcp_project` (test-pattern guard), so a real adopt system whose GCP project id ≠ repo name had no clean way to point the App's SM secrets at the right project — it worked for `factory-test-7` only because that id happens to match the test pattern. Added an `adopt_gcp_project` input (mutually exclusive with `shared_gcp_project`; refuses control projects + `factory-test-25`; accepts any valid project id) that sets `SYS_PROJECT`, so `github-app-{id,private-key,installation-id}` + the `deploy-sa`/`runtime-sa` grants land in the recovered project while the repo, App name, receiver, and `APP_*` repo vars stay `system_name`. **(2)** `provision-system.yml`'s "Push system orientation docs" step computed `MODE` as only `normal`/`reuse`, so an adopt system's scaffolded `AGENTS.md` was mislabeled `provisionMode: normal` — misleading the in-system Claude Code agent into thinking its GCP project was freshly created rather than recovered (the `gcpProjectId` was already correct — `factory-test-7` — since the step uses the `gcp_project` output). Added the `adopt` case (+ `ADOPT` env) and extended `AGENTS.md.template`'s parenthetical to explain adopt (gcpProjectId is the source of truth, not the repo name). `CLAUDE.md` + `register-system-app` SKILL updated. `bash -n` + `yamllint` clean. Stages 71–72 rotated to the changelog archive. |

## Stage 87 — fix: adopt-mode billing link retries the post-undelete IAM propagation window

| PR | Type | Summary |
|---|---|---|
| TBD | fix | The Stage 86 "Link billing (adopt mode)" step failed on the first live adopt run (`adhd-agent` onto recovered `factory-test-7`): the preflight `undelete` succeeded and restored the project (incl. the broker's `roles/owner` binding), but `gcloud beta billing projects link` fired ~1s later and got `does not have permission to access projects instance [factory-test-7] (or it may not exist)` — the restored/folder-inherited IAM was in the policy but not yet **effective** for the billing API (the eventual-consistency window documented in CLAUDE.md "Propagation patterns"). Normal mode never hits this because the broker creates+owns the project synchronously. Fix: wrap the adopt billing link in a `_link_billing` retry (12×10s) that retries only on the propagation error class (`does not have permission` / `PERMISSION_DENIED` / `may not exist`) and surfaces anything else immediately — mirroring the existing `_bind` / `_wif_op` helpers. Waiting out the window also clears the path for the subsequent project-touching steps. No behavior change for normal/reuse modes. |

## Stage 86 — feat: adopt mode — provision a real system onto a recovered GCP project

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `adopt_gcp_project` input on `provision-system.yml` provisions a **real** system onto an existing/recovered GCP project instead of creating a new one — a workaround for the exhausted project-creation quota (active + soft-deleted both count for ~30 days, so `gcloud projects create` is blocked; undeleting a soft-deleted project consumes **no** additional quota since it already counts). Adopt mode: the preflight `undelete`s the project if `DELETE_REQUESTED` (polls to ACTIVE) and fails loud if absent (it **never** creates); re-links billing idempotently; keeps **real per-system WIF** (the create-pool/provider + deploy-sa binding steps now target `gcp_project` instead of `system_name`, and an `update-oidc` re-pins the provider's attribute-condition to the new repo since an adopted project may carry a provider pinned to its prior repo); and wipes the project's secrets **once** via `clean-project-secrets.sh --adopt` (new flag — refuses control projects + `factory-test-25` but allows any other project id, vs the default test-pattern lock) so generics re-copy fresh and a new OpenRouter key is minted. `gcp_project` decouples from `system_name`: the immutable project id stays the old one, the repo is `system_name`. Mutually exclusive with `shared_gcp_project`. Normal + reuse modes are byte-identical (the `--project` switch to `gcp_project` is a no-op when it equals `system_name`; the adopt-only blocks are gated on `adopt=='true'`). New read-only `list-recoverable-projects.yml` (`workflow_dispatch`, main-only, broker WIF) enumerates `DELETE_REQUESTED` projects so an operator can pick one to adopt — not on the `dispatch_workflow` allowlist (operator dispatches from the UI; result read via run logs). `CLAUDE.md` (routing table + Workflows table) and `skills/build-system/SKILL.md` document adopt mode. Stages 68–70 rotated to `docs/changelog-archive/CHANGELOG.md` to stay under the 20 KB cap. |

## Stage 85 — feat: scaffold per-system orientation docs (AGENTS.md + CLAUDE.md)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New step in `provision-system.yml` between "Push .claude package…" and "Branch protection on main": creates `AGENTS.md` (~80 lines, Backstage-style YAML frontmatter with `apiVersion/kind:System/metadata/spec` + markdown sections covering Identity, Service Accounts and WIF, What was provisioned, Secrets in GCP SM by category, External Resources, Forbidden Actions, and a Purpose placeholder with `TODO(human):` + explicit STOP instruction) and a thin `CLAUDE.md` that imports `@AGENTS.md` (Claude Code reads CLAUDE.md natively; AGENTS.md is the cross-tool standard per agents.md Linux Foundation). Templates live at `templates/system/AGENTS.md.template` and `templates/system/CLAUDE.md.template`; substitution via `envsubst` with explicit variable allow-list (`SYSTEM_NAME`, `GCP_PROJECT`, `PROJECT_NUMBER`, `ISO_TIMESTAMP`, `PUBLIC_URL`, `HEALTH_URL`, `REPO_URL`, `GITHUB_RUN_ID`, `GITHUB_RUN_URL`, `WIF_PROVIDER`, `MODE`, `GENERIC_SECRETS`). Generic secret list enumerated at runtime from `or-factory-master-control` SM using the same EXCLUDE regex as `copy-generic-secrets.sh` (no drift); 15 runtime shells + 2 OpenRouter keys hardcoded in template. Step is `continue-on-error: true` (soft-fail per spec) with `set -uo pipefail` (no `-e`); every error branch exits 0 explicitly. Sanity-check `grep` warns on unresolved `${VAR}` after substitution (non-fatal). Pushes via clone-modify-push using the broker App token (same Pattern B as step 14), with the standard `git diff --cached --quiet \|\| commit` idempotency idiom. Solves the "blind agent" problem where new system repos arrived with only a 17-byte README and no identity/state/capabilities doc (verified on `edri2or/factory-test-42`). Reaches newly-provisioned systems only — existing systems unaffected (migration out of scope). |

## Stage 84 — feat: free path — poll Better Stack incidents API → Telegram (cron)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Better Stack outgoing webhooks (Stage 83 `/bs-webhook`) turned out to need a **paid plan**; the account is on Free. But the Better Stack **incidents READ API works on Free**, so new `.github/workflows/bs-incidents-to-telegram.yml` (schedule `*/5` + `workflow_dispatch`, `main`-only, WIF broker SA) polls `GET /api/v2/incidents` and relays new/resolved incidents to Telegram — fast downtime → Telegram at zero cost, no new infra, leveraging Better Stack's sub-minute multi-region detection (far better than the 6h `system-runtime-audit`). Dedup via a Secret Manager **`bs-telegram-watermark`** (created/versioned by the broker; first run sets a baseline and alerts nothing, so the historical backlog isn't replayed); the watermark advances only on a successful fetch, so schedule jitter never drops incidents. Reads `better-stack-api-key` + `telegram-*` as the broker SA (masked); soft-fail throughout (`[bs-incidents]` stdout). The Stage 83 `/bs-webhook` route stays dormant-but-ready for an eventual paid upgrade (true sub-minute). |

## Stage 83 — feat: observability Phase D — route Better Stack → Telegram via /bs-webhook

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Closes Phase D item 2. Better Stack has no native Telegram channel, so its per-system uptime monitors (email-only since Stage 78) now POST an outgoing webhook to a new secret-gated `POST /bs-webhook` on the MCP server, which relays the incident to Telegram — closing the gap where sub-minute downtime never reached Telegram (only the 6h `system-runtime-audit.yml` did). The route (`services/mcp-server/src/index.ts`) gates a `?token=` query constant-time against a new `BS_WEBHOOK_SECRET` env (503 if unset, 401 on mismatch), parses the incident template, and forwards via a new `sendTelegramMessage()` in `observability-client.ts` (reads `telegram-*` at runtime as the broker SA — no new mounted Telegram secret); always answers 2xx within Better Stack's 30s budget. `deploy-mcp-server.yml` mints `bs-webhook-secret` and mounts `BS_WEBHOOK_SECRET`. New `_verify-bs-webhook.yml` autonomously proves the forwarder (synthetic incident → `telegram='ok'`, plus a wrong-token→401 gate check). Operator wires the Better Stack webhook (URL + token + body template) per `docs/observability.md`. Requires an MCP redeploy. Stages 62–64 rotated to the changelog archive. |

## Stage 82 — fix: make the Sentry verification deterministic (capture+flush+event_id)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | The Stage 81 harness got to `read-back` then failed to find the event by tag-search — the `verify_marker` tag set via `getCurrentScope()` didn't reliably reach the error-handler-captured event, and on Cloud Run `min-instances=0` a fire-and-forget send can be cut off. `/debug/sentry-test` now **captures the exception explicitly** with the tag (`captureException(err, { tags })`), **awaits `Sentry.flush(3000)`** (guarantees transmission before the response), and returns `{ event_id, initialized, flushed }`. `_verify-sentry.yml` reads the `event_id` from the response and **fetches that exact event by id** (no tag-search lag), and uses `initialized` to report a distinct `sdk-disabled` result (DSN not loaded by the running revision) vs a real ingest failure. Verified locally: disabled SDK returns `initialized:false`; 403 gate intact. Requires an MCP redeploy. |

## Stage 81 — test: autonomous end-to-end Sentry verification harness

| PR | Type | Summary |
|---|---|---|
| TBD | test | Lets the agent prove the Stage 80 Sentry integration works end-to-end **autonomously** — no operator UI/manual checks. `/debug/sentry-test` (`services/mcp-server/src/index.ts`) upgraded to `app.all`, takes a `marker` query → sets a `verify_marker` tag + embeds it in the thrown error, so a specific event is locatable. New one-shot `.github/workflows/_verify-sentry.yml` (`workflow_dispatch`, `main`-only, WIF broker SA): reads (masked) `mcp-server-admin-secret` + `sentry-auth-token` + the DSN, derives the Sentry API base + project id from the DSN, resolves org/project slug, fires a uniquely-marked error (with a decoy `Authorization` header + body sentinel), **polls the Sentry API until the event lands**, then asserts the `beforeSend` scrubber stripped the `Authorization` header + body. Emits a single `[verify-sentry] result='pass|fail|blocked' …` line (no secrets). The new read-scoped `sentry-auth-token` SM secret is a one-time operator credential handoff (the DSN is write-only — it cannot read events back); reading Cloud Run logs was ruled out (broker SA lacks `logging.viewer` and cannot self-grant it). Requires an MCP redeploy for the route change. |

## Stage 80 — feat: observability Phase D — Sentry error tracking on the MCP server

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase D**, item 3 of 3: error tracking for the live TypeScript service. New `services/mcp-server/src/instrument.ts` runs `Sentry.init()` (`@sentry/node` v10) — loaded via `node --import ./dist/instrument.js` in the Dockerfile (and imported first in `index.ts` for `npm start`), so init precedes all other modules. `index.ts` adds `Sentry.setupExpressErrorHandler(app)` after the routes; `@sentry/node`'s default integrations also capture `uncaughtException`/`unhandledRejection`. **Errors-only** (`tracesSampleRate: 0`); **no-ops when no DSN** (`SENTRY_DSN` must start with `https://`), so it's safe to merge/deploy dormant. A `beforeSend` scrubber strips `Authorization`/`cookie`/`X-Admin-Secret` headers and the request body before sending (this server handles bearer tokens + the admin secret), with `sendDefaultPii:false`. The DSN comes from the existing `sentry-api-key` secret, mounted as `SENTRY_DSN` in `deploy-mcp-server.yml` (+ a best-effort `secretAccessor` grant since that secret may be out-of-band). Admin-gated `GET /debug/sentry-test` added to verify delivery end-to-end. Only the MCP server is instrumented; the inactive Python `bootstrap-receiver` is skipped. Requires a redeploy to go live. Stages 59–61 rotated to `docs/changelog-archive/CHANGELOG.md` to stay under the 20 KB cap. |

## Stage 79 — feat: observability Phase D — MCP `emit_event` tool

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase D**, item 1 of 3: the agent can now emit events into the pipeline directly. New MCP write tool `emit_event` (`services/mcp-server/src/tools.ts`) backed by a TypeScript port of the bash fan-out in new `services/mcp-server/src/observability-client.ts` — full parity with `scripts/emit-event.sh`: builds the OTel-SemConv event and fans out **soft-fail** to Axiom (always), Telegram (`warning\|error\|critical`), and Linear (`error\|critical` or `action_required`, 24h dedup + managed labels + `source-*` mapping ported from `scripts/lib/linear-issue.sh`). The image ships no `scripts/`, so it's reimplemented in TS, not shelled out. The 5 destination secrets are read at runtime from `or-factory-master-control` via the existing `getSecretValue()` (the runtime broker SA already reads them in CI) — no `--set-secrets`/deploy-config change. Each destination fails independently; the tool never throws. Severity gating preserved (info = Axiom-only/silent). Requires a redeploy of the MCP Cloud Run service to go live. |

## Stage 78 — feat: per-system Better Stack uptime monitor (closes Phase C deferral)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Closes the Phase C deferral from Stage 73 — `better-stack-api-key` is confirmed to work against the Uptime API (Stage 77 probe: HTTP 200, 1 existing monitor). New `scripts/create-uptime-monitor.sh`: idempotent (URL filter on list_monitors, exact-match on `.attributes.url`), free-tier-cap aware (skips at ≥10 existing monitors), soft-fail with structured `[uptime-monitor]` stdout (`created`/`already_exists`/`skipped`/`failed`/`rejected`). `provision-system.yml` gains one `if: success()` + `continue-on-error` step before `factory.provision.completed`, creating an HTTP-status monitor at `https://n8n-<system>.or-infra.com/healthz` (check_frequency=30s, request_timeout=15s, email-only alerts; SMS/Telegram stay on the 6h `system-runtime-audit.yml` layer). Reaches newly-provisioned systems only — no backfill. Removes the one-shot `_probe-better-stack-uptime.yml`. `docs/observability.md` §9 Phase C item moved to done; §5 secret note updated. Stages 56–58 rotated to `docs/changelog-archive/CHANGELOG.md` to stay under the 20 KB cap. |

## Stage 77 — chore: one-shot probe for better-stack-api-key against the Uptime API

| PR | Type | Summary |
|---|---|---|
| TBD | chore | Unblocks the Phase C deferral from Stage 73. One-shot `.github/workflows/_probe-better-stack-uptime.yml` (`workflow_dispatch`, `main`-only, WIF broker SA): reads + masks `better-stack-api-key`, GETs `uptime.betterstack.com/api/v2/monitors`, emits `[probe] better_stack_uptime='ok|token_unauthorized|failed'` + Hebrew summary, always exits 0. Confirms the telemetry token also authenticates against the Uptime API before the per-system monitor feature is built. Deleted in the follow-up PR. |

## Stage 76 — fix: grant the deploy job `contents: read` so checkout can clone

| PR | Type | Summary |
|---|---|---|
| TBD | fix | **Completes Stage 75.** Adding `actions/checkout` (Stage 75) was necessary but not sufficient: the deploy job's `permissions:` block declared only `id-token: write`, and once any permission is named GitHub drops every unlisted scope to `none` — so the run's `GITHUB_TOKEN` had just `metadata: read` and checkout got `remote: Repository not found` / `fatal: repository '…/factory-test-42/' not found` (a 404 standing in for 403). Checkout failed → all real steps skipped → `Emit deploy started` skipped and `Emit deploy failed` hit exit 127 (scripts never on disk). Caught on the live deploy of `factory-test-42` (run 26514615666). Adds `contents: read` to the deploy job's permissions so `actions/checkout` can clone the repo. Template now **130,101 B** (~0.9 KB under the 128 KiB cap). |

## Stage 75 — fix: deploy checks out the repo so the shipped emit scripts are present

| PR | Type | Summary |
|---|---|---|
| TBD | fix | **Regression fix for Stage 73/74.** `templates/system/.github/workflows/deploy-railway-cloudflare.yml` had no `actions/checkout`, so the `factory.deploy.*` emit steps ran in an empty workspace — `bash scripts/emit-deploy.sh` exited 127 (`No such file or directory`), since the scaffolded `scripts/emit-deploy.sh` + `scripts/emit-event.sh` were never on disk (Railway pulls the repo itself; the runner never did). Adds `actions/checkout` (pinned `93cb6efe…` v5.0.1) as the deploy job's first step so the shipped scripts are in the workspace for the emit steps. Soft-fail unchanged (`continue-on-error` + the wrapper's presence guard). Template now **130,016 B** (~1 KB under GitHub's 128 KiB cap). Caught on the first live deploy of `or-test-obsdeploy2`. |

## Stage 74 — fix: keep the deploy workflow under GitHub's 128 KiB cap

| PR | Type | Summary |
|---|---|---|
| TBD | fix | **Regression fix for Stage 73.** The inline `factory.deploy.*` emit steps grew `templates/system/.github/workflows/deploy-railway-cloudflare.yml` from 129,067 → 131,155 bytes — past GitHub's **128 KiB (131,072-byte) per-workflow-file limit** — so GitHub silently refused to register the workflow and newly-provisioned systems could not dispatch a deploy (confirmed live: `factory-test-24` at 129,067 B registers; `or-test-obsdeploy` at 131,155 B never does). Moves the emit logic into a tiny shipped `scripts/emit-deploy.sh`; the deploy template now has three one-line steps (`bash scripts/emit-deploy.sh {started,completed,failed}`), bringing it to **129,778 B** (~1.3 KB under the cap). `provision-system.yml` scaffolds `emit-deploy.sh` alongside `emit-event.sh`. Behaviour unchanged; soft-fail preserved. |

## Stage 73 — feat: observability Phase C — deploy emits (systems self-report)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase C**, part 2: deployed systems self-emit. `scripts/emit-event.sh` now reads its SM project from `${EMIT_SM_PROJECT:-or-factory-master-control}` (backward-compatible — factory-side callers unchanged). `provision-system.yml` scaffolds `scripts/emit-event.sh` + `scripts/lib/` into each new system repo. `templates/system/.github/workflows/deploy-railway-cloudflare.yml` gains three soft-fail (`continue-on-error`) steps — `factory.deploy.started` (after SM read), `factory.deploy.completed` (after Summary), `factory.deploy.failed` (`if: failure()`) — all `--layer=system`, reading the system's OWN SM (where `copy-generic-secrets.sh` already places `axiom-api-key`/`telegram-*`/`linear-*`). Reaches newly-provisioned systems only; each step guards on the emitter's presence (older scaffolds no-op). The per-system Better Stack monitor is **deferred** — `better-stack-api-key` is a telemetry token and needs Uptime-API confirmation first. Docs (`CLAUDE.md`, `docs/observability.md`) updated. |

## Stage 72 — fix: runtime-audit probe misread connection failures as unhealthy

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `system-runtime-audit.yml`: `curl -w '%{http_code}'` already prints `000` on a connection failure, but the probe also had `\|\| echo "000"`, concatenating to `"000000"` — which missed the `000)` not-deployed branch and fell through to "unhealthy". So a not-deployed leftover (`factory-test-24`) wrongly emitted `factory.runtime_audit.failed` (spurious Telegram + Linear issue). Fix: drop the `\|\| echo` and default with `code="${code:-000}"`, so `000` → not-deployed (no alert) as intended. Caught on the first live dispatch. |

## Stage 71 — feat: observability Phase C — system-runtime-audit

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase C** (generated-systems visibility), part 1. New `.github/workflows/system-runtime-audit.yml` — read-only cron every 6h (`:15`, staggered off factory-health-audit) + manual dispatch. Lists each real system (`gcloud projects list --filter=parent.id=123180924297`), HTTP-probes `https://n8n-<system>.or-infra.com/healthz` (universal across Caddy + pre-Caddy), and emits per-system `factory.runtime_audit.ok` (info → Axiom) / `factory.runtime_audit.failed` (error + action_required → Axiom + Telegram + Linear) via `scripts/emit-event.sh`, classifying `2xx`=healthy, `000`=not-deployed (logged, no alert), other=unhealthy. Adds a `factory.runtime_audit.summary` (info → Axiom) with per-run counts. Reuse-mode test systems (shared `factory-test-25`) aren't folder-listed — a noted v1 limitation. Deploy-template emit + per-system Better Stack monitors are deferred to PR-C2. Reuses the Phase A emitter unchanged. |

## Stage 70 — feat: observability Phase B — instrument provision-system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase B**, part 2 of 2. Instruments `provision-system.yml` with soft-fail (`continue-on-error`) emit steps via `scripts/emit-event.sh`: `factory.provision.started` (info, after creds resolved), `factory.provision.completed` (info, after Summary, with `{mode, gcp_project, duration_s}`), and `factory.provision.failed` (error + `action_required` → Axiom + Telegram + Linear, via `if: failure()`). Adds a "Mark start time" step after checkout for duration. Inputs flow via `env:` (never interpolated into the script line). No provisioning logic changed; every emit step is `continue-on-error` so a dead destination never affects a provision. `CLAUDE.md` provision row updated. |

## Stage 69 — feat: observability Phase B — audit emits + factory-health-audit cron

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase B** (coverage), part 1 of 2. `audit-openrouter-orphan-keys.yml` gains an `Emit observability event` step (`if: always()`, `continue-on-error`): every run emits `factory.openrouter_audit.{clean,action_needed,deletions}` via `scripts/emit-event.sh` (Axiom always; Linear on actionable findings via `action_required`; `info` severity so the existing rich Hebrew Telegram alert is never duplicated). New `.github/workflows/factory-health-audit.yml` — read-only factory-level heartbeat every 6h (+ manual dispatch): confirms `or-factory-master-control` is ACTIVE, the critical SM secrets exist, counts system projects under the Systems folder, and emits `factory.health.ok` (info → Axiom) or `factory.health.degraded` (error + action_required → Axiom + Telegram + Linear). `CLAUDE.md` Workflows table + `docs/observability.md` §9 updated. `provision-system.yml` instrumentation lands in part 2 (separate PR). |

## Stage 68 — fix: emitter ingests to the Axiom EU edge endpoint; drop setup workflow

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: point Axiom ingest at the **edge** endpoint `https://eu-central-1.aws.edge.axiom.co/v1/ingest/factory-events` — verified live by `_axiom-setup.yml` (`{"ingested":1,"failed":0}`). The `factory-events` dataset is on the EU edge deployment, which serves only the `/v1/ingest/<dataset>` path (the `/v1/datasets/<ds>/ingest` shape 404s there) and accepts only `xaat-` API tokens (now stored in `axiom-api-key`; PATs can't ingest). Removes the one-shot `.github/workflows/_axiom-setup.yml` now that it has minted + stored the token. Closes the Axiom leg of the observability pilot (DoD #2). |

## Stage 67 — fix: Axiom setup workflow ingests at the EU edge host

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `_axiom-setup.yml`: server-side probes proved the pilot's Axiom failures were a multi-region issue — PATs can't ingest (only `xaat-` API tokens can), and the `factory-events` dataset sits on an EU **edge deployment** (`cloud.eu-central-1.aws`), so ingest must target the edge host `eu-central-1.aws.edge.axiom.co`, not `api.eu.axiom.co` (403) or `api.axiom.co` (400 region). The workflow now derives the edge host from the org's `defaultEdgeDeployment`, mints the scoped API token on the control plane, verifies ingest at the edge host (both path shapes), and stores it as the latest `axiom-api-key`. `emit-event.sh` gets pointed at the edge host next, once the workflow confirms the exact URL. |

## Stage 66 — chore: one-shot Axiom setup workflow (scoped ingest token)

| PR | Type | Summary |
|---|---|---|
| TBD | chore | One-shot `.github/workflows/_axiom-setup.yml` (`workflow_dispatch`, deleted after use): reads `axiom-pat` (a Personal Access Token) from SM via the broker SA (WIF) and, server-side, probes Axiom (org/region/method), creates a **scoped API token** (`ingest`+`query` on `factory-events`) via `POST /v2/tokens`, verifies it can ingest, and stores it as the latest `axiom-api-key` version. Resolves the pilot's Axiom 403: a PAT requires the `x-axiom-org-id` header for ingest, whereas a scoped API token works with `Authorization: Bearer` alone — which is exactly what `emit-event.sh` sends. Prints only http codes/ids/lengths; token values masked, never logged. |

## Stage 65 — fix: Axiom ingest targets the EU region host

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: switch the Axiom ingest host from `api.axiom.co` (US) to `api.eu.axiom.co` (EU). The Stage 64 error-body logging revealed the exact cause — `HTTP 400 "ingest is only allowed into datasets in the primary region: dataset region: cloud.eu-central-1.aws, deployment region: cloud.us-east-1.aws"` — i.e. the org + `factory-events` dataset live in EU, so ingest must hit the EU data-plane host. Auth/console stay on the global US control plane, which is why the token authenticated against the US host (401→404→400 progression). One-line host change; closes the Axiom leg of the observability pilot. |

## Stage 64 — fix: log Axiom's error body on ingest failure

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: the Axiom ingest call discarded the response body (`-o /dev/null`), so a non-2xx surfaced only as `http='CODE'` with no reason. Now captures the body and prints `[event] axiom='failed' http='CODE' detail='…'` (truncated to one line; the token is in the header, so no secret leaks). Turns an opaque 4xx into a diagnosable one — prompted by a live `http='400'` on the pilot after the token (401) and dataset (404) issues were resolved. Soft-fail unchanged. |

## Stage 63 — feat: observability foundation (Phase A)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability foundation (**Phase A**, infrastructure only): `scripts/emit-event.sh` + `scripts/lib/event-formatter.sh` + `scripts/lib/linear-issue.sh` emit one OTel-SemConv-shaped event and fan it out **soft-fail** to **Axiom** (always; `factory-events` dataset), **Telegram** (severity `warning\|error\|critical`, unchanged channel), and **Linear** (severity `error\|critical` or `action_required=true`; 24h dedup, `auto-created` label, operator's existing `linear-api-key` — no separate bot user). Each destination fails independently and a structured `[event] …` safety-net line is always printed. New `.github/workflows/observability-pilot.yml` (manual `workflow_dispatch`) smoke-tests the pipeline end-to-end; Hebrew docs in `docs/observability.md`. Removes the one-shot `_verify-observability-secrets.yml` (Stage 62) now that broker-SA read access is confirmed. No existing workflow/script/template touched. Older stages (≤55) moved to `docs/changelog-archive/`. |

## Stage 62 — chore: verify broker SA can read the observability secrets

| PR | Type | Summary |
|---|---|---|
| TBD | chore | One-shot `.github/workflows/_verify-observability-secrets.yml` (`workflow_dispatch`, deleted in the Phase A foundation PR): confirms the broker SA can read the six observability secrets from `or-factory-master-control` SM (Axiom, Better Stack, Linear ×2, Telegram ×2) — masks each value, prints length only, never echoes it. Pinned actions, `permissions: {}`, runs on `main` only. Phase A pre-flight before the `emit-event.sh` foundation PR. |

## Stage 61 — fix: Railway projectCreate 504-safe recovery (no orphan, no duplicate)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: a transient Railway `projectCreate` **504** (seen live on `factory-test-102`) creates the project on Railway's side but the id never returns, so the deploy bailed (`projectCreate returned no id`) leaving an orphan that a re-run couldn't reuse — the scoped token returned 0 from `workspace(id).projects` and `projects(first:100)`, so find-by-name failed and a re-run would create a **duplicate**. Root cause: wrong query shape. Verified that `me { workspaces { projects } }` (a different resolver path) *does* list the projects this token can see. Fix: new `_find_project_by_name` helper queries the `me.workspaces` path first (then the two old shapes as fallback); the project step uses it for find-by-name, and on a `projectCreate` that returns no id it now **polls (6×10s) to adopt the project the timed-out call created** rather than failing or blind-recreating. If nothing becomes visible it fails loud with exact remediation (check for an orphan, decommission, re-run) — never creating a duplicate. Makes both 504 recovery and ordinary re-run idempotency self-healing. `bash -n` + `shellcheck --severity=error` clean. Template edit reaches newly-provisioned systems only. |

## Stage 60 — docs: finalize Phase D (per-system Caddy gateway done)

| PR | Type | Summary |
|---|---|---|
| TBD | docs | Phase D documentation finalization (PR 4), after the gateway was verified end-to-end on `factory-test-103` (fresh deploy + idempotency re-run: Caddy deployment count unchanged, public gateway serving, no `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, Caddy access-logging). `CLAUDE.md`: the `deploy-railway-cloudflare.yml` row now describes the completed gateway — Caddy as a third Railway service owning the public domain, constant-time HMAC + per-IP rate-limit on `/webhook/*`, n8n private and proxied (UI/`/rest/*` guarded by n8n's own auth), the new per-system SM keys (`webhook-hmac-secret`, `caddy-railway-service-id`, `caddy-railway-url`), `N8N_PROXY_HOPS=1`, and the `CADDY_FIRST_TIME` re-run no-op. `docs/roadmap.md`: Phase D marked **done** (PRs 1–4 + the hardening fix ticked). `skills/build-system/SKILL.md`: the post-provision deploy handoff now notes the gateway provision + domain swap. Docs-only; no behaviour change. |

## Stage 59 — fix: gateway hardening (re-run idempotency, n8n proxy trust, Caddy access log)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Three targeted fixes after Phase D PR 3 end-to-end testing on `factory-test-101`. (1) **Caddy re-run idempotency** (`CADDY_FIRST_TIME` guard): the "Provision Caddy" step called `_upsert_collection` unconditionally every run; on the re-run it re-upserted identical env vars, triggering a new Caddy deployment that got stuck (Railway scheduler throttle — "Starting Container" + zero logs), removing the healthy deployment and returning `403 host_not_allowed` on every public URL. Fix mirrors the existing `PG_FIRST_TIME` pattern: `CADDY_FIRST_TIME=false` at step start, `CADDY_FIRST_TIME=true` only on `serviceCreate`, upsert wrapped in `if [ "$CADDY_FIRST_TIME" = "true" ]` — re-runs skip the upsert and leave the live gateway untouched. (2) **n8n proxy trust** (`N8N_PROXY_HOPS: "1"`): n8n behind Caddy logged `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` because express-rate-limit saw `X-Forwarded-For` but `trust proxy` was off. Adding `N8N_PROXY_HOPS: "1"` to the n8n env upsert clears the error and gives n8n the correct client IP. (3) **Caddy per-site access log**: the global `log` block only configured the Caddy runtime logger; per-request access logs were missing (hampered debugging). Added a `log { output stdout; format console }` block inside the `:{$PORT:8080}` site block. Validated with `caddy fmt` + `caddy validate --config Caddyfile --adapter caddyfile`. Template edits reach newly-provisioned systems only. |

## Stage 58 — feat: swap the public domain from n8n to Caddy (Phase D PR 3)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Final Phase D wiring. `deploy-railway-cloudflare.yml` moves `n8n-<system>.or-infra.com` off n8n onto the Caddy service so all public traffic flows through the gateway; n8n keeps no public domain. New idempotent steps after the n8n setup: pre-flight (Caddy `/health` + n8n `/healthz`, hard-fail before touching the domain) → determine ownership → `customDomainCreate` on Caddy (detach-from-n8n-first if Railway rejects "domain in use") → repoint the Cloudflare CNAME + `_railway-verify` TXT to Caddy → detach from n8n → wait for LE cert ISSUED on Caddy → end-to-end smoke (public `/webhook` no-HMAC→401, valid-HMAC→reaches n8n, n8n UI/`/healthz` reachable via Caddy). The Provision step gained a guard so a migrated re-run never re-attaches the domain to n8n. **Caddyfile**: the non-webhook fallback now `reverse_proxy`s to n8n (n8n's own auth guards the UI + `/rest/*`; only `/webhook/*` is HMAC-gated), so the operator UI, the deploy's own `/rest/*` steps, and `configure-agent-router.yml` keep working once Caddy fronts the domain. Brief downtime during cert issuance. Template edit reaches newly-provisioned systems only. |

## Stage 57 — fix: push the large deploy workflow via file, not CLI args (Phase D)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | PR 2 grew `deploy-railway-cloudflare.yml` past ~110 KB; its base64 (~147 KB) exceeds Linux's ~128 KB single-arg cap, so `provision-system.yml`'s scaffold-push step died with `jq: Argument list too long` (caught live on `gateway-test-1`). Now passes the base64 to `jq --rawfile` and the body to `curl --data-binary @file` — size-robust. |

## Stage 56 — fix: scaffold the Caddy gateway files into provisioned system repos (Phase D)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Phase D PR 1 added `templates/system/{Caddyfile,Dockerfile.caddy,caddy/hmacguard}` and PR 2 builds the Caddy service from the system's own repo (`source:{repo}`), but `provision-system.yml`'s scaffold step only pushed `.claude/`, `workflows/`, `configure-agent-router.yml`, and `deploy-railway-cloudflare.yml` — so the gateway sources never reached the system repo and Railway's repo build had nothing to build. The scaffold push now also copies `Caddyfile` + `Dockerfile.caddy` + `caddy/` into the repo root (with presence guards) and stages them in the same commit, so a freshly-provisioned system carries everything the Caddy image build needs. Scaffold edit; reaches newly-provisioned systems only. |

## Stage 55 — feat: deploy creates Caddy as a third Railway service (Phase D, PR 2)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `deploy-railway-cloudflare.yml` now provisions a **Caddy gateway** as a third Railway service (added after the n8n owner-account step, so n8n is confirmed serving before the smoke test). Generates/reads a per-system `webhook-hmac-secret` in SM (idempotent + masked, mirrors `n8n-encryption-key`); `serviceCreate`s a `caddy` service from the system's own repo (`source:{repo}`, building `Dockerfile.caddy` via `RAILWAY_DOCKERFILE_PATH` — Railway's GitHub integration has `edri2or` access, verified); upserts `HMAC_SECRET`/`RATE_LIMIT_BURST=50`/`RATE_LIMIT_WINDOW=10s`/`PORT=8080` in one collection; assigns a Railway `*.up.railway.app` subdomain; runs 3 hard-gated smoke tests (`/health`→200, `/webhook` no-HMAC→401, valid-HMAC→non-5xx reaching n8n) + a Hebrew summary. **n8n keeps its public domain** — the swap is PR 3. Idempotent (SM-first `caddy-railway-service-id`/`caddy-railway-url`). `provision-system.yml` pre-creates the 3 new secret shells (deploy-sa adds versions but can't create secrets). Template edit reaches newly-provisioned systems only. |

## Stage 54 — feat: Caddyfile + constant-time HMAC module template for the per-system gateway (Phase D, PR 1)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | First PR of **Phase D** (per-system gateway). Adds, under `templates/system/`: a `Caddyfile`, a `Dockerfile.caddy` (multi-stage `caddy:2.11-builder` → `caddy:2.11-alpine`, built via `xcaddy`), and a small custom Caddy module `caddy/hmacguard` that verifies an HMAC-SHA256 signature over the request body with a **constant-time** compare (`hmac.Equal`) — chosen over the unmaintained off-the-shelf `abiosoft/caddy-hmac` (9★, non-constant-time matcher); `forward_auth`/`exec` can't verify a body HMAC. The gateway listens on `:$PORT` (8080) with `auto_https off`/`admin off`, serves `/health`→`200 ok`, and on `/webhook/*` rate-limits per source IP (`mholt/caddy-ratelimit`) then HMAC-verifies before `reverse_proxy` to `n8n.railway.internal:5678` (Host preserved); any other path → 404. Built + `caddy validate`d + runtime-smoke-tested locally (health 200, missing/bad HMAC → 401, valid HMAC → reaches proxy, other → 404). **No behaviour change** — no workflow references these files yet, so the factory still produces identical systems; wiring lands in PR 2. Template edit reaches newly-provisioned systems only. |

## Stage 53b — chore: one-shot workflow to capture the test bot token default

| PR | Type | Summary |
|---|---|---|
| TBD | chore | `seed-test-bot-token.yml` (manual `workflow_dispatch`, broker WIF): copies the latest `n8n-telegram-bot-token` from a test project into `n8n-telegram-bot-token-test` in control SM — server-side, value never logged, idempotent. One-click capture that activates the Stage 53 auto-seed. |

## Stage 53 — feat: test systems auto-seed the per-system Telegram bot token

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Test systems (reuse mode) left `n8n-telegram-bot-token` an empty shell, so the operator re-pasted the same test bot token on every test provision. The token is now kept once as `n8n-telegram-bot-token-test` in control SM (added to the `copy-generic-secrets.sh` `EXCLUDE` so it never reaches a tenant project), and `provision-system.yml` gains a reuse-mode-only seed that fills `n8n-telegram-bot-token` from it when empty — masked, only-when-empty, never reseeds (mirrors the existing `n8n-telegram-chat-id` seed). Real systems are untouched (they keep getting their own distinct bot). |

## Stage 51c — feat: Macro-F1 CI gate for the Agent Router classifier

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Deterministic Macro-F1 ≥ 0.85 gate protecting the classifier prompt from regression. `tests/router_battery.yaml`: 250 labeled cases (50 each `ops`/`code`/`research`/`infra`/`unknown`, ~60% Hebrew / 40% English, ~20% adversarial/out-of-scope). `scripts/eval_router.py`: reads the EXACT classifier system prompt + model (`openai/gpt-5-nano`, temp 0) straight out of `agent-router.json`, mirrors the `Sanitize Input` normalisation + the `Build Dispatch` parse logic (robust JSON extract → allowlist clamp → `unknown`), calls OpenRouter `/chat/completions`, and scores macro-F1 with scikit-learn (`report.json`: per-class P/R/F1 + confusion matrix + misclassified). Threshold 0.85 is hard-pinned — never lowered (stage6 Safety Rule #4). |
| TBD | feature | WIF-only hybrid gate, split into two workflows because `check-no-privileged-pr-workflows.sh` greps file-wide for `pull_request`+`id-token:write`: `eval-agent-router-precheck.yml` (PR-triggered, `contents:read` only) runs `eval_router.py --check` — battery integrity + JSON-output-instruction presence — gating every PR with no secret; `eval-agent-router.yml` (`workflow_dispatch` + `push:main`, `id-token:write`) authenticates broker-SA WIF, reads/mints a small-budget `openrouter-eval-key` in the control SM, runs the 250-call LLM eval, uploads `report.json`, and writes a Hebrew per-class summary (bands ≥0.90 green / 0.85–0.90 warn / <0.85 FAIL). |
| TBD | docs | Captured 51b's live 4/4 routing checkpoint on `factory-test-61` (provision → deploy → configure → 4 distinct on-persona probes, each its own n8n success execution) before building the gate. `stage6-multi-agent.md` (both copies), `docs/openrouter-integration.md`, and `docs/roadmap.md` now point at the live gate files (`tests/router_battery.yaml`, `scripts/eval_router.py`, `.github/workflows/eval-agent-router*.yml`). |

## Stage 51b — feat: code/research/infra sub-agents (router routes all 5 intents)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | The router classified into 5 intents but only `ops`/`unknown` had a sub-workflow; `code`/`research`/`infra` fell through to the `unknown` fallback. Added `templates/system/workflows/n8n/{code,research,infra}-agent.json` — tool-less sub-agents copied verbatim from `unknown-agent.json` (`executeWorkflowTrigger` → `chainLlm` v1.5 → `Set` v3.4), differing only in name, model, persona, and node-ID prefix (`d`/`e`/`f`). Models pinned per the research doc: code + research on `anthropic/claude-haiku-4.5`, infra on `openai/gpt-5-mini` (all temp 0.3, **no** `maxTokens`). infra is READ-ONLY/advisory (writes need HITL — deferred). Per-agent domain tools (research `web_search`; infra read-only Railway/Cloudflare) are a focused follow-up. |
| TBD | feature | `agent-router.json`: the `Route by Intent` Switch went from 1 rule (`ops`) + fallback to **4 rules** (`ops`/`code`/`research`/`infra`, each `intent==X` AND `confidence>=0.7`, filter v2) + `unknown` fallback (outputs 0–4). Added 3 `executeWorkflow` v1.1 Call nodes (`@@SUB_{CODE,RESEARCH,INFRA}_WF_ID@@`); `Route by Intent.main` now has 5 entries in rule order + fallback last, every Call node → `Egress Validation`. No output parser, no Respond node, `responseMode:lastNode` unchanged. |
| TBD | feature | `configure-agent-router.yml`: the sub-agent upsert loop now also creates `code`/`research`/`infra` (BEFORE the router) and captures `SUB_{CODE,RESEARCH,INFRA}_WF_ID`; the router `sed` resolves those three placeholders with the real IDs instead of blanking them. The new JSONs carry only `@@CRED_OPENROUTER_ID@@` (the `@@CRED_N8N_API_ID@@`/`@@N8N_DOMAIN@@` subs are harmless no-ops on them). Still activates ONLY the router — all 5 sub-agents stay inactive-by-design (Execute-Workflow-Trigger). Hebrew summary lists all 5 sub-IDs + models. |
| TBD | docs | `stage6-multi-agent.md` (both copies) + `docs/openrouter-integration.md`: note code/research/infra now implemented (tool-less this increment; domain tools a follow-up). `provision-system.yml` untouched — its scaffold `cp -r` globs the whole `workflows/` tree, so the 3 new JSONs ship automatically. Stage 51c (Macro-F1 CI gate) stays blocked until 51b is verified live. |

## Stage 51b — feat: ops-agent answers from live n8n data (Tools Agent + HTTP tool)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | The Stage 51a ops-agent was a tool-less `chainLlm` → generic replies ("can't access live data"). Converted it to a **Tools Agent** (`@n8n/n8n-nodes-langchain.agent` v2.2) with an **HTTP Request tool** (`@n8n/n8n-nodes-langchain.toolHttpRequest` v1.1, `ai_tool`) that calls the system's OWN n8n Public API (`GET /api/v1/workflows`) via an `httpHeaderAuth` credential — so it answers "which workflows are active / system status" from **live data**. `configure-agent-router.yml` now mints/reuses that `httpHeaderAuth` credential from the Stage 52 `n8n-api-key` (key stays out of the workflow JSON) and resolves the new `@@CRED_N8N_API_ID@@` + `@@N8N_DOMAIN@@` placeholders. Node schemas verified against n8n@1.121.0; classifier/router/unknown-agent unchanged. (`code`/`research`/`infra` sub-agents deferred to a later 51b increment. Risk: if `claude-haiku-4.5` tool-calling via OpenRouter is weak, swap the ops model — diagnosable via `inspect_n8n_execution`.) |

## Stage 52 — chore: remove router `_diag` debug + activate only the router

| PR | Type | Summary |
|---|---|---|
| TBD | chore | The Stage 51 router was confirmed working end-to-end on live `factory-test-52a` (POST `/webhook/agent-router` → HTTP 200 + a non-empty Hebrew ops reply, `EXEC status=success`). Removed the temporary `_diag` block from `agent-router.json` egress (its job is done; superseded by `inspect_n8n_execution`). `configure-agent-router.yml` now activates **only** the router (Webhook trigger); the ops/unknown sub-agents are left **inactive by design** (Execute-Workflow-Trigger workflows aren't activatable and are invoked directly by the router), and the job summary says so. |

## Stage 52 — feat: n8n observability (Public API key + MCP tools)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | The Stage 51 debugging exposed that the agent had no exact view of n8n state (it relied on log-scraping + a temporary `_diag` hack). Add structured visibility via the n8n **Public API** (`/api/v1`, `X-N8N-API-KEY`, free in community 1.121): (1) `provision-system.yml` pre-creates an `n8n-api-key` secret shell and grants the broker/MCP SA `secretAccessor` on it; (2) `deploy-railway-cloudflare.yml` mints the key headlessly (`POST /rest/api-keys`, `expiresAt:null` → `rawApiKey` → SM) — idempotent + soft-fail. |
| TBD | feature | MCP server (`services/mcp-server/src/`): `gcp-client.ts` gains `getSecretValue` (reads a secret value via SM `:access`); new `n8n-client.ts` (SSRF-allowlisted fetch with the API key); `tools.ts` gains `list_n8n_workflows` (id/name/**active**/triggerTypes — the authoritative active-state view) and `inspect_n8n_execution` (status + failing node + error message, parsed from `data.resultData.lastNodeExecuted`/`.error`). Takes effect after a `deploy-mcp-server.yml` redeploy. Confirms the 2 inactive sub-agents are expected (Execute-Workflow-Trigger workflows aren't activatable). |

## Stage 51a — fix: remove maxTokens caps (gpt-5-nano reasoning starved the reply to empty)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | The egress `_diag` block on live `factory-test-51e` showed `intent:unknown, confidence:0, sanitized_len:20, sub_reply_len:0` with execution `status=success` — i.e. **both** `openai/gpt-5-nano` calls (classifier + unknown sub-agent) returned **empty completions** while the input arrived intact. Root cause: `gpt-5-nano` is a reasoning model, and the low `maxTokens` caps (100 classifier / 500 sub-agents) were consumed by hidden reasoning tokens, leaving no visible output. Removed the `maxTokens` caps from the classifier + both sub-agents (mirroring the demo workflow, which sets none and works); the egress Code node still bounds the final reply length. |

## Stage 51a — fix: sub-agents reply via Basic LLM Chain (Tools-Agent returned empty)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/workflows/n8n/{ops,unknown}-agent.json`: with the crash fixed, the router returned HTTP 200 but `{"reply":""}` on live `factory-test-51d` (execution `status=success`, sub-agent output empty). The sub-agents used the Tools Agent (`@n8n/n8n-nodes-langchain.agent`) with **no tools attached**, which returned empty output with the pinned models. Switched both sub-agents to a Basic LLM Chain (`chainLlm` — the same node the classifier proves works); `Format Reply` now reads `{{ $json.text \|\| $json.output }}`. Tools arrive in Stage 51b, which can revisit the Tools Agent then. |
| TBD | chore | `agent-router.json`: the egress node temporarily returns a `_diag` block (`intent`, `confidence`, `sanitized_len`, `sub_keys`, `sub_reply_len`) so the live smoke body pinpoints any remaining empty-reply cause. Removed once the router is confirmed returning a non-empty reply. |
