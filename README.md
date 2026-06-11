# or-factory-master

A bootstrap factory that provisions new systems on GCP + GitHub. Successor to `edri2or/factory`, redesigned around the principle: **build manually, see every step, continue only after verifying**.

## Start here

1. [`CLAUDE.md`](CLAUDE.md) — operating rules for any agent working in this repo
2. [`docs/bootstrap-record.md`](docs/bootstrap-record.md) — how this factory itself was built
3. [`docs/external-state.md`](docs/external-state.md) — IAM grants and App permissions outside the workflow (for disaster recovery)
4. [`docs/roadmap.md`](docs/roadmap.md) — what's done, what's next, what's deliberately not planned
5. [`CHANGELOG.md`](CHANGELOG.md) — history of merged PRs

For the full list of reference docs, see [Documentation](#documentation) below.

## Provisioning a new system

Manual dispatch only. From the Actions tab:

1. Pick `Provision System (step 1 — GCP + GitHub + secrets)`.
2. Run on `main` (the workflow's WIF binding pins to it).
3. Enter `system_name` — lowercase, 6-30 chars, `[a-z][a-z0-9-]*[a-z0-9]`.
4. Watch the run. ~3 minutes if nothing fails.

What you get: a fresh GCP project, two SAs with WIF, a private GitHub repo with protected `main`, 16 generic secrets, and 4 repo variables. The system can authenticate to its own GCP project from any workflow inside it.

## After provisioning

The provision workflow ends by pushing `deploy-railway-cloudflare.yml` into the new system repo. Dispatching that workflow stands up Postgres + n8n (2.25) on Railway behind a per-system **Caddy gateway**. Caddy holds the public `n8n-<system>.or-infra.com` domain (Cloudflare CNAME + `_railway-verify` TXT, DNS-only — Railway issues the LE cert on Caddy); n8n itself keeps no public domain and is reached only over Railway's private network. Caddy enforces a constant-time HMAC-SHA256 signature plus a per-IP rate-limit on `/webhook/*` at the edge (401/429) and proxies everything else — the n8n UI, `/rest/*` — through to n8n. The deploy also auto-creates the n8n owner account, so the first browser visit lands on the login screen. Credentials: email is `admin@<system>.or-infra.com`; password is `gcloud secrets versions access latest --secret=n8n-owner-password --project=<system>`.

## Repository layout

High-level map — browse the directories for the full contents (this overview is intentionally not an exhaustive file list).

| Path | What's there |
|---|---|
| `CLAUDE.md` | Agent operating rules — read first |
| `README.md` · `CHANGELOG.md` · `DEVPLAN.md` | This file · merged-PR history · legacy root dev-plan (superseded by `devplans/`) |
| `.github/workflows/` | ~50 workflows: provisioning, register/decommission, secrets, observability + OIL auto-fix, MCP smokes, CI gates |
| `templates/system/` | Everything pushed into each new system repo: the `deploy-railway-cloudflare.yml` deploy, the Caddy gateway (`Caddyfile`, `Dockerfile.caddy`, `caddy/hmacguard/`), `.claude/`, the CI bundle |
| `scripts/` | ~50 helper scripts (provision, secret-copy, App-token mint, CI `check-*.sh`) + `scripts/lib/` + `scripts/tests/` (bats) |
| `skills/` | The 5 factory skills (below) |
| `docs/` | Reference docs (see [Documentation](#documentation)) + `research/` + `changelog-archive/` |
| `services/` | The MCP server (`services/mcp-server/`), deployed to Cloud Run |
| `changelog.d/` | Per-development changelog fragments (compiled into `CHANGELOG.md`) |
| `devplans/` | Living `/dev-stage` development plans |
| `monitoring/` · `policy/` | Monitoring config · risk-tier / governance policy |
| `src/` | `src/bootstrap-receiver/` — reference code from the one-time broker-App registration |

### Skills

The factory's supported flows live under `skills/` (see also the Skills table in `CLAUDE.md`):

- `build-system` — provision a new system (GCP + GitHub + secrets)
- `register-system-app` — register the per-system GitHub App after provisioning
- `decommission-system` — tear down a real system (workflow TBD — see the skill's Status)
- `decommission-test-system` — tear down a throwaway test system's per-test resources
- `health-check` — read-only status report of the factory and managed systems

## Documentation

Reference docs under `docs/` (browse the folder for the full set):

**Architecture & history**
- [`bootstrap-record.md`](docs/bootstrap-record.md) — how this factory itself was bootstrapped
- [`external-state.md`](docs/external-state.md) — IAM grants / permissions that live outside the workflows (disaster recovery)
- [`roadmap.md`](docs/roadmap.md) — what's working, planned, and deliberately not planned
- [`capability-first.md`](docs/capability-first.md) — prove a raw capability outside n8n before building an agent around it
- [`google-identities.md`](docs/google-identities.md) — the Google accounts and who is who (authoritative)

**Provisioning, testing & integrity**
- [`live-test-loop.md`](docs/live-test-loop.md) — validating provisioning changes on a throwaway live test system
- [`e2e-verification-gate.md`](docs/e2e-verification-gate.md) — the enforceable brake against "silent green"
- [`master-integrity-matrix.md`](docs/master-integrity-matrix.md) — the master system-integrity matrix
- [`agent-isolation-testing.md`](docs/agent-isolation-testing.md) — proving each agent works alone on real input
- [`skills-audience.md`](docs/skills-audience.md) — factory-only vs shared skills

**Observability & auto-fix**
- [`observability.md`](docs/observability.md) — the events + alerts (observability) layer
- [`oil-autofix.md`](docs/oil-autofix.md) — the OIL Linear-driven auto-fix loop

**Integrations & interfaces**
- [`telegram-chat-bot-factory.md`](docs/telegram-chat-bot-factory.md) — the factory's own bidirectional Telegram bot
- [`telegram-chat-bot.md`](docs/telegram-chat-bot.md) — the per-system Telegram chat bot (Phase F)
- [`system-resource-requests.md`](docs/system-resource-requests.md) — the system → broker resource-request channel
- [`openrouter-integration.md`](docs/openrouter-integration.md) — per-system OpenRouter inference-key integration

**Handoffs**
- [`phase-f-handoff.md`](docs/phase-f-handoff.md) — Phase F handoff notes (what's live, what's open)
