# Changelog fragment — hitl-tool-call-fix (2026-05-31)

## fix: hitl-write-actions — force the bot to CALL request_write_action, not narrate it

| Type | Summary |
|---|---|
| fix | `templates/system/workflows/n8n/unknown-agent.json`: add a CRITICAL "CALL, DON'T DESCRIBE" rule to the system prompt. Live testing on factory-test-030 showed Haiku narrated the HITL approval step in prose ("I need to send an approval request, please approve") instead of calling `request_write_action`, so no ✅/❌ buttons were sent. The rule forbids announcing/asking-to-approve without calling the tool, and instructs the model to call it immediately once it has the target_id. Verified live on factory-test-030 before this back-port. |
