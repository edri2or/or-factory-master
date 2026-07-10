## 2026-07-10 — fix: promote fulfiller couldn't push to the factory (persisted checkout creds)

Live-proof fix (`devplans/system-self-sufficiency-channels.md`, Stage B). The first `promote`
round-trip fetched the doc + refreshed the golden but failed at `git push`: `actions/checkout`
persists the default `GITHUB_TOKEN` as an `http.https://github.com/.extraheader` Authorization,
which overrode the broker App token injected in the push URL. OIL never hit this because it pushes
from a separate `./target` clone; the promote fulfiller pushes from the checked-out factory tree.

- `.github/workflows/fulfill-promote-request.yml`: checkout now uses `persist-credentials: false`,
  and the push step surfaces the real git error (token-scrubbed) instead of swallowing it.

**Proof:** re-run the live `promote` round-trip — the broker's branch push + draft-PR open now
succeed. (Workflow-only change — does NOT touch `services/mcp-server/**`, so no MCP redeploy.)
