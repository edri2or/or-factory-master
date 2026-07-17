## Archived-repo cleanup — deleted 20 decommissioned repos (Telegram-gated)

Deleted 20 long-archived `edri2or/*` repos at Or's request, via `propose-repo-delete.yml` + his
Telegram ✅ (run 29550153462) — the sanctioned AI-proposes / human-approves path; nothing was
deleted by the workflow itself. Verified with `list_repos`: all 20 gone, the 8 live repos intact
(`or-factory-master`, `or-aios`, `or-edri-4`, `or-edri-base`, `research-database`, `learn-or-s-think`,
`architecture-test`, `ripo-skills-main`).

Deleted: 16 throwaway test systems (`factory-test-actmin`, `gmcp-test-01`,
`factory-test-045/046/047/048/049/050/051/052/053/054/060/061/398`, `or-test-fanout`) + 4 older
decommissioned attempts (`or-adhd-agent`, `or-tok`, `tokile`, `or-edri-2`).

**Reconciled the record (this is the point of the entry):**
- `docs/roadmap.md` #6 + the operational note: recorded that the repos are gone. Follow-up 6 (move
  the shared Google OAuth redirect URI off `or-adhd-agent`) **stays open** — the redirect URI is a
  Google-console config, independent of the repo, and still points at the dead `n8n-or-adhd-agent`
  domain.
- **The shared Google identity was re-proven healthy after the deletion** (`google-mcp-smoke` run
  29578335037, live read PASS): it lives in GCP SM (`factory-test-7`, still ACTIVE) + the gateway,
  not in the deleted repo, so the repo deletion could not and did not touch it. `factory-test-7`
  must stay for that reason.

**Known follow-up (flagged, not fixed here — changing it triggers an MCP redeploy):** a few code
defaults still point at the now-deleted `or-adhd-agent` system name — `N8N_DEV_ALLOWED_SYSTEMS`
fallback in `services/mcp-server/src/n8n-mcp-proxy.ts`, and the `SMOKE_SYSTEM` default in
`scripts/factory-mcp-smoke.py` (the `n8n-mcp-smoke.py` default was already moved to `or-edri-4`).
These are overridden in practice (dispatch inputs / `N8N_DEV_ALLOWED_SYSTEMS="*"`), so nothing is
broken, but they should be repointed to `or-edri-4` next time the MCP server is touched.
