# The live-test-system loop

The factory's **standing method for validating a provisioning-process change** — any
change to what the factory provisions (`templates/system/**`,
`.github/workflows/provision-system.yml`, the system `deploy-railway-cloudflare.yml`).
The agent always has this capability; it does not need to be reminded of it.

> Short version: prove the change on a **cheap, throwaway, LIVE test system**, then
> promote and tear the test system down. Don't keep a permanent system around to test
> against.

## Why this, and not a standing "reference system"

We previously built a **standing reference system** ("מערכת-ייחוס") — one permanent,
live system kept around to validate changes against, plus a two-layer
`/dev-stage-factory` gate. In practice it **was never used** (the last provisioning
development skipped it entirely), it **decayed** between uses (its Railway Postgres and
GitHub protections silently disappeared), and it **cost money** to keep running — while
the thing that actually caught bugs (including a bug CI was green on) was fixing on a
**live test system** in place and verifying it within minutes.

This mirrors the wider industry move from a long-lived shared staging environment —
which breeds drift, stale state, and maintenance — toward **ephemeral, per-change
environments** that are created when needed and torn down after. A permanent staging box
is only worth it for things we don't do here (sustained load tests, audit-mandated
persistent pre-prod). For us, a fresh live system per development is cheaper, more
faithful, and self-cleaning.

## The loop

1. **Static gates green first.** On the PR: the **System golden gate** (Playground tests)
   and **Check template golden in sync** (Changelog gates). A `templates/system/**` change
   must refresh the committed golden (`bash scripts/check-system-golden.sh --update`) in
   the same PR. These catch typos and template-render drift — not behaviour.

2. **Stand up a live test system (0 quota).** Provision a throwaway system in **reuse
   mode** so it consumes no project-quota: `provision-system.yml` with
   `system_name=<throwaway>` **and** `shared_gcp_project=factory-test-25`, then
   `register-system-app.yml` (same `shared_gcp_project`), then
   `deploy-railway-cloudflare.yml` on the new repo. This is a real, fresh Day-0 build.

3. **Apply the change and prove it live.**
   - **Template-file changes** → `refresh-system-agents.yml` (`paths=<touched subtree>`,
     `post_merge_workflow=<workflow that applies it live>`, e.g.
     `configure-agent-router.yml`). It lands on the live system in ~1–2 minutes, no
     re-provision. This is the cheap iterate loop.
   - **Deeper changes** (the deploy workflow itself) → re-run the system's
     `deploy-railway-cloudflare.yml`.
   - **Verify live** with the MCP `probe_endpoint` tool (`/healthz`, the n8n UI, the
     Caddy HMAC edge) and/or a real Telegram round-trip. Iterate fix → apply → verify
     until green. Because the system is live and stateful, this catches both clean-install
     (Day-0) and stateful (Day-2) breakage.
   - **Day-0 birth check (enforced behavioral proof, not optional).** "verify live" is no
     longer a `/healthz`-or-maybe-Telegram judgement call — for a behavior change it is the
     E2E gate: dispatch `e2e-verify.yml` (the bot drives a real inbound message and asserts
     on the reply) and `deploy-verify.yml` (the Caddy/HMAC edge), which emit signed proofs
     the `E2E verification gate` requires before merge. A freshly born system gets the same
     treatment — run `e2e-verify` against it to prove the bot answers before trusting it.
     See `docs/e2e-enforcement-standard.md`.

4. **Promote** = merge to `main`.

5. **Tear down** the throwaway with `decommission-test-system.yml` (user-triggered, never
   auto-chained): deletes its Railway project, removes its Cloudflare DNS, archives its
   repo. Don't leave live systems costing money.

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

## Driving it

`/dev-stage-factory` (factory-only) is the staged, documented wrapper around this loop —
use it for any provisioning-process development. `refresh-system-agents.yml` is the
in-place apply tool; it is on the MCP `dispatch_workflow` allowlist.
