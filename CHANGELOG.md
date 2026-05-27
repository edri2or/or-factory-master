# Changelog

## Stage 71 — feat: observability Phase C — system-runtime-audit

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase C** (generated-systems visibility), part 1. New `.github/workflows/system-runtime-audit.yml` — read-only cron every 6h (`:15`, staggered off factory-health-audit) + manual dispatch. Lists each real system (`gcloud projects list --filter=parent.id=123180924297`), HTTP-probes `https://n8n-<system>.or-infra.com/healthz` (universal across Caddy + pre-Caddy), and emits per-system `factory.runtime_audit.ok` (info → Axiom) / `factory.runtime_audit.failed` (error + action_required → Axiom + Telegram + Linear) via `scripts/emit-event.sh`, classifying `2xx`=healthy, `000`=not-deployed (logged, no alert), other=unhealthy. Adds a `factory.runtime_audit.summary` (info → Axiom) with per-run counts. Reuse-mode test systems (shared `factory-test-25`) aren't folder-listed — a noted v1 limitation. Deploy-template emit + per-system Better Stack monitors are deferred to PR-C2. Reuses the Phase A emitter unchanged. |

## Stage 70 — feat: observability Phase B — instrument provision-system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase B**, part 2 of 2. Instruments `provision-system.yml` with soft-fail (`continue-on-error`) emit steps via `scripts/emit-event.sh`: `factory.provision.started` (info, after creds resolved), `factory.provision.completed` (info, after Summary, with `{mode, gcp_project, duration_s}`), and `factory.provision.failed` (error + `action_required` → Axiom + Telegram + Linear, via `if: failure()`). Adds a "Mark start time" step after checkout for duration. Inputs flow via `env:` (never interpolated into the script line). No provisioning logic changed; every emit step is `continue-on-error` so a dead destination never affects a provision. `CLAUDE.md` provision row updated. |

## Stage 69 — feat: observability Phase B — audit emits + factory-health-audit cron

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability **Phase B** (coverage), part 1 of 2. `audit-openrouter-orphan-keys.yml` gains an `Emit observability event` step (`if: always()`, `continue-on-error`): every run emits `factory.openrouter_audit.{clean,action_needed,deletions}` via `scripts/emit-event.sh` (Axiom always; Linear on actionable findings via `action_required`; `info` severity so the existing rich Hebrew Telegram alert is never duplicated). New `.github/workflows/factory-health-audit.yml` — read-only factory-level heartbeat every 6h (+ manual dispatch): confirms `or-factory-master-control` is ACTIVE, the critical SM secrets exist, counts system projects under the Systems folder, and emits `factory.health.ok` (info → Axiom) or `factory.health.degraded` (error + action_required → Axiom + Telegram + Linear). `CLAUDE.md` Workflows table + `docs/observability.md` §9 updated. `provision-system.yml` instrumentation lands in part 2 (separate PR). |

