## connector-url-clear Stage 2 — pin the OAuth issuer to the Region URL (one connector address forever)

`deploy-mcp-server.yml` now pins `PUBLIC_BASE_URL` to the deterministic **Region URL**
(`https://${SERVICE}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app`) instead of deriving it from
`gcloud run … status.url` (the `-<hash>.a.run.app` host). The advertised OAuth `issuer` — the URL
claude.ai locks onto during OAuth discovery — therefore becomes the Region URL, the **same** URL
the Claude Code toolbox already uses as `mcp_url`. The two consumers collapse to one address,
removing the split that caused wasted connector-setup rounds.

- `docs/mcp-connector-setup.md`: `EXPECTED_CONNECTOR_ISSUER` flipped to the Region URL; the "why
  two URLs" framing rewritten to "one URL"; added an operator subsection for re-adding an existing
  connector that is still locked on the old hash URL (one-time, per connector).
- `CLAUDE.md`: the `deploy-mcp-server.yml` row and the "Connector URL" gate bullet now state both
  consumers share the Region URL; recommend that one URL.
- The deploy's existing "Read + assert the live connector issuer" step now finds live `issuer` ==
  Region URL == `EXPECTED_CONNECTOR_ISSUER`, so its drift `::warning::` goes silent (PASS).

Control-plane only (no `templates/system/**`, no golden). Non-behavioral. The merge auto-triggers
one live redeploy (push trigger on the workflow file); after it, Or re-adds each existing claude.ai
connector once under the Region URL (accepted, one-time). Closes `devplans/connector-url-clear.md`.
