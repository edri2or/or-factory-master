# The E2E Verification Gate — an enforceable brake against "silent green"

> Status: introduced by the `e2e-verification-gate` development (2026-06).
> Audience: factory maintainers. This is the *why* and the *contract*; the
> mechanics live in the scripts/workflows named below.

## The failure this exists to stop

An agent fixed a bug in a system's Telegram bot, declared it **"verified live"**
on the strength of a **configuration log alone** (`tools/list` showed the tools
were registered), and immediately started building the next stage — assuming the
feature worked. It never drove real behavior: it never sent a message through the
`Telegram → agent-router` inbound path and read the actual reply. That is exactly
the pattern that produced the original bug — a **silent failure**: a tool that
died with nobody knowing, because every check that ran was green.

**The governing test of this whole development:** *"Can an agent now declare
'works' and continue, without proof of real behavior?"* If yes, we failed. The
brake must be **server-enforced** (like the `protect-main` ruleset), not advice.

## Where "green" pretends to be "working" today

The factory has many green signals. None of them drives a real user message
through the inbound path and asserts on the reply.

| Surface | What it *does* verify | What it does **not** verify |
|---|---|---|
| `templates/system/.github/workflows/configure-agent-router.yml` | n8n login (200), the OpenRouter credential (a direct curl), workflow **import + publish**, route registration, and an `/mcp/system-tools` self-verify (no-bearer 401 → `initialize` → `tools/list` → one `postgres_named_query` call — see its "5j. mcp-server self-verification" block, ~line 1634). | **It never sends a message through `telegram-in/inbound` and checks that the agent-router actually replied.** Publish registers a route; it does not run it. The self-verify proves the *outward* MCP endpoint, a different surface from the inbound chat path. |
| `docs/live-test-loop.md` (lines 49–50) | `probe_endpoint` (`/healthz`, the UI, the Caddy HMAC edge) **"and/or a real Telegram round-trip"**. | The Telegram round-trip is **optional and manual** ("and/or"). A change can be called green on `/healthz` alone — no business logic exercised. |
| `factory-mcp-smoke.yml` / `n8n-mcp-smoke.yml` / `google-mcp-smoke.yml` | MCP handshake, an exact tools-list, a `dev-` workflow create+delete, read-only API calls. | None **runs** the inbound flow end to end. `n8n-mcp-smoke` creates a workflow but never executes it. |
| `ci-deploy-preflight` skill | A credential's reachability and minimum scope. | That the **deployed, running** system actually uses the credential correctly at runtime. |
| `scripts/oil-autofix-validate.sh` / `scripts/oil-verify.sh` | A fail-before/pass-after reproducer in a scrubbed `env -i`. | A **unit test of the fix**, not the fix's behavior inside the running system. |

**Root cause:** the factory verifies *configuration* and treats it as *behavior*.
There is no artifact that attests *"I sent a real message through the inbound path
and got a correct reply."* This gate creates and enforces exactly that artifact.

## The professional standard (dated)

- **Post-deploy smoke / verification gate** — a fast go/no-go run against the
  environment you *just deployed*, not against config. (Harness, *Integrating
  Smoke Testing into CI/CD*; InfoQ, *Pipeline Quality Gates*, 2023.)
- **Deployment / release gates** — automated post-deployment conditions that block
  promotion until a real health signal passes. (Microsoft Learn, *Azure Pipelines
  — Deployment gates concepts*; OneUptime, *How to Implement Deployment Gates*,
  2026-01.)
