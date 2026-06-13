# The live-test-system loop

The factory's **standing method for validating a provisioning-process change** — any
change to what the factory provisions (`templates/system/**`,
`.github/workflows/provision-system.yml`, the system `deploy-railway-cloudflare.yml`).
The agent always has this capability; it does not need to be reminded of it.

> Short version: **prove the change live on `or-edri-4`** (the standing proving system),
> then **lock it into the factory template** (merge to `main`). A cheap, throwaway test
> system is kept only for the **Day-0 birth check** (proving a *fresh* system is born
> correct) — `or-edri-4` proves Day-2 (state + iteration); a throwaway proves Day-0.

## `or-edri-4` as the standing proving system — and how it avoids the old decay

The factory's proving ground is a **standing live system, `or-edri-4`** (GCP
`factory-test-21`, adopt). Every provisioning-process change is applied to it and proven
live **before** it is locked into the factory template. This is deliberately a permanent
system — but it is **not** the "reference system" (מערכת-ייחוס) we built and retired once
before. That earlier attempt failed for three concrete reasons, each of which is now closed:

1. **It was never used** — the last provisioning development skipped it entirely. → Now
   using `or-edri-4` is **mandatory and enforced**: a hard CI brake
   (`scripts/check-e2e-proof.sh` + the `proof_systems` field in `e2e-surfaces.json`) blocks
   the merge of a bot-behavior / deploy-edge change unless a **fresh E2E proof from
   `or-edri-4`** is in the same diff. You cannot skip it or "decide it works".
2. **It decayed silently** between uses (its Railway Postgres and GitHub protections quietly
   disappeared). → The proof must be **fresh per change** (`freshness_days`), so a decayed
   system *fails the proof loudly* instead of rotting unnoticed; and `or-edri-4` is on the
   6-hourly **heartbeat audit** (`system-runtime-audit.yml` → `factory.runtime_audit.*`),
   which alerts the moment `/healthz` stops answering.
3. **It cost money** to keep a dedicated box running. → `or-edri-4` is **already Or's running
   system**; using it as the proving ground adds **no new cost**.

We still keep the industry lesson that a long-lived shared staging environment breeds drift —
which is exactly why the **throwaway, per-change** environment is retained for the one thing a
standing system genuinely cannot do: the **Day-0 birth check** (below). The split: `or-edri-4`
proves **Day-2** (a real, stateful system you iterate on); a fresh throwaway proves **Day-0**
(a system is born correct). Each is used for what it alone can show.

## The loop

1. **Static gates green first.** On the PR: the **System golden gate** (Playground tests)
   and **Check template golden in sync** (Changelog gates). A `templates/system/**` change
   must refresh the committed golden (`bash scripts/check-system-golden.sh --update`) in
   the same PR. These catch typos and template-render drift — not behaviour.

2. **Apply the change to `or-edri-4` and prove it live.**
   - **Template-file changes** → apply the touched `templates/system/**` subtree to
     `or-edri-4`'s live n8n (`refresh-system-agents.yml` with `system_name=or-edri-4`,
     `paths=<touched subtree>`, `post_merge_workflow=<workflow that applies it live>`, e.g.
     `configure-agent-router.yml`). It lands in ~1–2 minutes, no re-provision. This is the
     cheap iterate loop. (To prove a **work-branch** change *before* merging, see
     "prove → merge" below.)
   - **Deeper changes** (the deploy workflow itself) → re-run `or-edri-4`'s
     `deploy-railway-cloudflare.yml`.
   - **Verify live** with the MCP `probe_endpoint` tool (`/healthz`, the n8n UI, the
     Caddy HMAC edge) and/or a real Telegram round-trip. Iterate fix → apply → verify
     until green. Because `or-edri-4` is live and stateful, this catches Day-2 (stateful)
     breakage a fresh build would hide.
   - **Enforced behavioral proof (not optional).** For a behavior change "verify live" is
     the E2E gate: dispatch `e2e-verify.yml` (`system_name=or-edri-4` — the bot drives a real
     inbound message and asserts on the reply) and `deploy-verify.yml` (the Caddy/HMAC edge),
     which emit signed proofs the `E2E verification gate` requires before merge. The gate's
     `proof_systems` **pins the required proof to `or-edri-4`** — a proof from any other
     system is rejected for the enforced surfaces. See `docs/e2e-enforcement-standard.md`.

3. **Promote** = merge to `main` — the change is now **locked into the factory template**,
   and every system born afterwards carries it.

