- **fix(mcp): transparent session recovery in the n8n-mcp gateway — stop "Session not found or expired".**
  The `n8nmcp` sidecar reaps idle MCP sessions after a few minutes, and real
  clients (incl. Claude — anthropic/claude-code#60949/#27142) don't reliably
  re-initialize on the resulting `400`, so the connector just shows as
  disconnected. `n8n-mcp-proxy.ts` now keeps each client's session STABLE: it
  remembers the client's `initialize` payload, and on an upstream session-expiry
  (`400/404` whose body says the session is gone) it transparently re-initializes
  a fresh upstream session, replays the original request, and returns the result
  under the same client-facing session id — the client never sees the drop. The
  happy path (200/SSE) is untouched (only 400/404 JSON error bodies are buffered
  + inspected); recovery is serialized per client; the session map is bounded and
  cleaned on `DELETE`. New pure helpers `isInitialize` / `looksLikeSessionExpired`
  are unit-tested. Complements the CPU/1Gi restart fix (#341).
