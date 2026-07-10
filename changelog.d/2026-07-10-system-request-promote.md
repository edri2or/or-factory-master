## 2026-07-10 — Reverse channel: `promote` request type (system → factory template)

Staged development (`devplans/system-self-sufficiency-channels.md`, Stage B). Adds the reverse
channel a provisioned system never had: a system can now ASK the broker (Telegram-gated) to
**promote a doc it developed UP into `templates/system/**`** so future systems are born with it.
The broker fetches the doc from the system repo, refreshes the golden, and opens a **DRAFT PR** on
`or-factory-master`; Or reviews + merges. Double-gated (Or ✅ the request, then Or merges the PR),
and the system itself can never write to the factory (its App is repo-locked) — the broker performs
it, exactly the AI-proposes/human-approves spine the other request types use.

- `scripts/validate-system-request.sh`: new `promote` case — `source_path`/`target_path` are safe
  relative paths (no traversal), target must be under `templates/system/`, MVP artifact types =
  docs (`.md`/`.txt`). GCP-project validation is skipped for `promote` (it is GitHub-only).
- `.github/workflows/fulfill-promote-request.yml` (new): two-phase (register = gate + Telegram card;
  fulfill = fetch the doc with a `contents:read` token scoped to the system repo → write under
  `templates/system/` → `check-system-golden.sh --update` → changelog fragment + devplan stub →
  open a draft PR with a `contents:write`+`pull_requests:write` token scoped to `or-factory-master`).
  Reuses the proven OIL PR-opening mechanism (`generate-app-token.sh` → `git push x-access-token` →
  `POST /pulls {draft:true}`). Off the `dispatch_workflow` allowlist (approval-path only).
- `services/mcp-server/src/system-request.ts`: `promote` in the type-guards + a `promote` card
  `actionLine`; a `fulfillWorkflowFor(type)` map routes `promote` to `fulfill-promote-request.yml`
  (and everything else to `fulfill-system-request.yml`) in BOTH the register and fulfill dispatches,
  carrying `source_path`/`target_path`. The value-free `fulfill-system-request.sh` is untouched —
  clean permission boundary (only the new promote workflow holds GitHub write).
- Tests: 9 new `promote` bats cases (47/47 green); MCP `system-request.test.mjs` 6/6; `tsc` clean.
- `monitoring/registry-exempt.txt` + `docs/system-resource-requests.md` updated.

**Decision:** MVP is **docs-only** — a promoted doc cannot execute, the safest artifact for an
automated cross-repo channel; promoting scripts/workflows/agents (which carry extra factory gates)
is a gated future expansion. **Proof:** live-verified post-merge by a Telegram-gated `promote`
round-trip from or-aios (a tiny doc → a draft PR opens on the factory with a refreshed golden); the
MCP change redeploys the Cloud Run service on merge.
