# or-factory-master

**Was** a bootstrap factory that provisioned many isolated systems on GCP + GitHub. For a single user that architecture is overkill, so it is being **folded into one personal system — `or-aios`** (plan: [`devplans/factory-dismantle.md`](devplans/factory-dismantle.md)).

What remains in this repo serves or-aios: the **gateway** (`services/mcp-server/` on Cloud Run, through which or-aios reaches Google), the **backbone** it runs on (the org-wide broker App + WIF + broker SA), CI hygiene, and maintenance/cleanup workflows. The provisioning machinery itself (templates, agent-repos, the E2E gate, the golden gates) has been removed. (The OIL auto-fix path stays wired in the gateway — `services/mcp-server/src/oil-autofix.ts` — so it is *not* part of the removed machinery.)

Guiding principle throughout: **build manually, see every step, continue only after verifying.**

## Start here

1. [`CLAUDE.md`](CLAUDE.md) — operating rules for any agent working in this repo (read first)
2. [`devplans/factory-dismantle.md`](devplans/factory-dismantle.md) — the fold-to-`or-aios` plan and its progress
3. [`docs/google-identities.md`](docs/google-identities.md) — the two Google accounts and who is who (authoritative)
4. [`docs/external-state.md`](docs/external-state.md) — IAM grants outside the workflows (disaster recovery)
5. [`CHANGELOG.md`](CHANGELOG.md) — history of merged PRs

## The live core

- **The gateway** — `factory-master-actions-mcp` on Cloud Run in `or-factory-master-control`. or-aios's `email-agent` + `ops-agent` reach Google (Gmail / Calendar / Drive) **only** through it. Deployed by `deploy-mcp-server.yml`. Mandatory — do not dismantle.
- **The backbone** — the broker App (`factory-master-broker`, org-wide), the github-pool WIF provider, and the broker SA. Every kept workflow and the gateway authenticate through WIF→broker SA.
- **Google oxygen + proof** — `request-workspace-scopes-consent.yml`, `workspace-token-audit.yml`, `google-mcp-smoke.yml`.
- **CI hygiene** — `changelog-check`, `secret-scan`, `supply-chain-check`, `protect-main`, `pipeline-tests`, `playground-tests`, `compile-changelog`, plus the `/dev-stage` machinery.

## Repository layout

High-level map — browse the directories for the full contents.

| Path | What's there |
|---|---|
| `CLAUDE.md` | Agent operating rules — read first |
| `README.md` · `CHANGELOG.md` | This file · merged-PR history |
| `.github/workflows/` | The kept gateway/Google/CI/hygiene workflows + the dismantle/utility workflows (see `CLAUDE.md` › Workflows) |
| `services/` | `mcp-server/` — the gateway / MCP server (Cloud Run); `workspace-mcp/` — the Google Workspace MCP sidecar it fronts at `/workspace/<system>/mcp` |
| `scripts/` | Helper scripts: the gateway deploy renderer, the `protect-main` ruleset, CI `check-*.sh`, `emit-event.sh`, App-token mint + `scripts/lib/` + `scripts/tests/` (bats) |
| `changelog.d/` | Per-development changelog fragments (compiled into `CHANGELOG.md`) |
| `devplans/` | Living `/dev-stage` development plans |
| `templates/devplan/` | The seed for a new devplan |
| `policy/` | Risk-tier / governance policy |
| `docs/` | Reference docs (below) |

## Documentation

Reference docs under `docs/` (load only when relevant):

- [`google-identities.md`](docs/google-identities.md) — the Google accounts and who is who (authoritative)
- [`mcp-connector-setup.md`](docs/mcp-connector-setup.md) — connector URL / issuer; Claude Code on the web
- [`observability.md`](docs/observability.md) — the events + alerts (observability) layer (`emit-event.sh`)
- [`parallel-development.md`](docs/parallel-development.md) — the parallel-development policy behind `/dev-stage`
- [`openrouter-integration.md`](docs/openrouter-integration.md) — OpenRouter inference-key integration + the orphan audit
- [`telegram-chat-bot-factory.md`](docs/telegram-chat-bot-factory.md) — the gateway's bidirectional Telegram bot
- [`capability-first.md`](docs/capability-first.md) — prove a raw capability outside n8n before building an agent around it
- [`bootstrap-record.md`](docs/bootstrap-record.md) — how the control plane was bootstrapped (operational history)
- [`external-state.md`](docs/external-state.md) — IAM grants that live outside the workflows (disaster recovery)
