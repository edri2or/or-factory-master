## docs(templates): document the google_workspace tool in the system AGENTS template (dev-stage)

**Overview.** Stage 3 of `devplans/or-edri-4-liveness-anti-drift.md`. The audit found
the `google_workspace` tool (Gmail/Calendar/Drive/Docs, wired into `ops-agent`) was
**live but undocumented**, and a stale "no write tools yet" note. Closes that doc-drift.

| Type | Summary |
|---|---|
| docs | `templates/system/AGENTS.md.template`: add a `google_workspace` bullet to the System-aware tools section — reads free, writes (send email / calendar / Drive) HITL-gated via `request_write_action`, on the shared `edriorp38@or-infra.com` infra mailbox, gated on `workspace-mcp-bearer`. Add it to the soft-fail stripping note. |
| docs | Correct the stale "HITL for write actions — there are no write tools yet" Deferred note: HITL writes are now LIVE (`request_write_action` + `pending-actions-executor`), used by `google_workspace` writes and run/activate-workflow ops. |
| chore | Refresh `tests/golden/system/` (MANIFEST.sha256 + rendered/AGENTS.md) to match the template edit (golden-sync gate). |
