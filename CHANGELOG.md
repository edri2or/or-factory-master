# Changelog

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
