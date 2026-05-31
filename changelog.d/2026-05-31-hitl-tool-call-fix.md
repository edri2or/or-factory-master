# Changelog fragment — hitl-tool-call-fix (2026-05-31)

> Back-port of fixes verified live on factory-test-030: the bot actually sent the ✅/❌
> approval buttons, the operator approved, and the n8n automation was really deactivated
> (confirmed via the n8n API showing `active:false`).

## fix: make the per-system bot reliably CALL request_write_action (HITL), not narrate it

| Type | Summary |
|---|---|
| fix | `templates/system/workflows/n8n/ops-agent.json`: **root cause** — the agent-router routes operational write-intents ("activate/deactivate automation X") to the ops-agent, but `request_write_action` lived only on unknown-agent, so the HITL approval buttons never fired. Per the supervisor/router industry standard (the action tool must live on the specialist that owns the intent), add the `request_write_action` tool to ops-agent (structured input schema), teach its prompt the "CALL, DON'T DESCRIBE" rule, and switch its model to `anthropic/claude-sonnet-4.5` for reliable action-tool calling. |
| fix | `templates/system/workflows/n8n/unknown-agent.json`: add a CRITICAL "CALL, DON'T DESCRIBE" rule to the system prompt; give `request_write_action` a structured input schema (named fields `target_system`/`action_type`/`target_id`/`human_summary` instead of a single JSON string — small models failed to construct the JSON); switch the chat model to `anthropic/claude-sonnet-4.5` (temp 0.3). |
| fix | `templates/system/.github/workflows/configure-agent-router.yml`: extend the graceful-degradation `request_write_action` strip to cover ops-agent (not just unknown-agent), so a system without Postgres/Telegram never references a missing sub-workflow id on either agent. |
