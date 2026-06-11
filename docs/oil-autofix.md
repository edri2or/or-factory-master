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
                 1b. prepare tree — factory target = this checkout; SYSTEM target = shallow-clone
                     edri2or/<system> into ./target (read token), so steps 2/4/6 act on the system's code
                 2. investigate  — claude-code-action, tools Read/Grep/Glob only → diagnosis JSON
                 3. decide       — actionable-bug + confidence ≥ 0.8 + target is the factory OR a valid system?
                 4. fix          — claude-code-action writes a fix + a bash reproducer in <code root>/scripts/tests/
                 5. lockdown     — commit candidate, mint a scoped broker token, REVOKE cloud creds
                 6. gate         — scripts/oil-autofix-validate.sh (deterministic; runs in the target tree)
                 7. open DRAFT PR in the target repo (broker App) + write a changelog.d/ fragment
                    (scripts/oil-changelog-fragment.sh — a dated fragment folded later by
                    compile-changelog.sh, NOT the head of CHANGELOG.md, which broke the size gate)
                 8. POST /oil-approval-register {repo}  →  Telegram ✅/❌ to Or (shows which repo)
       └─ /telegram-webhook  →  handleTelegramCallback       services/mcp-server/src/oil-approval.ts
            └─ ✅  →  mergePullRequestAsApprover(repo) (native auto-merge; merges only on green CI)
                 identity = oil-autofix-approver  (NOT the broker — identities are separated)
                 token   = down-scoped to the one target repo at merge time
                 ├─ factory merge → push: main → oil-autofix-verify.yml (on main)         ← Stage 5
                 └─ system  merge → MCP dispatches oil-autofix-verify.yml(repo, pr) on the factory
                      └─ oil-autofix-verify.yml  (on main, WIF)         ← Stage 5
                           - factory: recognises the OIL merge by the `oil-autofix:` squash subject
                           - system:  clones edri2or/<system> main into ./target (read token)
                           - recovers the reproducer from the merge diff (the added scripts/tests/*.sh)
                           - re-runs it on the merged tree via scripts/oil-verify.sh (scrubbed env -i)
                           - PASS  → Linear issueUpdate(completed) + closing comment + "✅ תוקן ואומת" Telegram
                           - FAIL  → comment + "🚨 נכשל באימות" Telegram; issue stays OPEN (no close)
```

## Components

| File | Role |
|---|---|
| `.github/workflows/oil-autofix-investigate.yml` | Stages 1–3: investigate (read-only AI) → fix (AI) → deterministic gate → open the draft PR → register the Telegram approval. |
| `.github/workflows/oil-autofix-verify.yml` | Stage 5: post-merge verifier. Factory path: `push: main`, recognises an OIL merge by the `oil-autofix:` squash subject, holds **no** GitHub API token. System path (`workflow_dispatch(repo,…)`, dispatched by the MCP after a system merge): clones the system's `main` with a repo-scoped `contents:read` token. Either way: re-runs the reproducer, closes the ticket or alerts. |
| `scripts/oil-autofix-validate.sh` | The Stage-3 safety gate (pure): ≤2 files / ≤100 lines, forbidden paths, secret scan, and a fail-before/pass-after reproducer run in a scrubbed `env -i`. |
| `scripts/oil-verify.sh` | The Stage-5 post-merge gate (pure): re-runs a whitelisted `bash <file>` reproducer in a scrubbed `env -i`, prints one `VERDICT:` line. Pass-after-only (fail-before was proven at PR time). |
| `scripts/tests/oil-verify-selftest.sh` | Unit self-test for `oil-verify.sh` (verified / failed / malformed / missing / empty), wired into `pipeline-tests.yml`. |
| `scripts/tests/oil-verify-{passmode,failmode}.sh` | Trivially passing / failing reproducer fixtures, for on-demand verify testing. |
| `services/mcp-server/src/oil-autofix.ts` | `/linear-webhook` handler + rules-only `triage` + `repository_dispatch(oil-investigate)`. |
| `services/mcp-server/src/oil-approval.ts` | `registerApproval(repo)` (Telegram ✅/❌, state-free `callback_data` `oilapprove:<repo>:<pr>`) + `handleTelegramCallback` (allowlist → merge/close in the carried repo; dispatches verify after a system merge). |
| `services/mcp-server/src/github-client.ts` | `oil-autofix-approver` identity + per-merge `repoScopedToken` + `mergePullRequestAsApprover` / `closePullRequestAsApprover` (owner/repo-guarded). |

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
- **Per-merge repo scoping.** The approver App is installed **org-wide** (so it can merge a fix in a
  system repo), but every individual merge/close mints an installation token **down-scoped to the
  one target repo** + the merge permission subset. A GitHub installation token can be narrowed to
  specific `repositories` and can never exceed the install, so org-wide + per-merge scoping gives the
  same effective isolation as an App-per-repo. The MCP also refuses any merge whose owner isn't
  `edri2or` or whose repo is empty, and the repo always originates from the verified
  `callback_data` (`oilapprove:<repo>:<pr>`), never free input.
- **Human Telegram gate + platform gate.** The merge waits for Or's ✅ (verified by
  `X-Telegram-Bot-Api-Secret-Token` + an allowlist on `from.id`) **and** GitHub native auto-merge,
  which merges only once the 4 required CI checks are green (`main` branch protection — every system
  carries the same 4 checks, installed by `provision-system.yml`).
- **Token-free verifier (factory path).** For a factory merge, `oil-autofix-verify.yml` uses **no
  GitHub API token** in its logic — the OIL identifier + PR number come from the commit subject, the
  reproducer from the merge diff; only `linear-api-key` + Telegram secrets are read (from Secret
  Manager via WIF). It triggers on `push: main` (commits already on protected main — no untrusted-
  event surface). For a **system** merge it mints a broker token **scoped to that one repo with
  `contents:read` only** — used solely to shallow-clone the system's `main`; the reproducer still
  runs in a scrubbed `env -i` after cloud creds are revoked.

## Triggering & testing

- **Investigate** — automatically via `repository_dispatch(oil-investigate)` from the MCP triage, or
  manually `workflow_dispatch(issue_id)` for testing. On the `dispatch_workflow` allowlist.
- **Verify** — automatically on `push: main` for an `oil-autofix:`-subject factory merge; for a
  **system** merge the MCP dispatches it on the factory with `repo`+`pr_number`; or manually
  `workflow_dispatch(repo / pr_number / issue_id / test_cmd)` to re-verify or test a path. **Not** on
  the `dispatch_workflow` allowlist (it acts only on already-merged main commits).
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

## Fixing a system's own code (Stage 83)

The loop fixes a bug diagnosed in a **system's** own repo, not just the factory — the factory stays
the orchestrator (both workflows run in `or-factory-master`; only the *target* of the fix moves):

- **Target routing.** `oil-autofix.ts` already passes `layer`+`system`; the investigate workflow
  computes `TARGET_REPO` and, for a system, shallow-clones `edri2or/<system>` into `./target` so the
  investigator and the fixer both work on the system's code and the gate diffs the system tree.
- **Scoped write token.** The branch is pushed and the PR opened with a broker token scoped to that
  one repo; the merge uses a per-merge approver token scoped the same way.
- **System CI.** The DRAFT PR runs through the system's own 4 required checks (same bundle the
  factory enforces, installed by `provision-system.yml`), so native auto-merge behaves identically.
- **Post-merge verify.** The MCP dispatches `oil-autofix-verify.yml` on the factory right after a
  confirmed system merge; verify clones the system's `main` and re-runs the reproducer there.

### Template-vs-live policy (v1)

When the root cause is code the factory **injected from its templates** (`templates/system/…`), the
fixer fixes **only the system's live copy** and flags — in the PR body and the Linear comment — that
the factory template needs an upstream fix + a later back-port. There is **no automatic back-port**
in v1; fleet-wide template propagation is future work.

## v1 limitations

- Fixes only code with a **bash-runnable reproducer** (`scripts/*.sh`); TypeScript (`services/mcp-server`,
  no test runner yet) and `.github/workflows/*` are off-limits to the fixer. Widening this is the
  deferred Stage 7 (its own future `/dev-stage`).
- **Async auto-merge for systems isn't auto-verified.** Post-merge verify is dispatched on a
  *confirmed synchronous* system merge (the common path: Or approves after CI is green). If Or taps ✅
  while the system PR's CI is still running, GitHub auto-merge lands the merge later and the factory
  never observes that moment, so verify doesn't auto-fire for that PR (the factory's own PRs are
  unaffected — `push: main` covers them). A system-side merge notifier is deferred.
- **No automatic template back-port** (see the template-vs-live policy above).
- Reuse-mode test systems (shared `factory-test-25`) aren't folder-listed — they don't surface in
  folder-based audits.
