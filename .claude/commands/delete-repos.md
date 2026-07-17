---
audience: factory-only
description: Delete one or more edri2or GitHub repos through the Telegram-gated approval bridge. Use whenever Or asks to delete / remove repos ("תמחק את הריפו", "delete repo", "תמחק ריפוז"). The deletion ONLY executes after Or taps ✅ on the Telegram card — never automatically.
---

# Delete repos — Telegram-gated

## When
Or asks to delete/remove one or more org repos. This is the always-available, standing capability — never fumble for "how": the flow below is the answer.

## Invariant
**AI proposes, Or approves on Telegram.** The agent can only SEND THE CARD. The deletion runs ONLY inside the MCP's verified Telegram-✅ callback (`services/mcp-server/src/repo-approval.ts` → `github-client.deleteRepoAsBroker`). No tap → nothing is deleted. `or-factory-master` can NEVER be deleted (hard-guarded at register time AND in the deleter). **Never tell Or a deletion is "safe" / "aligns with the records" from assumption — state only what the Step-2 impact scan actually found.**

## Steps
1. **Confirm the exact repo names** with Or (or derive them; for "delete all except X" first list repos and present the DELETE set for his review — repo deletion is **permanent**).
2. **Impact scan — REQUIRED, never skip; never call a deletion "safe" without it.** For **each** target repo, BEFORE proposing:
   - `search_code` org-wide for the repo name (e.g. `<repo> repo:edri2or/or-factory-master`, and across the org) and **read** the hits — a count is not a check.
   - Grep `docs/`, `docs/roadmap.md`, and `devplans/` for the name.
   - **Flag** any reference that signals a constraint: `blocks` / `teardown` / `pending` / `after` / `still carries` / `do not` / `keep`, or a live dependency (an env default, a smoke target, a secret home such as `factory-test-7`).
   - **Present the scan's actual findings to Or** as part of the DELETE-set review. If a documented constraint is found, **STOP** and surface it — do NOT proceed calling it "safe". State what the scan FOUND, never a reassurance from assumption. (Origin: 2026-07-17 — `or-adhd-agent` was deleted after being called "safe" while `docs/roadmap.md` #6 openly said "blocks any teardown".)
3. **Propose** — dispatch the proposal workflow (it only sends the card; it cannot delete):
   - `dispatch_workflow` is NOT used (not allowlisted); dispatch via `mcp__github__actions_run_trigger` `run_workflow` on `or-factory-master`, `ref=main`, `workflow_id=propose-repo-delete.yml`, inputs `{ "repos": "<space/comma names>", "correlation_id": "<short-id>" }`.
4. **Tell Or** a ✅/❌ card was sent to Telegram; he taps **✅ אישור ומחיקה** to delete, or **❌** / ignores to cancel.
5. **Verify AND record** after he taps — the deletion is NOT "done" until both happen:
   - **Verify:** `get_repo` / `list_repos` (factory MCP) — the targets are gone (404) and the keepers intact.
   - **Record:** write the verified outcome (which repos were deleted, the date, the correlation id) into the durable record — a `changelog.d/` fragment and/or the relevant devplan journal. Never leave it at "I sent the card" — a count/guess is not a record.
   - If the conversation moved on after you proposed (Or approved later, async), **loop back** and do this verify+record step; do not close the development with the deletion unverified/unrecorded (per CLAUDE.md "How to work" §7).

## Notes
- Credential: the **broker App** (`administration:write`, already org-wide) — no token to add, nothing for Or to open.
- Allowlist: reuses `OIL_APPROVER_TELEGRAM_ALLOWLIST` (Or already on it).
- For a large "delete everything except a keep-list" sweep, the keep-list path is `.github/workflows/bulk-delete-repos.yml` (operator-token, dry-run + confirm) — use that for mass cleanups; use THIS Telegram-gated flow for targeted deletions.
- If the broker DELETE ever returns 403 (App can't delete repos): fall back to a long-lived fine-grained token in SM read server-side in the callback — same hard gate.
