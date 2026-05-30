# Changelog fragment — ops-agent-live-telemetry (2026-05-30)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md`. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: ops-agent-live-telemetry — railway-readonly sub-workflow (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of live read-only telemetry for the ops-agent. New `templates/system/workflows/n8n/railway-readonly.json` — a `toolWorkflow` sub-workflow (`factory-master: railway-readonly`) built on the exact `postgres-named-queries.json` skeleton: `executeWorkflowTrigger` (passthrough) → `Normalize Input` Code node that accepts the LLM's single RAW STRING arg (`specifyInputSchema:false` pattern, command at `$json.query`) and resolves it to `deploy_status` \| `recent_logs` → `Switch`. `deploy_status` POSTs the Railway GraphQL deployments(first:5) query to `https://backboard.railway.com/graphql/v2`; `recent_logs` first resolves the latest deployment id from that status query (`Pick Latest Deployment` Code node) then POSTs `deploymentLogs`. `Format Output` flattens to `{ ok, command, data }`, keeping `staticUrl`/URLs intact. Auth is a Bearer header credential referenced only by placeholder `@@CRED_RAILWAY_ID@@`; project id is `@@RAILWAY_PROJECT_ID@@`. No secret value is written into the JSON. Read-only throughout (every HTTP node `onError: continueRegularOutput`). Verified locally: `jq .` valid, all three Code nodes pass `node --check`, the GraphQL body parses as JSON. Template-only — affects systems provisioned after this change; no existing system touched. |
