# Google Workspace MCP sidecar for the factory gateway (Cloud Run multi-container).
# Portless → reachable only at localhost:3002 inside the instance; the public
# gateway proxies /workspace/<system>/mcp to it. Pinned to the version proven in
# the Stage 0a spike. The boot shim pre-seeds the shared single-user credential.
FROM python:3.11-slim

# Pin to the spike-proven release (single-user + streamable-http + read-only flags).
RUN pip install --no-cache-dir "workspace-mcp==1.21.1"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default sidecar config (overridable via the Cloud Run env in render-mcp-service-yaml.sh).
ENV WORKSPACE_MCP_TRANSPORT=streamable-http \
    WORKSPACE_MCP_HOST=0.0.0.0 \
    WORKSPACE_MCP_PORT=3002 \
    WORKSPACE_MCP_CREDENTIALS_DIR=/creds \
    MCP_SINGLE_USER_MODE=1 \
    OAUTHLIB_INSECURE_TRANSPORT=1

ENTRYPOINT ["/entrypoint.sh"]
