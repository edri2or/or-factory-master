## fix: mirror n8n-mcp sidecar image into Artifact Registry (Cloud Run can't pull ghcr.io)

| Type | Summary |
|---|---|
| fix | The sidecar deploy (run 26907190322) failed: `spec.template.spec.containers[1].image ... host is one of [region.]gcr.io, [region-]docker.pkg.dev or docker.io but obtained ghcr.io/czlonkowski/n8n-mcp:2.51.2` — Cloud Run cannot pull from GitHub Container Registry. Add a deploy step that mirrors the pinned upstream `ghcr.io/czlonkowski/n8n-mcp:<tag>` into this project's Artifact Registry (`bootstrap-images/n8n-mcp:<tag>`, idempotent docker pull→tag→push) and deploy the AR copy. The workflow env splits into `N8N_MCP_UPSTREAM_IMAGE` (ghcr source) + `N8N_MCP_IMAGE_TAG`; the render script receives the AR image path. |
