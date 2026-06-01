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

4. **Promote** = merge to `main`.

5. **Tear down** the throwaway with `decommission-test-system.yml` (user-triggered, never
   auto-chained): deletes its Railway project, removes its Cloudflare DNS, archives its
   repo. Don't leave live systems costing money.

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
