# Reference system — the standing "reference car" + anti-drift

## Why this exists

Until now the factory verified its provisioning output two ways, both with a blind
spot:

- **Static template checks** (`playground-tests.yml`) — render `templates/system/`
  and assert no leftover placeholders. Catches typos, not behaviour.
- **Throwaway test systems** (reuse mode on `factory-test-25`) — a fresh system is
  built and torn down. Its secrets are wiped and reseeded on every run, so it only
  ever proves a **clean first install** ("Day 0").

Neither keeps a **live, permanent system around** that reflects what provisioning
produces *today*. That is the gap a development can fall through: a change that
installs cleanly on an empty project but quietly breaks a system that already has
state and history ("Day 2"). The **reference system** fills it.

> Analogy: a reference car permanently parked in the workshop. Every modification is
> tried on it first — with the engine running and real mileage on the clock — before
> it ships. We don't assemble a brand-new car from parts each time just to test a
> wiper change.

## The two-layer model (read this part carefully)

The standing reference system does **not replace** the throwaway test system. It is a
**stage before** it. Both stay; they are complementary, in sequence:

| | Layer A — standing reference system | Layer B — `factory-test-25` (unchanged) |
|---|---|---|
| What it is | A new, permanent, isolated system (its own GCP project) | The existing shared, 0-quota test project |
| Lifecycle | Lives, updates, is **never** torn down | Fresh system built from scratch, then discarded |
| Catches | **Day 2** — a change that breaks a system with existing state | **Day 0** — a change that breaks a clean first install |
| When | Develop / test / fix repeatedly *here first* | Final from-scratch acceptance, *after* Layer A is green |

**`factory-test-25`'s role does not change.** This development adds Layer A in front of
it; it does not touch Layer B.

## The drift problem (and how we kill it)

A standing system has one weakness a throwaway one doesn't: it can **drift**. The
source of drift is structural — `templates/system/` is the "mould"; a change to it
only reaches systems provisioned *after* the change. A reference system built once
will therefore age unless something actively keeps it in step with the current
output. If it drifts, it stops being a faithful yardstick and any measurement on it
is worthless.

Two mechanisms keep drift at zero:

1. **Static golden gate** (Stage 2) — a byte-for-byte "golden master" snapshot of the
   rendered `templates/system/` output. CI re-renders and compares on every PR; a
   mismatch fails the build. The golden is refreshed only by a deliberate
   `--update` + a diff a human approves.
2. **Twin anti-drift CI gate** (Stage 3) — a diff that touches `templates/system/**`,
   `provision-system.yml`, or the system's `deploy-railway-cloudflare.yml` **must**
   also touch `tests/golden/system/**`, or CI fails. A twin of the changelog gate.
3. **Scheduled reconciliation** (Stage 4) — a ~6h cron compares the live standing
   system against `built_from_commit` / the golden, and on a gap emits an
   action-required event (Axiom + Telegram + Linear) and can re-build.

Together these are the practical, push-based equivalent of GitOps continuous
reconciliation: one source of truth (`templates/system/` + the golden) and an agent
that keeps desired and actual in lockstep.

## The descriptor

`reference-system/config.yml` is the standing system's single declarative descriptor
(flat `key: value` YAML). `scripts/reference-config.sh` reads it without needing `yq`
on the runner. Runtime ids (`railway_project_id`, `built_from_commit`,
`template_version`) stay empty and `provisioned: false` until Stage 0 (the real
provision) runs; the reconcile flow treats that state as a no-op.

## How it plugs into development

The `/dev-stage-factory` skill (Stage 6, `factory-only`) runs a provisioning-process
development through both layers in order: golden green → apply to the standing system
+ smoke green (Layer A) → finally a fresh from-scratch build on `factory-test-25`
(Layer B). Each boundary stops for Or's approval. Promotion = merge to `main`.

## Status

Tracked in `devplans/reference-system.md` (managed by `/dev-stage`). Stage 0 (the real
provision, which has a cost) runs last, only on Or's explicit go.
