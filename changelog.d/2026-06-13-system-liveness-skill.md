## feat(skill): /system-liveness — on-demand per-automation truth report (dev-stage)

**Overview.** Stage 4a of `devplans/or-edri-4-liveness-anti-drift.md`. A factory-only
slash command that produces an honest, evidence-based per-workflow liveness report of
a system's live n8n — which automations actually ran, which never ran, which last
failed — using only the read-only MCP tools (`list_n8n_workflows` +
`inspect_n8n_execution`). Answers "מה באמת עובד?" in one command instead of a manual
investigation, and surfaces the exact drift a one-line system-level health probe
misses (a registered-but-never-fired workflow like DB Vacuum).

| Type | Summary |
|---|---|
| feat | Add `.claude/commands/system-liveness.md` (`audience: factory-only`): lists every workflow, proves each with real execution history, classifies proven/never-ran/last-failed/stale/inactive-by-design, cross-checks AGENTS.md claims vs reality, and reports to Or in Hebrew with honesty rules ("ran" ≠ "correct answer"; never ✅ without an execution id). Not mirrored to systems (factory-only). |
