## fix: github-readonly — use $getWorkflowStaticData (n8n API), not $getStaticData

| Type | Summary |
|---|---|
| fix | Live-test follow-up to the ops-agent-live-telemetry development. On a freshly provisioned test system (`factory-test-022`) the `github_readonly` tool crashed at the `Token Cache Check` Code node with `$getStaticData is not defined` — the token cache (and therefore the whole GitHub path) never ran, so the ops-agent told the operator it "can't access GitHub". Root cause: the Code node used `$getStaticData('global')`, which is not an n8n built-in; the correct accessor for cross-execution workflow static data is `$getWorkflowStaticData('global')`. Fixed both occurrences in `templates/system/workflows/n8n/github-readonly.json` (`Token Cache Check` + `Cache Token`). `railway_readonly` was verified working live on the same system (real deploy status returned), so only the GitHub cache path was affected. Template-only; affects systems provisioned after this fix. |
