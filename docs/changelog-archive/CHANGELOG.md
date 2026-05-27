# Changelog — archive

Older stages were moved out of the root `CHANGELOG.md` to keep it under the 20 KB CI cap (`scripts/check-changelog-size.sh`). The newest stages live in [`../../CHANGELOG.md`](../../CHANGELOG.md).

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
