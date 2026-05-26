# Changelog

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

## Stage 51a — fix: robust classifier (no throwing output-parser) + configure diagnostics

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/workflows/n8n/agent-router.json`: the classifier paired `chainLlm` with a `Structured Output Parser`, which **throws** on any non-conforming model output and errored the whole router (live `factory-test-51c` returned HTTP 500, surfaced once the lastNode fix stopped masking it). Dropped the parser (`hasOutputParser:false`, removed the node + `ai_outputParser` connection); the classifier returns raw JSON and the `Build Dispatch` Code node parses it inside try/catch → defaults to `intent:unknown, confidence:0` on any failure (graceful; OWASP LLM01 bounded refusal). |
| TBD | chore | `templates/system/.github/workflows/configure-agent-router.yml`: the smoke probe now echoes its HTTP/body and the router's last n8n execution `status` + failing node/message to **stdout** (n8n doesn't log node-level execution errors to container stdout, and `$GITHUB_STEP_SUMMARY` has no REST API), so a runtime router failure is diagnosable from the run logs alone. |

## Stage 51a — fix: Agent Router returns its reply (lastNode, drop Respond-to-Webhook)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/workflows/n8n/agent-router.json`: the router replied with HTTP 200 but an **empty body** — caught live on factory-test-51b via the new POST-capable `probe_endpoint`. Root cause: the webhook used `responseMode: responseNode` + a `Respond to Webhook` node (`firstIncomingItem`), which returned no body, whereas the factory's proven demo-workflow pattern uses `responseMode: lastNode` and returns the final node's JSON directly (the demo webhook returns `{"output":"ok"}`). Switched the router to `lastNode` and made the `Egress Validation` Code node terminal (removed the `Respond to Webhook` node + its connection), so the HTTP response is the egress `{reply}` object. |

## Stage 51a — feat: agent can dispatch + verify the Agent Router end-to-end (MCP)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `services/mcp-server/src/tools.ts`: added `configure-agent-router.yml` to the `dispatch_workflow` allowlist (`DISPATCHABLE_WORKFLOWS`) so the agent can wire the router into a system's n8n itself instead of the operator clicking "Run workflow". It's a per-system, idempotent, soft-fail n8n-config workflow (no GCP/SM writes), so it fits the same risk class as `deploy-railway-cloudflare.yml`. CLAUDE.md allowlist enumerations synced. |
| TBD | feature | `services/mcp-server/src/{probe.ts,tools.ts}`: `probe_endpoint` now supports `method=POST` + `body` + `content_type` + `timeout_ms` (≤60 s), so a verifier can fire a factory webhook end-to-end (e.g. `POST /webhook/agent-router` with a Hebrew prompt) and read the reply — the agent can now self-verify the router instead of relying on the in-workflow smoke probe (whose result only reaches the job summary, which has no REST API). The SSRF host allowlist (`*.or-infra.com` / `*.up.railway.app` / `*.run.app`, https-only) is unchanged and still gates every request. Both require a one-time MCP redeploy (`deploy-mcp-server.yml`) to take effect. |

