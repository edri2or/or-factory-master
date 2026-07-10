# System → broker resource-request channel

A provisioned system can **run** but, by design, cannot **grant itself** new GCP
resources: its `deploy-sa` holds `roles/secretmanager.secretVersionManager` (it can
add versions to existing secrets, **not create** secrets), its per-system GitHub App is
scoped to its own repo only, and the broker WIF is pinned to the factory repo on `main`.
So a system has no way to obtain a *new* secret or a *new* permission on its own.

This channel closes that gap **without** broadening any system identity and **without**
giving a system raw cross-repo dispatch (a known anti-pattern). It is a human-gated twin
of the OIL auto-fix loop: the system **asks**, Or **approves once** on Telegram ✅, and the
**broker** (the only privileged identity) **fulfills**. Industry-standard shape:
just-in-time, least-privilege, human-in-the-loop approval for every privilege escalation,
behind a deterministic validation gate.

## request types

| `request_type` | What the broker does on ✅ | Gate |
|---|---|---|
| `secret` | Creates a new Secret Manager secret **shell** in the system's project + grants `secretAccessor` to the system's `runtime-sa`+`deploy-sa`. The system fills the value itself (it already has `secretVersionManager`). | safe id; **not** a super-credential (mirrors `copy-generic-secrets.sh` EXCLUDE) + no privileged keyword |
| `iam` | Grants **one** allowlisted, non-escalating project role to the system's own `runtime-sa`+`deploy-sa`. | role on a curated allowlist; owner/editor/`iam.*`/`*.admin`/`serviceusage.*` hard-refused |
| `sync` | Pulls the **latest value** of a SHARED secret from control SM into the system's own SM (the system-initiated twin of the broker's `mirror-secret-to-system.yml` push) — so a rotated shared secret can be refreshed on the system's own initiative instead of waiting for a factory push. Unlike `secret`/`iam` this moves a real secret **value**, so it is NOT routed through the value-free `fulfill-system-request.sh`; the workflow does the value-piped copy directly as broker. The dest shell must already exist. | secret on the curated `SYNC_ALLOWLIST` (default-deny) in `validate-system-request.sh` + the same super-credential/privileged-keyword refusals as `secret` |
| `promote` | **The reverse channel** (system → factory template): promotes a **doc** the system developed UP into `templates/system/**` so future systems are born with it. The broker fetches the doc from the system repo (`contents:read`), writes it under `templates/system/<target>`, refreshes the golden, and opens a **DRAFT PR** on `or-factory-master` (`generate-app-token` → push → `POST /pulls {draft:true}`). Routed to its OWN workflow (`fulfill-promote-request.yml`), NOT the value-free gcloud fulfiller. Double-gated: Or ✅ the request, THEN Or reviews + merges the draft PR (all factory CI gates run on it). The system itself cannot write to the factory (its App is repo-locked). | `source_path`/`target_path` are safe relative paths (no traversal), target under `templates/system/`, MVP artifact types = docs (`.md`/`.txt`) — enforced in `validate-system-request.sh` |
| `merge` | **Card-free — restores author≠approver for a system's self-fix loop.** A system whose self-fix loop already got Or's ✅ on **its own** Telegram bot asks the factory's **approver App** (a distinct identity from the system's own App that authored the PR) to perform the merge — so the merge is done by a principal that neither wrote the code nor is the system. Handled entirely in `dispatchSystemRequest` (`system-request.ts`) and **returns before** the card path: it reads the PR via the broker (`apiGet`), asserts it through the pure predicate `isMergeableSelffixPr`, then calls the existing cross-repo `mergePullRequestAsApprover` (native auto-merge → green-CI enforced by branch protection). No Telegram card, no Linear-recovery callback, no fulfiller workflow. Fail-closed pins: system must be **or-aios** (MVP), head must be `oil-(selffix\|autofix)/*`, base must be `main`, PR must be **open**, and author must be the system's own App bot (`EXPECTED_SELFFIX_AUTHOR`). | in-code predicate `isMergeableSelffixPr` (unit-tested); no `validate-system-request.sh` (never routes to the fulfiller) |

## System-side entry point — the `/request-factory-resource` command

