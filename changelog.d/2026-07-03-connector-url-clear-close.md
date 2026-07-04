## connector-url-clear — closed (`completed`); Stage 2 deferred as a separate future task

Closed `devplans/connector-url-clear.md` (`status: completed`, `closed: 2026-07-03`) — the
factory's last active devplan. Stage 1 (merged in PR #495) already delivered the value: the
`deploy-mcp-server.yml` run prints the live claude.ai connector URL, asserts the advertised
OAuth `issuer` against the doc, and `/prove-connector` makes any future connector change a
recognized flow. The original pain — address confusion between the Region URL and the hash
host — is solved.

Stage 2 (pin the `issuer` to the deterministic Region URL) is **deferred**, not dropped.
Truth-protocol research against Google's Cloud Run docs confirmed the legacy hash host is a
*"unique and permanent run.app URL that won't change over time as you deploy new revisions"* —
it is stable across every redeploy and only differs on a full service delete+recreate, an edge
case already covered by Stage 1's live-print mechanism. So Stage 2 is an optional cosmetic
one-address unification, not critical; its cost is proven (the 2026-07-03 `redirect_uri_mismatch`
outage, PR #572 → rolled back in PR #573). It carries a documented hard prerequisite — register
the Region-host redirect URI in the Google OAuth client (`google-oauth-client-*`, console
`edriorp38@or-infra.com`) **before** any re-attempt — recorded in the devplan's Stage 2 entry.

Docs-only, non-behavioral: no code change, no redeploy. After merge, zero devplans remain
`active`.
