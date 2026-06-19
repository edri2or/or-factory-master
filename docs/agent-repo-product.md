# The "agent-repo" product-type

This is the canonical reference for the factory's **second product-type**, the
**agent-repo** (ריפו-סוכן). It is *additive*: the original n8n "system" product
(GCP + Railway + Caddy + Telegram) is separate and unchanged. Where the system
product is a stateful service, an agent-repo is a **lightweight, private GitHub
repo driven by Claude Code** that exchanges units of work with other agent-repos
**only through a central broker** — never agent→agent directly.

> Development plan: `devplans/agent-repo-product.md`. Capability-first proof:
> `docs/capability-cards/agent-broker-handoff.md`.

## What an agent-repo is

A provisioned agent-repo (`edri2or/<name>`, private) is born with exactly:

| File | Role |
|---|---|
| `CLAUDE.md` | A thin `@AGENTS.md` pointer (Claude Code reads it natively). |
| `AGENTS.md` | The agent's orientation + operating rules (cross-tool standard). Rendered from `templates/agent-repo/AGENTS.md.template`. |
| `.mcp.json` | Points at the factory's read-only MCP (`/mcp`) for inspection. **Zero secrets** — auth is the gateway's own login. |
| `.github/workflows/agent-main.yml` | The **worker**: a `workflow_dispatch` the broker triggers to run one task. |

No GCP project, no n8n, no Railway, no Caddy. The whole product is GitHub +
Claude Code + the shared broker.

## The broker = `or-factory-master` (no new service)

Two existing halves of the factory carry the broker; nothing new is stood up:

1. **`agent-action.yml`** — a `workflow_dispatch` workflow on `or-factory-master`,
   shaped on `gcp-action.yml`. It runs as the broker SA (WIF, `if: refs/heads/main`,
   `permissions: {contents:read, id-token:write}`). It risk-classifies the task and
   either brokers the work or asks for approval (below).
2. **The MCP server** (`services/mcp-server/`) — already hosts the stateless
   Telegram approval bridges. `agent-approval.ts` + the admin-gated
   `/agent-action-register` route in `index.ts` send Or the RED approval card and,
   on ✅, dispatch the execute phase. `agent-action.yml` is added to the
   `dispatch_workflow` allowlist in `tools.ts` **for `phase=propose` only**.

## Dispatch + return channel = Broker-PULL

The single most-secure, most-reused shape. A requester agent-repo asks the broker
for work; `agent-action.yml` then:

1. **WIF → broker SA**; mints a per-request broker-App token scoped to the WORKER
   repo with `{"actions":"write"}` (`scripts/generate-app-token.sh`).
2. **Dispatches** the worker's `agent-main.yml` with `task` + `correlation_id`.
3. **Finds the run THIS dispatch created** — a high-water mark: the first worker
   run with `databaseId >` the pre-dispatch baseline (run ids are monotonic), never
   a stale or concurrent run — and **polls** it to terminal (broker-PULL — the
   worker never reaches outward).
4. On success, mints a fresh token scoped to the WORKER (`actions:read`) and
   **downloads** the worker's `agent-result` artifact, requiring **exactly**
   `result/<correlation_id>.json` (corr-strict, `scripts/select-result-file.sh` —
   no "first json" fallback, so a mis-polled run can never land another task's
   result under this `correlation_id`).
5. Mints a fresh token scoped to the REQUESTER (`contents:write`) and **writes the
   result** to `results/<correlation_id>.json` in the requester repo.
6. **Audits** every step via `scripts/emit-event.sh`
   (`factory.agent_action.{started,dispatched,completed,failed}`).

**The worker holds zero standing secrets.** `agent-main.yml` authenticates via the
shared agent-repo WIF door, reads `anthropic-api-key` only at run time (masked),
runs **Claude Code read-only** (`--allowedTools Read,Grep,Glob`, never
`--dangerously-skip-permissions`) over the task — which is written to
`task/task.txt` and treated as **untrusted DATA** (prompt-injection mitigation) —
writes `result/<correlation_id>.json`, and uploads it as the `agent-result`
artifact. It does **no git push and no outbound write**.

### Why the channel is files, not GitHub issues

The org-wide broker App has `contents:write` but **not** `issues`. Returning the
result as a committed `results/<corr>.json` file is therefore both git-native and
within the broker's existing permissions; switching to issues would require an App
permission change + re-consent for no real gain. `correlation_id` ties the
dispatch, the artifact, the result file, and the audit events together.

## The shared agent-repo WIF door

The broker cannot build WIF inside the control project (it lacks
`workloadIdentityPoolAdmin`/`serviceAccountAdmin` there), so the door lives on
`factory-test-25` and is built once by `bootstrap-agent-repo-identity.yml`
(`scripts/bootstrap-agent-repo-identity.sh`, idempotent, hard-refuses any other
project):

- **Pool/provider** `agent-repo-pool` / `github-agent-repo-provider` with CEL
  `assertion.repository_owner_id=='259965754' && assertion.ref=='refs/heads/main'`
  (the `edri2or` org, main only).
- **Runtime SA** `agent-repo-runtime-sa@factory-test-25`, bound per-repo with
  `workloadIdentityUser` so only enrolled agent-repos can mint tokens for it.
- Its **only** standing power is a cross-project, **conditioned** `secretAccessor`
  on the control project's `anthropic-api-key` (nothing else). It cannot read
  Railway/Cloudflare/management keys.

`provision-agent-repo.yml` re-uses the same bootstrap script to enrol each new
repo (idempotent), so a freshly provisioned agent-repo's `agent-main.yml` can
authenticate and read the run-time key with no secret stored in the repo.

## Risk tiers + RED Telegram approval

