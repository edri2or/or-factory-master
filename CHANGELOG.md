# Changelog

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
