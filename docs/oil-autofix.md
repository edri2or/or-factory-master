# OIL auto-fix loop

The "second half" of the factory's failure mechanism. The observability pipeline already
*detects* failures and opens a Linear **OIL** ticket (the OpenTelemetry event JSON in the issue
body). This loop adds what was missing: an autonomous agent that **reads the ticket, finds the
root cause, prepares a small fix, asks Or for one Telegram ✅, merges it, verifies it actually
worked, and closes the ticket** — without Or ever touching a terminal.

It is built as the deliberate, **bounded** exception to the repo's "build manually / no
auto-chain / no issue-based reporting" defaults (see [Why this is allowed](#why-this-is-an-allowed-exception)).

## End-to-end flow

```
Linear OIL ticket (OTel JSON in body)
  └─ MCP /linear-webhook  →  triage (rules only)            services/mcp-server/src/oil-autofix.ts
       └─ repository_dispatch(oil-investigate)
            └─ oil-autofix-investigate.yml  (on main, WIF)
                 1. resolve the issue + pull the failed run's logs (Linear + broker App, read-only)
                 2. investigate  — claude-code-action, tools Read/Grep/Glob only → diagnosis JSON
                 3. decide       — actionable-bug + confidence ≥ 0.8 + target or-factory-master?
                 4. fix          — claude-code-action writes a fix + a bash reproducer in scripts/tests/
                 5. lockdown     — commit candidate, mint a scoped broker token, REVOKE cloud creds
                 6. gate         — scripts/oil-autofix-validate.sh (deterministic; runs the reproducer)
                 7. open DRAFT PR (broker App) + add a CHANGELOG entry
                 8. POST /oil-approval-register   →  Telegram ✅/❌ to Or
       └─ /telegram-webhook  →  handleTelegramCallback       services/mcp-server/src/oil-approval.ts
            └─ ✅  →  mergePullRequestAsApprover (native auto-merge; merges only on green CI)
                 identity = oil-autofix-approver  (NOT the broker — identities are separated)
                 └─ push: main
                      └─ oil-autofix-verify.yml  (on main, WIF)         ← Stage 5
                           - recognises the OIL merge by the `oil-autofix:` squash subject
                           - recovers the reproducer from the merge diff (the added scripts/tests/*.sh)
                           - re-runs it on merged main via scripts/oil-verify.sh (scrubbed env -i)
                           - PASS  → Linear issueUpdate(completed) + closing comment + "✅ תוקן ואומת" Telegram
                           - FAIL  → comment + "🚨 נכשל באימות" Telegram; issue stays OPEN (no close)
```

## Components

| File | Role |
|---|---|
| `.github/workflows/oil-autofix-investigate.yml` | Stages 1–3: investigate (read-only AI) → fix (AI) → deterministic gate → open the draft PR → register the Telegram approval. |
| `.github/workflows/oil-autofix-verify.yml` | Stage 5: post-merge verifier. `push: main`, recognises an OIL merge by the `oil-autofix:` squash subject, re-runs the reproducer, closes the ticket or alerts. Holds **no** GitHub API token. |
| `scripts/oil-autofix-validate.sh` | The Stage-3 safety gate (pure): ≤2 files / ≤100 lines, forbidden paths, secret scan, and a fail-before/pass-after reproducer run in a scrubbed `env -i`. |
| `scripts/oil-verify.sh` | The Stage-5 post-merge gate (pure): re-runs a whitelisted `bash <file>` reproducer in a scrubbed `env -i`, prints one `VERDICT:` line. Pass-after-only (fail-before was proven at PR time). |
| `scripts/tests/oil-verify-selftest.sh` | Unit self-test for `oil-verify.sh` (verified / failed / malformed / missing / empty), wired into `pipeline-tests.yml`. |
| `scripts/tests/oil-verify-{passmode,failmode}.sh` | Trivially passing / failing reproducer fixtures, for on-demand verify testing. |
| `services/mcp-server/src/oil-autofix.ts` | `/linear-webhook` handler + rules-only `triage` + `repository_dispatch(oil-investigate)`. |
| `services/mcp-server/src/oil-approval.ts` | `registerApproval` (Telegram ✅/❌, state-free `callback_data`) + `handleTelegramCallback` (allowlist → merge/close). |
| `services/mcp-server/src/github-client.ts` | `oil-autofix-approver` identity (`tokenFor`) + `mergePullRequestAsApprover` / `closePullRequestAsApprover`. |