### The Day-0 birth check (the one job a throwaway still owns)
`or-edri-4` is a Day-2 system; it cannot prove that a *freshly provisioned* system is born
correct. For that, stand up a **throwaway** system in **reuse mode** (0 quota):
`provision-system.yml` (`system_name=<throwaway>`, `shared_gcp_project=factory-test-25`) →
`register-system-app.yml` → `deploy-railway-cloudflare.yml`, then run `e2e-verify.yml` against
it to prove the bot answers from birth. Tear it down afterwards with
`decommission-test-system.yml` (user-triggered, never auto-chained) — don't leave throwaways
costing money. This is complementary to the `or-edri-4` loop, not a replacement for it.

## prove → merge (apply a change from a work branch, before promoting)

The loop above is **merge → prove**: step 3 applies what is already on `main` (via
`refresh-system-agents.yml`, which copies from trusted `main` as the broker). That is right
for most iterations, but it forces a merge to *try* a change. To **prove a change on a live
test system BEFORE merging it**, use `prove-on-test-system.yml` — the branch-runnable,
sandbox-scoped sibling:

- It is the **one** factory workflow with no `if: refs/heads/main` guard, so it runs off a
  work branch (dispatch it with `ref=<branch>` — on the MCP `dispatch_workflow` allowlist).
- Its safety is the **sandbox toy-key identity**, never the broker: it authenticates as
  `sandbox-tester-sa@factory-test-25` via the dedicated `sandbox-pool`/`github-sandbox-provider`
  (CEL = the factory repo on ANY ref) and hard-asserts it is not the broker. That identity's
  only power is a **conditioned** `secretAccessor` on `factory-test-25`'s `github-app-*`
  secrets — so it can mint a token for the one throwaway test repo and nothing else (no
  control project, no real system, no broker, no project creation). Even leaked from a
  hostile branch, the blast radius is one throwaway test system.
- It copies the **branch's** `templates/system/<paths>` into the standing test system and
  lands them through that repo's **own PR + green-CI + squash-merge gate** (it retries the
  protected merge rather than reading check status, since the narrow per-system App has no
  `checks:read`), then optionally dispatches `post_apply_workflow` to apply live. The
  per-system App carries `pull_requests:write` (provision-only, from `register-system-app.yml`)
  so the sandbox path can open+merge its own PR without bypassing CI.

So the full prove → merge flow: stand up a throwaway test system once (broker, from `main`,
Or-gated) → iterate on a work branch, dispatching `prove-on-test-system.yml` (`ref=<branch>`)
to apply+prove each change live before merge → promote (merge to `main`) → tear down. The
one-time identity setup is `bootstrap-sandbox-tester.yml` (`scripts/bootstrap-sandbox-tester.sh`,
idempotent, refuses any project but `factory-test-25`).

> **The merge-blocking proof must still come from `or-edri-4`.** The sandbox prove → merge
> path above (a `factory-test-25` throwaway) is for **early branch confidence** — it cannot
> satisfy the `E2E verification gate`, whose `proof_systems` pins the required proof to
> `or-edri-4` (a proof from any other system is rejected for the enforced surfaces). Before
> merging a bot-behavior / deploy-edge change, apply the branch to **`or-edri-4`** as the
> broker and run `e2e-verify.yml` (`system_name=or-edri-4`, `gcp_project=factory-test-21`,
> `target_ref=<branch>`) to produce the proof the gate requires. The throwaway proves the
> branch *quickly*; `or-edri-4` proves it *for the merge*.

## What stayed, what went

- **Kept — the golden gate** (`scripts/render-system-golden.sh`,
  `scripts/check-system-golden.sh`, `tests/golden/system/`, `scripts/check-golden-sync.sh`
  in Changelog gates, the "System golden gate" step in Playground tests). It is a pure
  **template-integrity** guard — it catches accidental template-render drift and keeps the
  envsubst allow-list byte-identical across the renderer, provision, and validator. It has
  nothing to do with a live system, so it stands on its own.
- **Retired — the standing reference system**: its descriptor, smoke script, config
  reader, scheduled reconciliation workflow, and watchdog registration were removed, and
  the live `or-factory-reference` system (on `factory-test-18`) was decommissioned.
- **Reinstated, differently — a standing *proving* system on `or-edri-4`**: the *role* of a
  permanent system to prove changes against is back, but on `or-edri-4` and with the three
  anti-decay guards the old one lacked (mandatory + CI-enforced, fresh-proof-per-change,
  heartbeat-audited — see "`or-edri-4` as the standing proving system" above). It is a
  proving ground, not a reconciled "reference"; there is no descriptor/smoke/reconciliation
  machinery to rot.

## Driving it

`/dev-stage-factory` (factory-only) is the staged, documented wrapper around this loop —
use it for any provisioning-process development. `refresh-system-agents.yml` is the
in-place apply tool; it is on the MCP `dispatch_workflow` allowlist.
