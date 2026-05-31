# Changelog fragment — hitl-write-actions (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments may run in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: hitl-write-actions — extend pending_actions schema for HITL write actions (Stage A)

| Type | Summary |
|---|---|
| feat | `templates/system/workflows/n8n/db-setup.json`: extend `pending_actions` with HITL columns (`action_type`, `requester`, `approver`, `target_system`, `target_id`, `normalized_payload` JSONB, `human_summary`, `expires_at`, `approved_at`, `executed_at`, `error_record` JSONB, `idempotency_key`) via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; add a unique index on `idempotency_key` and an index on `expires_at`. Non-breaking, provision-only (new systems). |

## feat: hitl-write-actions — pending-actions-executor subworkflow (n8n activate/deactivate) (Stage B)

| Type | Summary |
|---|---|
| feat | New `templates/system/workflows/n8n/pending-actions-executor.json`: HITL execution subworkflow. Receives an approved `pending_actions` id, atomically locks the row (`UPDATE … WHERE id=… AND status='pending' RETURNING *` — double-click safe), switches on `target_system`, and (Stage B) activates/deactivates an n8n workflow via the Public API (`POST /api/v1/workflows/{id}/{activate\|deactivate}`, `X-N8N-API-KEY`), then marks `done`/`failed` (+`error_record` jsonb) and reports ✅/❌ to Telegram. GitHub branch follows in Stage E. |
| feat | `templates/system/.github/workflows/configure-agent-router.yml`: install the executor (section 5g) via `_upsert_wf` (inactive subworkflow), gated on Postgres + n8n-API + Telegram credentials, soft-fail; capture its id for the `@@WF_PENDING_EXECUTOR_ID@@` substitution tg-inbound consumes in Stage C. |
| chore | `monitoring/registry-exempt.txt`: exempt `pending-actions-executor.json` from the watchdog-registry gate — an on-demand Execute-Workflow sub-workflow has no own schedule/trigger to prove; its executions are covered collectively by the `system-n8n-executions` registry entry. |

## feat: hitl-write-actions — wire approval callbacks in tg-inbound (Stage C) (Stage C)

| Type | Summary |
|---|---|
| feat | `templates/system/workflows/n8n/tg-inbound.json`: detect HITL approval presses in Extract & Normalize (`app:<id>`/`rej:<id>` → `route`/`is_approve`/`action_id`, plus `callback_id`/`message_id`); add a "Route Update" switch after Dedup Guard that sends approval presses through Answer Callback (instant ack) → IF approve/reject → editMessageText (closes the buttons) → Run Executor (`@@WF_PENDING_EXECUTOR_ID@@`, on approve) or Mark Rejected (on reject). Non-approval updates keep the existing chat flow (Call Agent Router → Send Reply); `agent-router` is untouched. The `chat_id==@@CHAT_ID@@` check in Extract & Normalize is the from.id allowlist for presses. |
| feat | `templates/system/.github/workflows/configure-agent-router.yml`: substitute `@@WF_PENDING_EXECUTOR_ID@@` into tg-inbound (section 5b); graceful degradation — when the executor isn't installed, jq-strip the whole approval path and restore Dedup Guard → Call Agent Router, so tg-inbound never references a missing sub-workflow id. |

## feat: hitl-write-actions — request_write_action tool + request-write-action sub-workflow (Stage D)

| Type | Summary |
|---|---|
| feat | New `templates/system/workflows/n8n/request-write-action.json`: the LLM-facing request builder. Parses the tool's JSON arg defensively, whitelists (`target_system`∈{n8n,github}; n8n⇒`action_type`∈{activate,deactivate}+`target_id`), inserts a `pending_actions` row (`status='pending'`, `chat_id=@@CHAT_ID@@`, `expires_at=now()+2h`, `idempotency_key`, `ON CONFLICT DO NOTHING RETURNING id`), and sends the operator a Telegram message with inline ✅`app:<id>` / ❌`rej:<id>` buttons. Returns `{ok,status,message}` (pending_approval / duplicate / error). It records + asks — it never executes. |
| feat | `templates/system/workflows/n8n/unknown-agent.json`: add the `request_write_action` toolWorkflow (`@@WF_REQUEST_WRITE_ID@@`) + ai_tool wiring; update the system prompt from "READ-ONLY access" to an "APPROVED WRITE ACTIONS" domain + a rule that writes are allowed only via `request_write_action`, gated on the operator's Telegram approval. |
| feat | `templates/system/.github/workflows/configure-agent-router.yml`: install request-write-action before the sub-agent loop (gated on Postgres + Telegram), substitute `@@WF_REQUEST_WRITE_ID@@` in the loop, strip the tool from unknown-agent when the sub-workflow is absent (graceful degradation), and update the injected SYSTEM-INFO card to `write:"approved-only"` + a `write_actions` entry. |
| chore | `monitoring/registry-exempt.txt`: exempt `request-write-action.json` from the watchdog-registry gate (same rationale as the executor — an on-demand sub-workflow with no own schedule/trigger). |

## feat: hitl-write-actions — GitHub workflow_dispatch branch in the executor (Stage E)

| Type | Summary |
|---|---|
| feat | `templates/system/workflows/n8n/pending-actions-executor.json`: add a GitHub branch to the `target_system` switch — App JWT → repo-scoped installation token (`{repositories:[<repo>],permissions:{actions:write}}`, least-privilege) → `POST /repos/edri2or/<repo>/actions/workflows/{file}/dispatches` with `ref` (default `main`, optional `__ref`) and inputs coerced to strings (≤25). Mint/dispatch errors flow to the existing Build Failure → ❌ path. |
| feat | `templates/system/workflows/n8n/request-write-action.json`: validate `target_system=github` requests (require `target_id` = workflow file; default `action_type=dispatch`; `normalized_payload` carries the workflow_dispatch inputs). |
| feat | `templates/system/workflows/n8n/unknown-agent.json`: extend the `request_write_action` tool description + system-prompt domain 3 to cover running GitHub Actions workflows (target_system `github`, target_id = workflow file, optional inputs). |
| feat | `templates/system/.github/workflows/configure-agent-router.yml`: substitute the GitHub App placeholders (`@@CRED_GITHUB_JWT_ID@@`/`@@GITHUB_APP_ID@@`/`@@GITHUB_INSTALLATION_ID@@`/`@@SYSTEM_NAME@@`) into the executor; when the GitHub App JWT credential is absent, jq-strip the GitHub branch and route github requests to the failure path (n8n unaffected); update the SYSTEM-INFO card's `write_actions` to include GitHub workflow_dispatch. |
