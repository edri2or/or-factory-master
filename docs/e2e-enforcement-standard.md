# The Factory E2E Enforcement Standard

> Status: introduced by the `e2e-enforcement-standard` development (2026-06).
> This is the *standard* — the professional basis, the risk rubric, and the
> registry design — that generalizes the bot-specific `e2e-verification-gate`
> (see `docs/e2e-verification-gate.md`) into an enforced, risk-tiered E2E gate
> for **every** runtime surface the factory builds.

## Why this exists

The first E2E brake (`e2e-verification-gate`) closed a real gap — but only for the
**Telegram bot**: its "behavior-bearing files" are the n8n workflow JSONs +
`configure-agent-router.yml`, and its proof is a real message through
`telegram-in/inbound`. The factory builds and changes **~11 other runtime
surfaces** that equally need end-to-end proof, and almost none are enforced —
"green CI" still impersonates "it works" everywhere else. This standard
generalizes the brake so that, for any surface above a risk threshold, an agent
cannot declare "works" and merge without a proof that drives that surface's real
behavior.

## The professional standard (dated)

- **Risk-based testing** — don't E2E everything; decide by **risk = criticality ×
  failure-probability × blast-radius**. High-risk surfaces get enforced E2E; low-risk
  get cheaper checks. ([Risk-based testing — Wikipedia](https://en.wikipedia.org/wiki/Risk-based_testing);
  [LambdaTest, 2025](https://www.lambdatest.com/learning-hub/risk-based-testing); Gartner
  predicts 30% of test automation will be risk-based by 2025.)
- **Right test at the right layer** (the test pyramid) — E2E is reserved for critical
  end-to-end journeys; service boundaries use contract tests; logic uses unit/integration.
  *"Not every test belongs in the PR gate."* ([Bunnyshell — E2E for Microservices, 2025/26](https://www.bunnyshell.com/blog/end-to-end-testing-for-microservices-a-2025-guide/))
- **Generic enforced verification — the "can-i-deploy" model** — the closest professional
  analog to our brake: before promotion, ask *"has this version been verified?"* — if there
  is no valid verification result, the promotion is **blocked**. The Pact Broker does this
  generically for any contract serializable to JSON, recorded via `record-deployment`.
  ([Pact Docs — Can I Deploy](https://docs.pact.io/pact_broker/can_i_deploy);
  [Pactflow, 2024/25](https://pactflow.io/blog/can-i-deploy/);
  [Total Shift Left, 2026](https://totalshiftleft.ai/blog/contract-testing-for-microservices))
- **Anti-pattern: one shared monolithic E2E gate** — a single shared E2E gate creates a
  synchronous dependency between otherwise-independent units and slows delivery. → prefer a
  **per-surface** gate, not one big one. ([Bunnyshell / Gravitee, 2025](https://www.gravitee.io/blog/contract-testing-microservices-strategy))
- **Deployment/release gates + synthetic monitoring** — automated post-deploy conditions
  that block promotion until a real health signal (synthetic traffic over the real flow)
  passes. ([Microsoft Learn — Deployment gates](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/approvals/gates);
  [SRE School — Synthetic Monitoring, 2026](https://sreschool.com/blog/synthetic-monitoring/))
- **DORA 2024 / Definition of Done** — verification is part of DoD; it directly targets
  **Change Failure Rate** and the 2024 metric **deployment rework rate** — exactly what a
  "silent failure" degrades. ([2024 Accelerate State of DevOps Report](https://services.google.com/fh/files/misc/2024_final_dora_report.pdf))

**Ranking for the factory.** The right frame is a **per-surface, risk-tiered registry in
the can-i-deploy model**: each surface declares itself, and only surfaces above a risk
threshold get an enforced required-check; the rest get an advisory/observational check.
This honors both "right layer" and the "no single shared gate" anti-pattern.

## The decision rubric — does this development need an *enforced* E2E gate?

Score the surface a change touches:

| Factor | Low (0) | Medium (1) | High (2) |
|---|---|---|---|
| **Criticality** — is it on a user-facing or money/secret path? | internal/dev-only | supporting | user-facing / auth / secrets |
| **Silent-failure likelihood** — can it break green? | loud failure | sometimes silent | classically silent (a dead tool, a disabled edge check) |
| **Blast radius** — who's affected if it ships broken? | one dev | one system | all systems / the factory |

- **Score ≥ 4 → `risk_tier: critical/high` → `enforce: true`** (a required status check; merge blocked without a fresh real proof).
- **Score 2–3 → `risk_tier: medium` → `enforce: false`** (advisory: the gate warns but does not block; or an observational audit).
- **Score ≤ 1 → not registered** (unit/contract tests at the right layer suffice).

This is the factory's application of risk-based testing: the brake is reserved for surfaces
where green genuinely impersonates working and the cost of a silent failure is high.

## The 5-part surface pattern (generalized from the bot gate)

The bot gate already embodies a clean, reusable pattern. Generalizing it means describing
**each** surface with the same five parts, in a data registry rather than in code:

1. **Trigger paths** — which files, when changed, demand a proof.
2. **Proof producer** — the workflow that drives the surface's REAL behavior.
3. **Proof artifact** — what attests success (`e2e-proofs/<surface>-*.json`).
4. **Hash binding** — what is hashed to bind the proof to the proven code (so editing it
   after proving invalidates the proof).
5. **Enforcement** — required status check (if `enforce: true`) vs advisory.

## The registry — `e2e-surfaces.json`

A data file (twin of `monitoring/watchdog-registry.json`) where every surface is one entry:

```jsonc
{
  "id": "telegram-bot",
  "name_he": "בוט inbound",
  "risk_tier": "critical",
  "trigger_paths": ["workflows/n8n/*.json", ".github/workflows/configure-agent-router.yml"],
  "proof_producer": "e2e-verify.yml",
  "proof_glob": "e2e-proofs/telegram-bot-*.json",
  "hash_inputs":  ["workflows/n8n/*.json", ".github/workflows/configure-agent-router.yml"],
  "freshness_days": 14,
  "enforce": true
}
```

`scripts/lib.sh` reads this registry (trigger paths + hash inputs per surface) and
`scripts/check-e2e-proof.sh` becomes surface-aware: for each `enforce: true` surface the
diff touched, it requires a valid, fresh proof (the same run+artifact+content_hash
cross-check that already works for the bot); `enforce: false` surfaces only warn. The bot
is registry **entry #1** — unchanged behavior, zero regression.

## Gate placement — merge-gate vs deploy-gate

Not every surface is gated at the same point. A surface carries a `gate` field:

- **`gate: "merge"` (default)** — per-system surfaces (the bot, the deploy-edge) where a
  branch's change can be proven on a live system *before* merging. These are `enforce: true`
  and blocked by the `E2E verification gate` required check (`check-e2e-proof.sh`): no fresh
  proof in the diff → no merge.
- **`gate: "deploy"`** — a **shared service** (the MCP gateway: one Cloud Run service for
  *all* systems, `services/mcp-server/`). You cannot safely prove a branch's gateway change
  without deploying it to everyone, so the right place to block is at **deploy time**, not
  merge time — the can-i-deploy model. These surfaces are `enforce: false` (so
  `check-e2e-proof.sh` ignores them at merge — never forcing a risky branch deploy), and are
  enforced instead by a **post-deploy smoke gate** inside `deploy-mcp-server.yml`: after the
  new revision deploys, the three smokes (`scripts/{factory,n8n,google}-mcp-smoke.py`) drive
  `/factory`, `/n8n`, `/workspace` against it; any failure **fails the deploy** so the broken
  revision is not trusted. (v1 fails the job post-deploy; the documented hardening is a
  blue-green `--no-traffic` candidate smoked before promoting traffic — pre-traffic prevention.)

This split is deliberate: a single shared E2E merge-gate across independent units is the
anti-pattern (it couples them and slows delivery). Per-surface placement keeps each gate at
the layer where it can be proven safely.

## The factory's E2E surfaces — gap map (2026-06)

| Surface | Enforced E2E today? | Gap (where green ≠ working) | Proposed tier |
|---|---|---|---|
| **Telegram bot inbound** | ✅ yes | — (proven; not yet generalized) | critical |
| **Deploy + Caddy/HMAC edge** | ❌ | `/healthz` is checked; a bad-signature **401** and rate-limit **429** are never driven live — a regression that opened the HMAC edge would pass green | high |
| **MCP `/factory`, `/n8n`, `/workspace`** | ❌ (manual smokes exist) | smokes are `workflow_dispatch`-only, not required — a deploy can break tenant isolation / scopes unblocked | high (factory-wide) |
| **Provisioning Day-0 birth** | ❌ | a fresh system is created but never proven to actually work | high |
| **MCP server deploy (Cloud Run)** | ❌ | no post-deploy probe — the service can be dead while CI is green | medium |
| **Event emission (Axiom/Telegram/Linear)** | ❌ (soft-fail) | delivery failures are swallowed; no proof an alert arrived | medium |
| **OIL auto-fix** | ⚠️ partial | the reproducer is a unit test in `env -i`, not an E2E of the deployed system | medium |
| **gcp-action / repo-delete / system-request** | ❌ | the action's *result* is never asserted (created/deleted/granted ≠ works) | medium |
| **Workspace OAuth bootstrap** | ❌ | the token is stored but never validated for its scopes | medium |

## Rollout (risk-ordered, each proven live before promote)

- **Stage 1** — this document + the risk rubric.
- **Stage 2** — registry infrastructure: `e2e-surfaces.json` + generalize
  `lib.sh`/`check-e2e-proof.sh`, with the bot as entry #1 (zero behavior change, proven by
  the existing local fixtures + the live bot still blocking/passing).
- **Stage 3** — Deploy/Caddy-HMAC surface (`enforce: true`): `deploy-verify.sh` drives the
  edge live (401/200/429), highest ROI of the missing gates.
- **Stage 4** — the three MCP gateway surfaces: promote the existing smokes to signed,
  required proof producers (factory-wide, since the gateway is shared).
- **Stage 5** — Provisioning Day-0 + observability delivery + post-deploy MCP health, as
  **advisory** (`enforce: false`) checks, so they never choke delivery.

**Policy:** only `critical/high` surfaces become required contexts (Stages 3–4). `medium`
surfaces (Stage 5) are advisory/observational — risk-based, not a blanket gate.

## The generalized super-test

For every surface flagged `enforce` in the registry: an agent cannot declare "works" and
merge a change to it without a fresh proof that drives **that surface's** real behavior —
not just for the bot, for everything that needs it.