- **Required status checks + merge queue** — the **job name** (the check run) is
  what becomes required, not the workflow file. (GitHub Community Discussion
  #171941.) This is precisely how `protect-main` already pins its contexts here.
- **Synthetic monitoring** — simulated traffic that runs a real user flow to catch
  failures before users do. (SRE School, *Synthetic Monitoring*, 2026.) Our
  "send a probe message through `telegram-in/inbound`" is exactly this.
- **Progressive delivery / canary with automated analysis** — automated HTTP/metric
  analysis decides roll-forward vs rollback. (InfraCloud, *Argo Rollouts: Canary
  with Analysis*; OpsMX, *Canary Analysis*.)
- **DORA / Google SRE** — verification is part of the Definition of Done; a change
  is not "done" until its behavior is automatically verified in a real environment.

**Ranking for our context.** The right fit is a **post-deploy synthetic smoke
wired as a required status check** — cheap, deterministic, server-enforced, no
heavy canary infrastructure. Canary + automated-analysis is the future upgrade for
higher change volume; documented here, not built now.

## The brake — three parts an agent cannot skip

### 1. The driver — `scripts/e2e-verify-inbound.sh`

Runs against a **live** system (the factory proves on a throwaway test system; a
system proves on itself):

1. Reads `n8n-telegram-webhook-secret`, `n8n-telegram-chat-id`, `n8n-api-key` from
   Secret Manager (never printed).
2. Builds a **synthetic Telegram update** with a deterministic, **tool-exercising**
   probe (e.g. "what is my system name?", forcing the `SYSTEM-INFO` /
   `postgres_named_query` path) and a **unique `update_id`** (the dedup guard drops
   repeats).
3. `POST`s it to the **real public URL**
   `https://n8n-<system>.or-infra.com/webhook/telegram-in/inbound` with header
   `X-Telegram-Bot-Api-Secret-Token: <secret>`. This drives the whole real edge:
   Caddy exemption → `tg-inbound` → the internal `agent-router`.
4. Because the webhook is `responseMode: onReceived`, a `200` means *received*, not
   *processed* — so the driver **polls the n8n Public API executions** for our run
   (up to ~90 s).
5. **Asserts on real behavior:** the execution `finished` successfully, **no node
   errored** (this is what catches a silent tool death), and the agent's reply is
   **non-empty and not an error sentinel** (ideally contains the expected token).
6. On pass, it computes a `content_hash` over the behavior-bearing files and emits
   the proof payload.

### 2. The proof producer — `e2e-verify.yml` (+ system template twin)

A `workflow_dispatch` workflow (on the `dispatch_workflow` allowlist) that: applies
the branch's behavior files to the live system, runs the driver, and **only on a
real pass** HMAC-signs the payload with the existing `mcp-server-bearer-signing-key`,
commits `e2e-proofs/<slug>.json`, and uploads it as the `e2e-proof` run artifact.

Proof JSON: `{slug, system, content_hash, run_id, executed_at, execution_id,
reply_excerpt (redacted), result:"pass", signature}`.

### 3. The enforced gate — `scripts/check-e2e-proof.sh` → context `E2E verification gate`

A dedicated CI job (`e2e-gate.yml`, factory + system twin) named exactly
**`E2E verification gate`**, added to the `protect-main` ruleset's required
contexts. The script (a twin of `check-devplan-updated.sh`):

- Reads `git diff HEAD~1 HEAD`; it is a **no-op** unless the diff touches
  **behavior-bearing files** (the trigger paths below).
- When it does, it requires `e2e-proofs/<slug>.json` in the same diff and verifies
  it **without any cloud credential** (only `GITHUB_TOKEN` / `actions:read`):
  1. the proof's `content_hash` equals a freshly recomputed hash of the diff's
     behavior-bearing files (edit the workflow after proving → mismatch → red);
  2. `run_id` is a **successful** `e2e-verify.yml` run on *this* repo
     (`head_repository` match — not a foreign run);
  3. the `e2e-proof` artifact of that `run_id` is **byte-identical** to the
     committed proof;
  4. `result == "pass"` and `executed_at` is fresh.
  Otherwise it exits non-zero with a remediation message.

**Why an agent cannot forge it.** It can hand-write the JSON, but it cannot produce
a green `e2e-verify.yml` run with a matching artifact **without the live E2E
actually passing** — and the E2E runs real behavior. Editing the workflow after
proving breaks `content_hash`. There is no "decide it works" path. (The HMAC
signature remains as defense-in-depth for offline audit.)

**Trigger paths (behavior-bearing).**
- Factory: `templates/system/workflows/n8n/*.json`,
  `templates/system/.github/workflows/configure-agent-router.yml`.
- System: `workflows/n8n/*.json`, `.github/workflows/configure-agent-router.yml`.

## How it ties into `/dev-stage`

The `templates/devplan/DEVPLAN.template.md` carries a per-stage
**`הוכחת E2E (artifact)`** field next to the functional-proof field. A stage that
touches behavior-bearing files cannot close (and its code cannot merge) unless the
`E2E verification gate` is green with a fresh proof **in the same diff** — already
enforced automatically by the gate, exactly as `check-devplan-updated.sh` enforces
a plan update in the diff. No extra CI job is needed for this tie-in.

## Propagation & scope

Shipped into every **newly provisioned** system (provision-only, like the devplan
gate): `provision-system.yml` scaffolds `check-e2e-proof.sh` + `e2e-verify-inbound.sh`
and the `e2e-gate.yml` / `e2e-verify.yml` templates, and adds the new context to the
system's `protect-main` ruleset. Existing systems are **not** back-filled — a
deliberate follow-up.

## Future work (documented, not built)

- Back-fill the gate onto existing systems (e.g. `or-edri-4`, where the original
  failure happened).
- Upgrade to canary + automated-analysis with auto-rollback at higher change volume.
- A negative-content probe set (assert the bot refuses what it must refuse).
