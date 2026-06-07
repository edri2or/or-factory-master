- **fix(mcp): keep the n8n-mcp gateway sidecar alive so MCP sessions stop dropping.**
  The `n8nmcp` sidecar in `factory-master-actions-mcp` holds every MCP session in
  instance RAM, so any sidecar restart silently disconnects all connected clients
  ("Session not found or expired" → the connector shows as disconnected). Live logs
  caught the sidecar OOM-restarting 44 min into a revision's life (a fresh
  `Database initialized from /app/data/nodes.db` mid-day, followed by `400`s on
  `POST /n8n/<system>/mcp`). The prior fix (#317: minScale/maxScale 1 + sessionAffinity)
  only guaranteed one warm copy — not that the copy survives. `render-mcp-service-yaml.sh`
  now (a) adds `run.googleapis.com/cpu-throttling: "false"` so the pinned warm instance
  gets always-allocated CPU (no mid-session reclaim/stall) and (b) raises the sidecar
  memory `512Mi → 1Gi` to stop the OOM-kill. Config-only; no proxy-logic change.
