# Changelog fragment — hitl-write-actions (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments may run in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: hitl-write-actions — extend pending_actions schema for HITL write actions (Stage A)

| Type | Summary |
|---|---|
| feat | `templates/system/workflows/n8n/db-setup.json`: extend `pending_actions` with HITL columns (`action_type`, `requester`, `approver`, `target_system`, `target_id`, `normalized_payload` JSONB, `human_summary`, `expires_at`, `approved_at`, `executed_at`, `error_record` JSONB, `idempotency_key`) via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; add a unique index on `idempotency_key` and an index on `expires_at`. Non-breaking, provision-only (new systems). |