## Stage 68 — fix: emitter ingests to the Axiom EU edge endpoint; drop setup workflow

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: point Axiom ingest at the **edge** endpoint `https://eu-central-1.aws.edge.axiom.co/v1/ingest/factory-events` — verified live by `_axiom-setup.yml` (`{"ingested":1,"failed":0}`). The `factory-events` dataset is on the EU edge deployment, which serves only the `/v1/ingest/<dataset>` path (the `/v1/datasets/<ds>/ingest` shape 404s there) and accepts only `xaat-` API tokens (now stored in `axiom-api-key`; PATs can't ingest). Removes the one-shot `.github/workflows/_axiom-setup.yml` now that it has minted + stored the token. Closes the Axiom leg of the observability pilot (DoD #2). |

## Stage 67 — fix: Axiom setup workflow ingests at the EU edge host

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `_axiom-setup.yml`: server-side probes proved the pilot's Axiom failures were a multi-region issue — PATs can't ingest (only `xaat-` API tokens can), and the `factory-events` dataset sits on an EU **edge deployment** (`cloud.eu-central-1.aws`), so ingest must target the edge host `eu-central-1.aws.edge.axiom.co`, not `api.eu.axiom.co` (403) or `api.axiom.co` (400 region). The workflow now derives the edge host from the org's `defaultEdgeDeployment`, mints the scoped API token on the control plane, verifies ingest at the edge host (both path shapes), and stores it as the latest `axiom-api-key`. `emit-event.sh` gets pointed at the edge host next, once the workflow confirms the exact URL. |

## Stage 66 — chore: one-shot Axiom setup workflow (scoped ingest token)

| PR | Type | Summary |
|---|---|---|
| TBD | chore | One-shot `.github/workflows/_axiom-setup.yml` (`workflow_dispatch`, deleted after use): reads `axiom-pat` (a Personal Access Token) from SM via the broker SA (WIF) and, server-side, probes Axiom (org/region/method), creates a **scoped API token** (`ingest`+`query` on `factory-events`) via `POST /v2/tokens`, verifies it can ingest, and stores it as the latest `axiom-api-key` version. Resolves the pilot's Axiom 403: a PAT requires the `x-axiom-org-id` header for ingest, whereas a scoped API token works with `Authorization: Bearer` alone — which is exactly what `emit-event.sh` sends. Prints only http codes/ids/lengths; token values masked, never logged. |

## Stage 65 — fix: Axiom ingest targets the EU region host

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: switch the Axiom ingest host from `api.axiom.co` (US) to `api.eu.axiom.co` (EU). The Stage 64 error-body logging revealed the exact cause — `HTTP 400 "ingest is only allowed into datasets in the primary region: dataset region: cloud.eu-central-1.aws, deployment region: cloud.us-east-1.aws"` — i.e. the org + `factory-events` dataset live in EU, so ingest must hit the EU data-plane host. Auth/console stay on the global US control plane, which is why the token authenticated against the US host (401→404→400 progression). One-line host change; closes the Axiom leg of the observability pilot. |

## Stage 64 — fix: log Axiom's error body on ingest failure

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `scripts/emit-event.sh`: the Axiom ingest call discarded the response body (`-o /dev/null`), so a non-2xx surfaced only as `http='CODE'` with no reason. Now captures the body and prints `[event] axiom='failed' http='CODE' detail='…'` (truncated to one line; the token is in the header, so no secret leaks). Turns an opaque 4xx into a diagnosable one — prompted by a live `http='400'` on the pilot after the token (401) and dataset (404) issues were resolved. Soft-fail unchanged. |

## Stage 63 — feat: observability foundation (Phase A)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Observability foundation (**Phase A**, infrastructure only): `scripts/emit-event.sh` + `scripts/lib/event-formatter.sh` + `scripts/lib/linear-issue.sh` emit one OTel-SemConv-shaped event and fan it out **soft-fail** to **Axiom** (always; `factory-events` dataset), **Telegram** (severity `warning\|error\|critical`, unchanged channel), and **Linear** (severity `error\|critical` or `action_required=true`; 24h dedup, `auto-created` label, operator's existing `linear-api-key` — no separate bot user). Each destination fails independently and a structured `[event] …` safety-net line is always printed. New `.github/workflows/observability-pilot.yml` (manual `workflow_dispatch`) smoke-tests the pipeline end-to-end; Hebrew docs in `docs/observability.md`. Removes the one-shot `_verify-observability-secrets.yml` (Stage 62) now that broker-SA read access is confirmed. No existing workflow/script/template touched. Older stages (≤55) moved to `docs/changelog-archive/`. |

## Stage 62 — chore: verify broker SA can read the observability secrets

| PR | Type | Summary |
|---|---|---|
| TBD | chore | One-shot `.github/workflows/_verify-observability-secrets.yml` (`workflow_dispatch`, deleted in the Phase A foundation PR): confirms the broker SA can read the six observability secrets from `or-factory-master-control` SM (Axiom, Better Stack, Linear ×2, Telegram ×2) — masks each value, prints length only, never echoes it. Pinned actions, `permissions: {}`, runs on `main` only. Phase A pre-flight before the `emit-event.sh` foundation PR. |

## Stage 61 — fix: Railway projectCreate 504-safe recovery (no orphan, no duplicate)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: a transient Railway `projectCreate` **504** (seen live on `factory-test-102`) creates the project on Railway's side but the id never returns, so the deploy bailed (`projectCreate returned no id`) leaving an orphan that a re-run couldn't reuse — the scoped token returned 0 from `workspace(id).projects` and `projects(first:100)`, so find-by-name failed and a re-run would create a **duplicate**. Root cause: wrong query shape. Verified that `me { workspaces { projects } }` (a different resolver path) *does* list the projects this token can see. Fix: new `_find_project_by_name` helper queries the `me.workspaces` path first (then the two old shapes as fallback); the project step uses it for find-by-name, and on a `projectCreate` that returns no id it now **polls (6×10s) to adopt the project the timed-out call created** rather than failing or blind-recreating. If nothing becomes visible it fails loud with exact remediation (check for an orphan, decommission, re-run) — never creating a duplicate. Makes both 504 recovery and ordinary re-run idempotency self-healing. `bash -n` + `shellcheck --severity=error` clean. Template edit reaches newly-provisioned systems only. |

## Stage 60 — docs: finalize Phase D (per-system Caddy gateway done)

| PR | Type | Summary |
|---|---|---|
| TBD | docs | Phase D documentation finalization (PR 4), after the gateway was verified end-to-end on `factory-test-103` (fresh deploy + idempotency re-run: Caddy deployment count unchanged, public gateway serving, no `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, Caddy access-logging). `CLAUDE.md`: the `deploy-railway-cloudflare.yml` row now describes the completed gateway — Caddy as a third Railway service owning the public domain, constant-time HMAC + per-IP rate-limit on `/webhook/*`, n8n private and proxied (UI/`/rest/*` guarded by n8n's own auth), the new per-system SM keys (`webhook-hmac-secret`, `caddy-railway-service-id`, `caddy-railway-url`), `N8N_PROXY_HOPS=1`, and the `CADDY_FIRST_TIME` re-run no-op. `docs/roadmap.md`: Phase D marked **done** (PRs 1–4 + the hardening fix ticked). `skills/build-system/SKILL.md`: the post-provision deploy handoff now notes the gateway provision + domain swap. Docs-only; no behaviour change. |

## Stage 59 — fix: gateway hardening (re-run idempotency, n8n proxy trust, Caddy access log)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Three targeted fixes after Phase D PR 3 end-to-end testing on `factory-test-101`. (1) **Caddy re-run idempotency** (`CADDY_FIRST_TIME` guard): the "Provision Caddy" step called `_upsert_collection` unconditionally every run; on the re-run it re-upserted identical env vars, triggering a new Caddy deployment that got stuck (Railway scheduler throttle — "Starting Container" + zero logs), removing the healthy deployment and returning `403 host_not_allowed` on every public URL. Fix mirrors the existing `PG_FIRST_TIME` pattern: `CADDY_FIRST_TIME=false` at step start, `CADDY_FIRST_TIME=true` only on `serviceCreate`, upsert wrapped in `if [ "$CADDY_FIRST_TIME" = "true" ]` — re-runs skip the upsert and leave the live gateway untouched. (2) **n8n proxy trust** (`N8N_PROXY_HOPS: "1"`): n8n behind Caddy logged `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` because express-rate-limit saw `X-Forwarded-For` but `trust proxy` was off. Adding `N8N_PROXY_HOPS: "1"` to the n8n env upsert clears the error and gives n8n the correct client IP. (3) **Caddy per-site access log**: the global `log` block only configured the Caddy runtime logger; per-request access logs were missing (hampered debugging). Added a `log { output stdout; format console }` block inside the `:{$PORT:8080}` site block. Validated with `caddy fmt` + `caddy validate --config Caddyfile --adapter caddyfile`. Template edits reach newly-provisioned systems only. |

## Stage 58 — feat: swap the public domain from n8n to Caddy (Phase D PR 3)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Final Phase D wiring. `deploy-railway-cloudflare.yml` moves `n8n-<system>.or-infra.com` off n8n onto the Caddy service so all public traffic flows through the gateway; n8n keeps no public domain. New idempotent steps after the n8n setup: pre-flight (Caddy `/health` + n8n `/healthz`, hard-fail before touching the domain) → determine ownership → `customDomainCreate` on Caddy (detach-from-n8n-first if Railway rejects "domain in use") → repoint the Cloudflare CNAME + `_railway-verify` TXT to Caddy → detach from n8n → wait for LE cert ISSUED on Caddy → end-to-end smoke (public `/webhook` no-HMAC→401, valid-HMAC→reaches n8n, n8n UI/`/healthz` reachable via Caddy). The Provision step gained a guard so a migrated re-run never re-attaches the domain to n8n. **Caddyfile**: the non-webhook fallback now `reverse_proxy`s to n8n (n8n's own auth guards the UI + `/rest/*`; only `/webhook/*` is HMAC-gated), so the operator UI, the deploy's own `/rest/*` steps, and `configure-agent-router.yml` keep working once Caddy fronts the domain. Brief downtime during cert issuance. Template edit reaches newly-provisioned systems only. |

## Stage 57 — fix: push the large deploy workflow via file, not CLI args (Phase D)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | PR 2 grew `deploy-railway-cloudflare.yml` past ~110 KB; its base64 (~147 KB) exceeds Linux's ~128 KB single-arg cap, so `provision-system.yml`'s scaffold-push step died with `jq: Argument list too long` (caught live on `gateway-test-1`). Now passes the base64 to `jq --rawfile` and the body to `curl --data-binary @file` — size-robust. |

## Stage 56 — fix: scaffold the Caddy gateway files into provisioned system repos (Phase D)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Phase D PR 1 added `templates/system/{Caddyfile,Dockerfile.caddy,caddy/hmacguard}` and PR 2 builds the Caddy service from the system's own repo (`source:{repo}`), but `provision-system.yml`'s scaffold step only pushed `.claude/`, `workflows/`, `configure-agent-router.yml`, and `deploy-railway-cloudflare.yml` — so the gateway sources never reached the system repo and Railway's repo build had nothing to build. The scaffold push now also copies `Caddyfile` + `Dockerfile.caddy` + `caddy/` into the repo root (with presence guards) and stages them in the same commit, so a freshly-provisioned system carries everything the Caddy image build needs. Scaffold edit; reaches newly-provisioned systems only. |

> Older stages (Stage 55 and earlier) are archived in [`docs/changelog-archive/CHANGELOG.md`](docs/changelog-archive/CHANGELOG.md).
