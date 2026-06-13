# `workspace-mcp` — Google Workspace MCP sidecar

A single-container sidecar that exposes the [`workspace-mcp`](https://pypi.org/project/workspace-mcp/) Google Workspace MCP server to the factory gateway. It is **not** reached directly — the public `mcp-server` gateway proxies `/workspace/<system>/mcp` to it.

## Purpose

Gives systems Gmail / Calendar / Drive / Docs tools over MCP, served under the shared `or-infra` Google identity (`edriorp38@or-infra.com`). The gateway injects auth server-side; this sidecar holds no public surface.

## How it's served

- **Cloud Run multi-container** — runs alongside the `mcp-server` gateway in `or-factory-master-control`.
- Portless / localhost-only: listens on `localhost:3002` inside the instance (`WORKSPACE_MCP_PORT`).
- Public path: the gateway proxies `/workspace/<system>/mcp` → `localhost:3002`.

## Pinned version

`workspace-mcp==1.21.1` (the release proven in the Stage 0a spike — see `Dockerfile`).

## Boot

`entrypoint.sh` pre-seeds a single-user authorized-user credential file from the shared `gmail-oauth-*` secrets (mounted as env), then launches `workspace-mcp` in single-user `streamable-http` mode. The secret values are written only into the `0600` credential file — never logged. Scopes are env-driven (`WORKSPACE_MCP_SCOPES`) and must stay byte-equal to the grant, or token refresh fails with "Scope has changed".

## References

- `docs/google-identities.md` — which Google account is who (authoritative).
- `CLAUDE.md` — the gateway / Workspace sidecar description (search "Workspace sidecar").
