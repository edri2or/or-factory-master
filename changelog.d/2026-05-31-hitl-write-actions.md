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
