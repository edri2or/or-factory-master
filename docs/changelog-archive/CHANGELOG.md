# Changelog — archive

Older stages were moved out of the root `CHANGELOG.md` to keep it under the 20 KB CI cap (`scripts/check-changelog-size.sh`). The newest stages live in [`../../CHANGELOG.md`](../../CHANGELOG.md).

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
