## fix: n8n-mcp smoke test now deletes its scratch workflow deterministically

| Type | Summary |
|---|---|
| fix | The first live smoke run proved the full loop but couldn't parse the created workflow's id, leaving a `dev-smoke-*` scratch workflow in the live n8n. Harden `scripts/n8n-mcp-smoke.py`: locate the workflow by name via `n8n_list_workflows` (robust recursive id/name walk over JSON or SSE output) instead of guessing the id from the create response, pre-sweep any leftover `dev-smoke-*` from earlier runs, and assert the scratch workflow is gone after delete — so nothing lingers in the live system. |
