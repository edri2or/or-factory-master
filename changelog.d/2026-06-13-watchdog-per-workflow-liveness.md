## feat(watchdog): per-workflow n8n liveness in the morning watchdog (dev-stage)

**Overview.** Stage 4b of `devplans/or-edri-4-liveness-anti-drift.md`. The morning
meta-monitoring watchdog's `n8n-execution` proof only checked ONE latest execution
per system (aggregated to a line) — so a registered-but-never-fired scheduled
workflow (like DB Vacuum) hid behind a healthy sibling. This adds an **additive**
per-workflow liveness proof method that auto-catches "never ran" and "last failed"
at the individual-workflow level. The existing `n8n-execution` method is untouched.

| Type | Summary |
|---|---|
| feat | `scripts/run-watchdog.sh`: add `proof_n8n_workflow_liveness` (+ helpers `_n8n_workflows_json`, `_n8n_wf_exec_status`, `_n8n_workflow_liveness_per_system`) and the `n8n-workflow-liveness` dispatcher case. For each real system it lists workflows and checks each ACTIVE one's latest execution: latest error/crashed → 🚨; an active **schedule-triggered** workflow with zero executions → 🚨 (the DB Vacuum gap); an active webhook/other with no runs → not flagged (may be unused); inactive workflows skipped. Reuses the `n8n-execution` fan-out shape (factory-test-25 skipped, 0 systems → ❓) and the `WATCHDOG_FIXTURE_DIR`/`WATCHDOG_SYSTEMS_OVERRIDE` test hooks. |
| feat | `monitoring/watchdog-registry.json`: register `system-n8n-workflow-liveness` (`type: n8n-workflows`, `proof_method: n8n-workflow-liveness`, stage 4, enabled). |
| test | `scripts/tests/run-watchdog.bats`: 7 new offline cases — ok, last-failed 🚨, scheduled-never-ran 🚨, webhook-never-ran not-🚨, inactive-only ❓, zero-systems ❓, aggregate 🚨. All green locally (`bats scripts/tests/run-watchdog.bats` = 48/48). |