## Stage 51a — fix: configure-agent-router checkout needs `contents: read`

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/configure-agent-router.yml`: the job declared `permissions: id-token: write` only (copied from deploy, which has no checkout step), so `GITHUB_TOKEN` lost the default `contents: read` and `actions/checkout` failed with `remote: Repository not found` on the private system repo — caught live on the factory-test-51a E2E (run only reached the checkout step). Added `contents: read` to the job permissions. No other change. |

## Stage 51a — feat: Agent Router foundation (router + ops + unknown sub-agents)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `templates/system/workflows/n8n/{agent-router,ops-agent,unknown-agent}.json` — n8n workflow JSONs that scaffold the Stage 6 multi-agent spec. Router: Webhook → Code(sanitize, L2) → `chainLlm` classify (pinned `openai/gpt-5-nano`, temp 0) + Structured Output Parser → `{intent, confidence}` → Code(re-attach `sanitized`) → Switch (ops at confidence ≥ 0.7, else fallback) → `Execute Sub-workflow` → Code(egress, L5: URL allowlist + strip `<script>` + reject `exec(`/`eval(`) → Respond. Sub-agents use `Execute Sub-workflow` (not `agentTool` — n8n issue #22489) via `executeWorkflowTrigger` with `inputSource:passthrough`; ops on `anthropic/claude-haiku-4.5`, unknown on `openai/gpt-5-nano`. Node typeVersions verified against n8n@1.121.0. The existing `factory-master: OpenRouter auto-router demo` workflow is untouched. code/research/infra sub-agents land in Stage 51b. |
| TBD | feature | New `templates/system/.github/workflows/configure-agent-router.yml`: manual-dispatch workflow that loads the 3 JSONs, `sed`-resolves placeholders (`@@CRED_OPENROUTER_ID@@`, `@@SUB_{OPS,UNKNOWN}_WF_ID@@`), creates/updates them in n8n by name (PATCH-or-POST + activate), and fires one Hebrew smoke probe. Mirrors `deploy-railway-cloudflare.yml`'s `_sm_read`/`_login`/`_napi`(retry-on-`000`-only)/`_soft_exit0` helpers, EXIT-trap cleanup, `::add-mask::`, and Hebrew job-summary style; bodies sent via `--data-binary @file`. `provision-system.yml` extended (additively, in the existing `.claude` push step) to also scaffold `workflows/n8n/*.json` + this workflow into every new system repo, with a commit guard for reuse-mode re-provisions. |
| TBD | docs | `stage6-multi-agent.md` (both factory + template copies) refreshed: OWASP mapping → LLM01 + LLM02 + LLM05 (LLM06:2025 Excessive Agency via HITL later); confidence threshold 0.6 → 0.7; classifier `gpt-4o-mini` → pinned `openai/gpt-5-nano`; dispatch via `Execute Sub-workflow` not `agentTool`/HTTP (n8n #22489). `docs/openrouter-integration.md` gains a `## 7. Agent Router` section. Template edits reach newly-provisioned systems only. |

## Stage 50 — ops: persistent OpenRouter keep-list silences the daily audit

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `audit-openrouter-orphan-keys.yml` + new `.github/openrouter-keep.txt`: the Stage 49 `keep_names` protection was dispatch-only, so the daily scheduled run still flagged intentionally-kept orphan keys (e.g. `n8n-railway-production`, `n8n-telegram-bot` — orphan only because no `edri2or/<name>` repo exists) and pinged Telegram every day. Added a committed allowlist file (one name per line, `#` comments) honored by **all** runs (scheduled + dispatch), merged with the `keep_names` input and matched with `grep -qxF` (same normalize idiom as `decommission-railway-projects.yml`). Protected keys are excluded from a new **actionable** tally (orphan+stale minus kept); the Telegram alert and the dry-run delete hint now trigger on `actionable>0` instead of raw orphan/stale, so an all-protected result stays silent. The job summary + `BREAKDOWN:` stdout line now also report `kept` and `actionable`. |

## Stage 49 — ops: audit `keep_names` input protects keys from deletion

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `audit-openrouter-orphan-keys.yml`: added a `keep_names` manual-dispatch input (comma-separated key names) that are **never deleted**, even on a live run. A protected orphan/stale key is reported with action `🔒 Kept (protected)` and counted in a new `kept` tally (job summary + `BREAKDOWN:` stdout line). Lets a real cleanup spare specific keys (e.g. `n8n-railway-production,n8n-telegram-bot`, which are orphan-by-no-repo but may still back a manually-run system) instead of the previous all-orphan-and-stale-or-nothing behavior. Matching is exact per name (wrapped in commas, spaces stripped). No change to dry-run/scheduled behavior when the input is empty. |
