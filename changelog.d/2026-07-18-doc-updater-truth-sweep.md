# Changelog fragment — doc-updater-truth-sweep (2026-07-18)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of the head
> of `CHANGELOG.md`. Folded into `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## docs: truth-sweep — realign docs to the real post-fold code state

| Type | Summary |
|---|---|
| docs | Ran `/doc-updater` "על כל מה שתמצא" under `/truth-protocol`: verified every doc claim against ground truth (real `.github/workflows/`, `scripts/`, `services/mcp-server/src/`, `templates/`) and fixed the confirmed drift. **`README.md`** no longer lists `OIL auto-fix` among removed machinery — `services/mcp-server/src/oil-autofix.ts` exists and is wired, so it is deliberately kept (matching `CLAUDE.md`). **`CLAUDE.md`** MCP section now names **two** write-side tools — `dispatch_workflow` (the only cross-repo write) and `emit_event` (writes only to Axiom/Telegram/Linear) — instead of claiming "one WRITE tool"; also surfaces `verify_mcp_server` (excluded by the `verify_*_system` glob) and corrects the tool ids `list_pull_requests`/`get_pull_request` + `list_repo_variables`. **`docs/observability.md` §9** gets a ⚠️ note + extended banner marking the removed-with-the-machine pieces (`factory-health-audit.yml`, `system-runtime-audit.yml`, `_verify-bs-webhook.yml`, `bs-incidents-to-telegram.yml`, `_verify-sentry.yml`, `scripts/create-uptime-monitor.sh`, `observability-pilot.yml`) as history — resolving the direct contradiction with `CLAUDE.md` over `bs-incidents-to-telegram.yml` — while keeping the still-live pieces (`emit_event`, openrouter-audit emit, Sentry via `instrument.ts`) accurate. **`docs/parallel-development.md` §B** and **`docs/agent-isolation-testing.md`** / **`docs/capability-first.md`** get their historical banners extended/added to name the removed workflows/templates they still reference (`prove-on-test-system.yml`, `refresh-system-agents.yml`, `e2e-verify.yml`, `deploy-verify.yml`, `templates/agent-design-spec.md`, `set-workflow-active.yml`). |

## fix: correct the self-contradicting write-tool comment in the gateway

| Type | Summary |
|---|---|
| fix | `services/mcp-server/src/tools.ts` — the `dispatch_workflow` description called itself "the only WRITE tool on the server" although `emit_event` (same file) also writes; reworded to "the only cross-repo WRITE tool … (emit_event also writes, but only to the observability sinks)". Description string only — no behaviour change. Two items were left unfixed on purpose (truth-protocol: not verifiable from the repo): the `5b6e937f-…` MCP-server id on `CLAUDE.md`'s MCP line vs the live `20d5b7f9-…` connector id, and the infra counts (e.g. factory-test-8 "83 secrets") — both need a live MCP check before any edit. |