A session running **inside a provisioned system** raises a request through the shared
slash-command **`/request-factory-resource`** (`.claude/commands/request-factory-resource.md`,
`audience: shared` — shipped into every system's `.claude/commands/`). Or asks in plain Hebrew
("צור סוד", "פתח הרשאה", "בקש מהפקטורי"); the command gathers the request (`secret` id **or** one
`iam` role, plus a reason), **pre-validates it locally against this exact gate** (the safe-id
regex, the super-credential / privileged-keyword refusals, and the same 8-role IAM allowlist as
`scripts/validate-system-request.sh`) so a doomed request is never sent, then **dispatches the
system's own `request-factory-resource.yml` workflow**. It **only asks** — nothing is created
until Or's ✅.

**Why a workflow, not a direct emit:** raising the request means running `emit-event.sh`, which
reads the system's Secret Manager (Linear/Telegram keys) — a read that needs GCP credentials.
An interactive Claude Code session has **none** (WIF works only inside GitHub Actions). So the
command does not emit itself; it dispatches the per-system workflow
(`templates/system/.github/workflows/request-factory-resource.yml`, shipped into every system),
which authenticates as the system's `deploy-sa` via WIF and runs the emitter. Dispatching a
workflow is a plain GitHub API call the session *can* make; the privileged emit happens in the
permissioned Actions environment.

## End-to-end flow

1. **System raises the request** — the `/request-factory-resource` command dispatches the
   system's `request-factory-resource.yml` workflow, which (WIF as `deploy-sa`,
   `EMIT_SM_PROJECT` = the system's own project) runs the already-shipped emitter:
   ```sh
   scripts/emit-event.sh \
     --name=system.request.secret \         # or system.request.iam
     --severity=info --action-required=true \  # action_required → Linear; info → no raw Telegram alert
     --layer=system --workflow=request-factory-resource --run-id=<rid> --system=<sys> \
     --body='{"request_type":"secret","secret_name":"supadata-api-key","reason":"..."}'
   ```
   `action_required=true` makes `emit-event.sh` open a deduped Linear ticket carrying the
   request JSON in its `event.body`.
2. **MCP triage** — Linear's outbound webhook hits the MCP `/linear-webhook`; `handleLinearWebhook`
   (`services/mcp-server/src/oil-autofix.ts`) routes any `system.request.*` event to
   `dispatchSystemRequest` (`services/mcp-server/src/system-request.ts`) **before** the OIL
   rules, which dispatches `fulfill-system-request.yml` in its `register` phase.
3. **Register phase** (broker WIF, `main`-pinned) resolves the system's **real** GCP project
   authoritatively from the system repo's `GCP_PROJECT_ID` variable (never from the request
   body), runs the gate (`scripts/validate-system-request.sh`), then POSTs `/system-request-register`
   so the MCP sends Or **one** Telegram card (system / project / exact secret-or-role / reason).
   It creates nothing.
4. **Approval** — Or taps ✅. Telegram → `/telegram-webhook` → `handleSystemRequestCallback`
   authorises the presser (the OIL approver allowlist), recovers the request from the Linear
   issue (state-free: the button only carries the issue id, `sysreq:`/`sysno:`), and dispatches
   the `fulfill` phase.
5. **Fulfill phase** re-runs the gate, performs the action as the broker via
   `scripts/fulfill-system-request.sh` (idempotent; never reads/writes a secret value), then
   emits an audit event + a Telegram confirmation + a Linear comment.
6. **System self-serves** — for `secret`, the system now `gcloud secrets versions add` itself.

## Components

| Piece | File |
|---|---|
| Deterministic request gate | `scripts/validate-system-request.sh` (+ `scripts/tests/validate-system-request.bats`) |
| Broker fulfiller (the privileged action) | `scripts/fulfill-system-request.sh` |
| Two-phase broker workflow | `.github/workflows/fulfill-system-request.yml` |
| MCP triage hook | `services/mcp-server/src/oil-autofix.ts` (`system.request.` branch) |
| MCP request bridge (dispatch / card / callback) | `services/mcp-server/src/system-request.ts` (+ `.test.mjs`) |
| MCP routes | `services/mcp-server/src/index.ts` (`POST /system-request-register`; `sysreq:`/`sysno:` in `/telegram-webhook`) |

## Security invariants

- **Broker-only fulfillment** — system SAs are never broadened; the broker performs the create/grant.
- **Human-gated** — the `register` phase creates nothing; only a ✅ from an allow-listed Telegram
  user dispatches `fulfill`. No auto-fulfill.
- **Authoritative project** — the target project is read from the system repo's `GCP_PROJECT_ID`
  variable, so a request can only touch the named system's own project (works for adopt-mode
  systems where the project id ≠ repo name).
- **Hard refusals** — control projects + `factory-test-25`; super-credentials; escalating IAM roles;
  any grant member other than the system's own `deploy-sa`/`runtime-sa`.
- **Idempotent + audited** — `describe`/set-semantics guards; every transition emits a
  `factory.system_request.*` observability event.
- `fulfill-system-request.yml` is **not** on the `dispatch_workflow` allowlist — it is reachable
  only through the MCP triage + Telegram-approval path (like `oil-autofix-verify.yml`).

## Known v1 limitations

- **No per-system request signing.** All systems share `linear-api-key`, so the `system_name`
  in a request is self-asserted. Mitigations: the gate blocks dangerous actions, the action is
  bounded to the named system's own SAs, **and** the human approval card shows system + target so
  Or catches a mismatch. Per-system signing is a v2 item.
- **`iam` allowlist is intentionally small.** Expanding it is itself a gated change (PR + Or review).
- The system side now has a first-class front door: the shared `/request-factory-resource`
  command (`.claude/commands/request-factory-resource.md`) plus the per-system workflow it
  dispatches (`templates/system/.github/workflows/request-factory-resource.yml`) ship into every
  system. The command pre-validates locally and dispatches the workflow; the workflow authenticates
  via WIF and runs `emit-event.sh` (an interactive session has no cloud creds, so it cannot emit
  directly — hence the workflow). New systems get both at provision; existing systems are
  back-filled in place via `refresh-system-agents.yml`
  (`paths=".github/workflows/request-factory-resource.yml,.claude/commands/request-factory-resource.md"`).
  These two are the only added system-side artifacts — the backend channel is unchanged.

## Proven

Static: 30 bats cases (`validate-system-request.bats`) + the MCP suite (`system-request.test.mjs`).
Live (on the real `tokile` system, project `factory-test-18`): the success path created a secret
shell after Or's ✅, and the refusal path blocked a forbidden super-credential at the gate with
no card sent. The live proof also caught + fixed a real bug (the project-lookup token scope),
OIL-loop style.