`agent-action.yml` classifies each task with `scripts/agent-classify.sh` over
`policy/agent-risk-tiers.yml` (a case-insensitive keyword RED-flag scanner, since
a task is freeform text). Routing:

- **green** = read / analyse / summarise / plan → brokered immediately.
- **yellow** = self-write class (commit / open a PR in the worker's *own* repo) →
  brokered + audited (for future write-capable workers).
- **red** = infra / cross-boundary / edits to `.github/**`, `AGENTS.md`,
  `CLAUDE.md`, anything touching secrets → **not brokered**. `agent-action.yml`
  POSTs `/agent-action-register`; Or gets one Telegram card with ✅/❌; only Or's
  ✅ dispatches the **execute** phase, which brokers the work regardless of tier.

**Capability-aware cap (2026-06-19).** `agent-classify.sh` also takes the **worker
repo** and caps the effective tier by its capability in `policy/agent-risk-tiers.yml`
(`worker_capabilities:`; fail-safe `default_worker_capability: write`). A **read-only**
worker (Read/Grep/Glob — the whole current fleet) can perform no RED action, so its
tier is capped at **yellow**: a task that merely *mentions* a risky word (e.g. one
that *describes* the RED list, the exact case that blocked Nuriel's read-only
research) is brokered immediately, not falsely gated. The classifier emits both the
effective `tier` (what the broker routes on) and the raw `content_tier`. The RED gate
stays fully active for any future **write-capable** worker (an unlisted worker
defaults to `write` → still gated) — the cap, not the default, is what keeps the
read-only fleet flowing.

**State-free approval transport.** Unlike the GCP gate's single charset-restricted
command, an agent work unit is four fields and the task is freeform, so the whole
unit travels as a **base64(JSON) blob inside the card text** (between
`⟦AGENT⟧…⟦/AGENT⟧`). Telegram echoes the text back verbatim in the callback, so a
Cloud Run instance swap can never lose a pending approval — no Linear/issue/DB
state. base64's alphabet can never contain the sentinel glyphs, so the boundaries
are unambiguous, and on ✅ the recovered payload's `correlation_id` **must equal**
the button's correlation id (binds button ↔ blob). The approver allowlist is the
shared `OIL_APPROVER_TELEGRAM_ALLOWLIST` (= Or), closed by default.

**A card too large to send is loud, not silent (2026-06-19).** A task too big for one
Telegram card is refused at register time (`task_too_large_for_card`, HTTP 413). The
broker no longer drops that case silently: it sends Or a plain Hebrew Telegram naming
the `correlation_id` + reason (`scripts/notify-card-failure.sh`) and emits
`factory.agent_action.card_failed` (severity `info` → Axiom-only, so no double-send),
then exits non-zero — the task genuinely was not queued.

**Why execute cannot be bypassed.** `agent-action.yml` is allowlisted for
`phase=propose` only; the `dispatch_workflow` MCP tool refuses a `phase=execute`
dispatch, so the execute phase is reachable **only** through the Telegram approval
callback (`handleAgentApprovalCallback` dispatches it directly). This mirrors
`gcp-action.yml` being entirely off the allowlist.

## The provisioner

`provision-agent-repo.yml` is the GitHub-only half of `provision-system.yml` (no
GCP project / n8n / Railway / Caddy). Inputs: `agent_repo_name`, `agent_name`,
`agent_purpose`. It (1) creates the private repo via the broker App, (2) renders
`templates/agent-repo/*.template` through `envsubst` with an allow-list **byte-
identical** to `scripts/render-agent-repo-golden.sh` (a CI parity gate enforces
this) and pushes the scaffold to `main`, and (3) enrols the repo in the shared WIF
door via the bootstrap script. It refuses control/factory names.

## Template integrity (golden) + CI gates

A parallel golden trio keyed on `^templates/agent-repo/` mirrors the system
golden:

- `scripts/render-agent-repo-golden.sh` renders the template to a byte-exact
  golden (`tests/golden/agent-repo/`); `scripts/check-agent-repo-golden.sh`
  compares it (Playground tests).
- `scripts/check-agent-repo-golden-sync.sh` (Changelog gates) requires a
  `templates/agent-repo/**` change to refresh the golden, and asserts the
  `envsubst` allow-list stays byte-identical across the renderer and the
  provisioner.
- New top-level workflows are dispatch-only, so each is listed in
  `monitoring/registry-exempt.txt` (watchdog registry gate).
- Doc-binding: `templates/agent-repo/AGENTS.md.template` ↔ this file
  (`monitoring/doc-bindings.json`).

## Security invariants (CI-enforced or structural)

- agent → **broker** only; never agent → agent direct.
- Every privileged workflow triggers on `workflow_dispatch` only (never
  `pull_request:`), so it can hold `id-token: write` safely.
- Every cross-repo reach is a fresh, minimal, **single-repo-scoped** broker App
  token (WIF only — never a SA key, never a standing PAT). The worker holds none.
- Claude headless is read-only and the task is data, never commands.
- No secret is ever committed, echoed, or logged.

## Known MVP limitations (documented, deferred)

- **agent-repo `main` is writable** (the repo is private; the broker writes
  `results/<corr>.json` directly to `main`). Hard branch protection that still
  admits the broker's result-write (a dedicated ref, or a 0-context PR) is a
  separate hardening step.
- The classifier is a heuristic keyword scanner, not a parser. A false positive on a
  **read-only** worker is now capped to yellow (brokered, not gated — see the
  capability-aware cap above); for a future write-capable worker a false positive
  still routes to Or's ✅ (safe).
- First wave (נחשון / נתן / ספי) + multi-agent fan-out is a separate development.
