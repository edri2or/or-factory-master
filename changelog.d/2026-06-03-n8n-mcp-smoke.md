## feat: n8n-mcp live-write gateway deployed + autonomous smoke test

| Type | Summary |
|---|---|
| feat | The central n8n-mcp live-write gateway is **live** (Cloud Run rev 00053, gateway + n8n-mcp sidecar). Verified end to end: `/health`=200; `/n8n/or-adhd-agent/mcp` unauthenticated=401 (route live, auth enforced, system allowlisted); `/n8n/<unknown>/mcp`=404 (allowlist isolation). |
| feat | New autonomous proof + regression test: `.github/workflows/n8n-mcp-smoke.yml` + `scripts/n8n-mcp-smoke.py` drive the full loop — mint a system-scoped bearer (admin secret read from Secret Manager via WIF in-step, masked, never in a session), MCP initialize/handshake through the gateway to the internal sidecar, `tools/list` (asserts `n8n_*` tools → multi-tenant header injection accepted), `n8n_health_check` (sidecar → the system's own live n8n), then a live create+delete of a `dev-` scratch workflow. Manual `workflow_dispatch`. |