**Secret Manager keys** (control project): `linear-api-key`, `telegram-bot-token`, `telegram-chat-id`,
`linear-webhook-secret`, `telegram-approval-webhook-secret`, `oil-approver-telegram-allowlist`,
`oil-autofix-approver-app-{id,private-key,installation-id}`, `mcp-server-admin-secret`.

## Safety model

The loop runs AI-authored code, so every layer is defence-in-depth:

- **Read-only investigation.** The investigator gets only `Read/Grep/Glob`; `allowed_bots` is the
  broker App only (no other non-human actor can drive it). Issue/log text is treated as untrusted.
- **Deterministic gate before any PR.** `oil-autofix-validate.sh` caps the diff (≤2 files / ≤100
  lines), refuses forbidden paths (`.github/workflows`, `terraform/`, anything `*secret*`/`*wif*`/
  `*cred*`/`*.pem`…), scans added lines for secrets, and proves a **fail-before / pass-after**
  reproducer. Any breach → escalate as a comment, no PR.
- **Credential lockdown.** Cloud credentials are revoked and removed **before** any AI-authored code
  (the reproducer) runs, and the reproducer always runs in a scrubbed `env -i` (inherits no secrets).
- **Identity separation.** The broker App opens the draft PR; a *separate* `oil-autofix-approver`
  App (only `contents`+`pull_requests` write) merges — and only after the human ✅.
- **Human Telegram gate + platform gate.** The merge waits for Or's ✅ (verified by
  `X-Telegram-Bot-Api-Secret-Token` + an allowlist on `from.id`) **and** GitHub native auto-merge,
  which merges only once the 4 required CI checks are green (`main` branch protection).
- **Token-free verifier.** `oil-autofix-verify.yml` uses **no GitHub API token** in its logic — the
  OIL identifier + PR number come from the commit subject, the reproducer from the merge diff; only
  `linear-api-key` + Telegram secrets are read (from Secret Manager via WIF). It triggers on
  `push: main` (commits already on protected main — no untrusted-event surface).

## Triggering & testing

- **Investigate** — automatically via `repository_dispatch(oil-investigate)` from the MCP triage, or
  manually `workflow_dispatch(issue_id)` for testing. On the `dispatch_workflow` allowlist.
- **Verify** — automatically on `push: main` for an `oil-autofix:`-subject merge, or manually
  `workflow_dispatch(pr_number / issue_id / test_cmd)` to re-verify or test a path. **Not** on the
  `dispatch_workflow` allowlist (it acts only on already-merged main commits).
- **CI** — `oil-verify-selftest.sh` runs in the `shellcheck + yamllint` job on every PR.
- **Live-proven (2026-05-29):** success path (OIL-22 auto-closed) and failure path (OIL-23 left open
  + alert). The failure demo itself caught a real `bash -e` bug in the verifier, which was fixed.

## Why this is an allowed exception

The repo's defaults (CLAUDE.md "The one rule"; `docs/roadmap.md` "Things we are deliberately not
building") reject **auto-chaining** workflows and **issue-based reporting**. The OIL loop is the one
sanctioned exception because it keeps the *spirit* of those rules:

- It is **Linear-issue-driven** — it consumes the OIL tickets the observability pipeline already
  opens; it does not re-introduce GitHub `factory-success`/`factory-failure` Issue clutter.
- **Every step is verified** — a deterministic safety gate before the PR, and a post-merge reproducer
  re-run before the ticket is closed.
- **The merge is human-gated** — nothing reaches `main` without Or's explicit Telegram ✅ and green CI.

It does not loosen those defaults anywhere else in the factory.

## v1 limitations

- Fixes only **`or-factory-master`**; a bug attributed to a *system* is escalated as a comment (the
  real fix is usually a template change in the factory).
- Fixes only code with a **bash-runnable reproducer** (`scripts/*.sh`); TypeScript (`services/mcp-server`,
  no test runner yet) and `.github/workflows/*` are off-limits to the fixer. Widening this is the
  deferred Stage 7 (its own future `/dev-stage`).
- Reuse-mode test systems (shared `factory-test-25`) aren't folder-listed — they don't surface in
  folder-based audits.
