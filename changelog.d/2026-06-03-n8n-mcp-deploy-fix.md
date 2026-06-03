## fix: multi-container MCP deploy — move --quiet before the first --container

| Type | Summary |
|---|---|
| fix | The first deploy of the n8n-mcp gateway+sidecar (run 26905243218) failed at the Cloud Run step with `unrecognized arguments: --quiet`: in a multi-container `gcloud run deploy`, every flag after a `--container NAME` is parsed as that container's arg, so the trailing global `--quiet` was (mis)attributed to the `n8nmcp` sidecar group. Move `--quiet` into the service-level flag block (before the first `--container`). Secret-mint, image build/push, and the per-container specs were all already correct — only the global-flag placement was wrong. |
