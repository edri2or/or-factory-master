# decommission-test-projects: PROTECTED keep-list guard (post-incident)

- **Incident:** on 2026-07-11, `decommission-test-projects.yml` (run 29152717100, inputs
  `factory-test-7,18,22,23,24`) soft-deleted **factory-test-7** — the home of the shared
  Google OAuth client + consent screen used fleet-wide (client `651677607847-…`). Its only
  guard refused the two control projects; `factory-test-7` matched the `factory-test-*`
  pattern and sailed through. It kept working during the 30-day soft-delete grace (Google
  still honored the client), so nothing looked wrong — a fleet-wide, irreversible Google
  outage was pending at hard-purge (~2026-08-10). Restored 2026-07-13 via `gcp-action.yml`
  (`projects undelete factory-test-7`, red → Or's Telegram ✅ → execute run 29274885678);
  verified ACTIVE (`list_gcp_projects`) + `google-mcp-smoke` green (run 29275054707).
- `.github/workflows/decommission-test-projects.yml`: added a **PROTECTED keep-list** to the
  safety gate — hard-refuses `factory-test-7` (OAuth client home), `factory-test-8` (or-aios),
  `factory-test-21` (or-edri-4), `factory-test-25` (sandbox backend), even though all four
  carry test-pattern names. Documented in the file header + inline. Prevents the exact
  recurrence for any of the fleet's live/critical projects.
- Follow-up (separate dev, flagged): migrate the OAuth client off factory-test-7 into the
  control project (the long-deferred `google-door-cleanup` closing item) so it can never sit
  in a deletable test-named project again.
