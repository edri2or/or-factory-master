## feat: system-request `merge` type — restore author≠approver for a system's self-fix loop

| Type | Summary |
|---|---|
| feat | New card-free `merge` request type on the system→broker ask-bus, so a system's self-fix loop can restore **author≠approver**. After a system got Or's ✅ on **its own** Telegram bot, it emits `system.request.merge {pr_number}`; `dispatchSystemRequest` (`services/mcp-server/src/system-request.ts`) handles it entirely and **returns before** the card path — it reads the PR via the broker (`apiGet`), asserts it through the new pure predicate `isMergeableSelffixPr`, then merges it with the SEPARATE `oil-autofix-approver` App via the existing cross-repo `mergePullRequestAsApprover` (native auto-merge → green-CI enforced by branch protection). No Telegram card, no Linear-recovery callback, no fulfiller workflow (a `merge` can never reach `registerSystemRequest` or `fulfill-system-request.yml`). Fail-closed pins: system must be **or-aios** (MVP), base `main`, head `oil-(selffix\|autofix)/*`, PR **open**, author the system's own App bot (`EXPECTED_SELFFIX_AUTHOR`, default `or-aios-app[bot]`). Reading uses the broker, merging uses the approver — two distinct Apps, so the merger neither wrote nor is the system. |

## test: unit-test the `isMergeableSelffixPr` merge guard

| Type | Summary |
|---|---|
| test | `services/mcp-server/test/system-request.test.mjs` gains 6 cases for the pure `isMergeableSelffixPr` predicate: accepts a genuine open `oil-selffix`/`oil-autofix` → `main` PR authored by `or-aios-app[bot]`; rejects a wrong system, wrong base, non-self-fix head, wrong author, and a non-open state. `docs/system-resource-requests.md` gains the `merge` row (documented as internal/card-free, distinct from the Telegram-card-gated types). |
