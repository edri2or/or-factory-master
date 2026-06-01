# Roadmap

What's working today, what's planned, what's deliberately not planned.

## Working today

`provision-system.yml` provisions a new system end-to-end:

- GCP project under the systems folder, linked to billing
- 7 enabled APIs
- `runtime-sa` and `deploy-sa` with project-level IAM
- `github-pool` / `github-provider` WIF, pinned by CEL to `edri2or/<system_name>` on `refs/heads/main`
- `deploy-sa` workloadIdentityUser binding for the new repo's WIF principal
- Private GitHub repo with `auto_init`, the deploy-workflow scaffold pushed onto `main`, and branch protection on `main`
- 16 generic secrets copied into the system's Secret Manager
- 4 repo variables (`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_PROJECT_ID`, `SYSTEM_NAME`) set on the new repo

`deploy-railway-cloudflare.yml` (lives in each system repo, pushed by `provision-system.yml`) provisions the deploy plane:

- Railway project named after `vars.SYSTEM_NAME`, Postgres service via `ghcr.io/railwayapp-templates/postgres-ssl:17` with a persistent volume mounted at `/var/lib/postgresql/data`, and an n8n service from `n8nio/n8n:1.121.0` (1.85.4 originally; bumped to patch CVE-2026-21858 "Ni8mare" unauthenticated-RCE)
- n8n env vars wired to Postgres via Railway reference syntax (`${{Postgres.POSTGRES_*}}`, `${{Postgres.RAILWAY_PRIVATE_DOMAIN}}`), plus `N8N_HOST`, `WEBHOOK_URL`, `GENERIC_TIMEZONE`, `N8N_ENCRYPTION_KEY` (generated per-system, persisted to system SM)
- Custom domain `n8n-<system>.or-infra.com` (single-level subdomain — multi-level needs the Railway verify TXT, which Railway's API doesn't reliably surface), with the matching Cloudflare CNAME **and** `_railway-verify.n8n-<system>.or-infra.com` TXT record populated from `status.verificationToken` (DNS-only; Railway issues the LE cert)
- After writing both DNS records, if Railway's `status.verified` is still `false`, the workflow calls `customDomainDelete` + `customDomainCreate` to retrigger the DNS check (Railway only verifies at create time; the `verificationToken` is stable across recreate so the TXT we wrote is still valid). The CNAME target changes on recreate, so the workflow PUTs the updated content into the existing CF record.
- After Railway issues the LE cert, the workflow POSTs to n8n's `/rest/owner/setup` to create the admin user from `n8n-owner-email` (defaults to `admin@<system>.or-infra.com`) + `n8n-owner-password` (fresh-per-run `Aa1!<32 hex>`, both persisted to GCP SM)
- Railway IDs persisted back to system SM (`railway-project-id`, `railway-n8n-service-id`, `railway-postgres-service-id`, `railway-postgres-volume-id`) so the workflow is restart-safe

End-to-end: any standalone service can deploy to Cloud Run via the system's `deploy-sa` WIF and SM, AND every system gets `https://n8n-<system>.or-infra.com` landing on the n8n login screen (not the owner-setup form). What's left is the decommission story (Phase B).

**Agent Router + Macro-F1 gate (Stage 51).** Every system also gets a multi-agent **Agent Router** (classify a free-form message → route to the `ops`/`code`/`research`/`infra`/`unknown` sub-workflow), wired into n8n by `configure-agent-router.yml`. The classifier prompt (`openai/gpt-5-nano`, temp 0) is protected by a deterministic **Macro-F1 ≥ 0.85 CI gate**: `tests/router_battery.yaml` (250 labeled cases) + `scripts/eval_router.py` + `.github/workflows/eval-agent-router*.yml` (WIF-only hybrid — a deterministic precheck on every PR, the full LLM eval on dispatch/push-to-main). A PR that degrades routing quality fails CI; the threshold is never lowered. Verified live on `factory-test-61` (4/4 intent routing). Details in `docs/openrouter-integration.md`.

**Staged development (`/dev-stage`).** New developments in this repo are run as ordered, documented stages tracked in a living `DEVPLAN.md`, enforced by a CI gate (`scripts/check-devplan-updated.sh`, wired into `changelog-check.yml`) that blocks merging dev-code while a plan is `status: active` unless the plan is updated in the same diff — a twin of the CHANGELOG gate, and a no-op when no plan is active. See the "Development workflow" section in CLAUDE.md.

## Phase A — done (stage 7 + today's stabilization)

The deploy plane workflow landed in stage 7 ([#7](https://github.com/edri2or/or-factory-master/pull/7)); today's session shipped the follow-ups that make it actually work end-to-end without intervention: [#26](https://github.com/edri2or/or-factory-master/pull/26) (TXT verify + recreate-on-unverified + single-level subdomain + TLS-wait), [#27](https://github.com/edri2or/or-factory-master/pull/27) (auto owner-setup), [#28](https://github.com/edri2or/or-factory-master/pull/28) (n8n 1.121.0 CVE patch), [#29](https://github.com/edri2or/or-factory-master/pull/29) (CHANGELOG CI gate), [#30](https://github.com/edri2or/or-factory-master/pull/30) (revert Postgres env-vars-before-volume reorder from #28 that hung Postgres in `DEPLOYING`). Validated end-to-end on `factory-test-18`.

## Phase B — Decommission workflow

`skills/decommission-system/SKILL.md` describes the intended flow; the workflow itself doesn't exist yet.

**Where it lives:** in `or-factory-master`, dispatched manually.

**Inputs:** `system_name` + `confirmed_destructive=true` (input validation rejects anything else).

**Outline:**
- Preflight: GCP project and GitHub repo both exist.
- Refuse if `system_name` is `or-factory-master` or `or-factory-master-control` (hard guard).
- Archive the GitHub repo (`PATCH /repos/edri2or/<name> {"archived": true}`).
- Soft-delete the GCP project (`gcloud projects delete`, 30-day grace period).
- *Optionally* call out to Railway / Cloudflare cleanup (only if `vars.RAILWAY_PROJECT_ID` etc. are populated).
- Summary.

**Effort estimate:** half a session.

**Dependencies:** none.

## Phase C — Idempotency / resume (optional)

`provision-system.yml` is not idempotent today: any partial failure leaves orphan GCP resources, and the preflight rejects re-runs because the project already exists. The user's stated principle is "ידני וברור" — fail and restart with a new name. That works fine because the project is small and creating from scratch costs ~3 minutes.

But: as the system grows (real Cloud Run services, real data, real cost), restart-from-scratch becomes expensive. At that point we'd want:

- Each step to detect "already done" (e.g. `if gcloud projects describe ...` instead of `gcloud projects create ...` failing).
- A workflow input `--resume` (or just defaulting to idempotent) so the same `system_name` can be re-run after fixing a transient bug.
- Tagging so we can find "factory-created but not-yet-finished" projects and either complete or clean them up.

**Effort estimate:** 1 session, but only when the cost of restart-from-scratch starts to bite.

**Trigger to start:** first time someone has to wait more than 10 minutes to recover from a failed real-system provision.

## Phase D — feat: per-system Caddy gateway (done)

Today every system exposes n8n's webhook straight to the internet at `n8n-<system>.or-infra.com` — no edge auth, no rate limiting, no HMAC. n8n is an active target: CVE-2026-21858 "Ni8mare" (CVSS 10.0, unauthenticated webhook RCE) was patched in 1.121.0, but 8+ critical n8n CVEs in three months make another vector statistically likely, and NIST SP 800-228 calls for gateway-level protection. Phase D puts a per-system **Caddy 2** reverse proxy in front of n8n as a third Railway service (alongside Postgres + n8n). Caddy owns the public `n8n-<system>.or-infra.com` domain, verifies an HMAC-SHA256 signature on `/webhook/*` with a constant-time compare (per-system secret `webhook-hmac-secret` in SM), rate-limits per source IP, and forwards verified traffic to n8n over Railway's private network (`n8n.railway.internal:5678`). n8n keeps no public domain.

Built with a small custom Caddy handler module (`hmacguard`, constant-time `hmac.Equal`) plus `mholt/caddy-ratelimit`, compiled via `xcaddy` — the only off-the-shelf HMAC plugin (`abiosoft/caddy-hmac`) is unmaintained and compares non-constant-time.

Shipped as atomic PRs, each merged + verified before the next (per CLAUDE.md "build manually, verify each step"):

- **PR 1** ✅ — `templates/system/` gains the `Caddyfile`, `Dockerfile.caddy`, and the `caddy/hmacguard` module + docs. **Zero behaviour change** — no workflow references them yet.
- **PR 2** ✅ — `deploy-railway-cloudflare.yml` creates Caddy as a third service on a temporary `*.up.railway.app` URL; n8n stays public. Caddy verified in isolation (3 smoke checks).
- **PR 3** ✅ — domain swap: `n8n-<system>.or-infra.com` moves from n8n to Caddy; n8n goes private. Brief downtime during the swap.
- **PR 4** ✅ — docs finalization (this PR).
- **Hardening fix** ✅ (post-PR-3) — re-run idempotency (`CADDY_FIRST_TIME` guard so a re-deploy never redeploys Caddy → no Railway-throttle exposure), n8n proxy trust (`N8N_PROXY_HOPS=1`, clears `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`), and a per-site Caddy access log. Verified end-to-end on `factory-test-103`: fresh deploy + re-run leaves the Caddy deployment count unchanged and the gateway serving.

Existing systems are **not** auto-migrated; template edits reach only systems provisioned after merge (an existing system migrates by re-running the updated deploy workflow — now a safe no-op when already migrated).

## Phase E — Cloudflare Worker (Tier-2 edge, deferred)

A Cloudflare Worker in front of Caddy is a legitimate second tier (WAF-style filtering at the global edge) but is **out of scope** until Phase D has proven itself. Graduation criterion: **≥ 3 systems running the Caddy gateway for ≥ 2 weeks** with zero HMAC false positives, zero HMAC false negatives, and no 5xx originating from Caddy itself. A full Cloudflare orange-cloud proxy is *not* an option — Railway won't accept externally-issued certs — so Tier-2 is specifically a Worker, not proxied DNS.

## Phase F — feat: Telegram chat agent (v1 done)

Every system already ships a Telegram bot token, but it was used only for **outbound** alerts (`emit-event.sh`). Phase F closes the one gap — **inbound messages** — by feeding them into the existing Agent Router, turning the bot into a smart conversational + system-aware agent. The classifier and the Macro-F1 gate (`agent-router.json`) are untouched.

Two physically-separate Telegram bots share one `chat_id`: the **chat bot** (`n8n-telegram-bot-token`) and the **alerts bot** (`telegram-bot-token`). n8n's built-in Telegram Trigger registers an internal path that bypasses the Caddy gate, so `tg-inbound` uses a generic **Webhook node** at `/webhook/telegram-in/inbound` + a manual `setWebhook`; Caddy exempts that path from HMAC and authenticates Telegram's `X-Telegram-Bot-Api-Secret-Token` header instead.

Shipped as atomic PRs, each merged + verified before the next:

- **PR 1** ✅ — `templates/system/workflows/n8n/{tg-inbound,tg-proactive,style-refresh}.json` added (inert; nothing installs them yet).
- **PR 2** ✅ — Caddy `/webhook/telegram-in/*` exemption + per-system `n8n-telegram-webhook-secret` (minted at provision, injected into Caddy at deploy). Highest-risk PR (the edge), isolated.
- **PR 3** ✅ — activation: `unknown-agent` rewritten to a smart general + system-aware chat agent (Haiku 4.5 + window memory + read-only n8n tools); `configure-agent-router.yml` verifies the system's bot token (soft-halt with a Hebrew instruction if absent — the operator's single manual action), creates the Telegram credential, installs + activates `tg-inbound`, and registers `setWebhook`.
- **Hotfix** ✅ — `tg-inbound` calls the router **internally** (`localhost:5678`); the public path is Caddy HMAC-gated. Caught on the live test of `factory-test-tgbot2`.
- **PR 4** ✅ — docs (`docs/telegram-chat-bot.md`) + suppress the n8n attribution footer (this PR).

Verified end-to-end on a live test system: Telegram message → real, system-aware answer (live n8n workflow data) with the 🤖 prefix.

**Deliberately deferred to a follow-up** (the system's Postgres is Railway-private and its password isn't in SM, so GitHub Actions can't create tables/credentials there — needs live DB discovery): persistent Postgres chat memory, style-profile learning + weekly refresh (`style-refresh`), daily proactive summary (`tg-proactive`), dedup/spend logging, and approval-gated (HITL) write actions — the last of these shipped in the `hitl-write-actions` development: the bot can now REQUEST approved-only write actions (n8n activate/deactivate + GitHub `workflow_dispatch`), each gated on a Telegram ✅/❌ before it runs (async, state-free, Postgres-backed — not Send-and-Wait). See `docs/telegram-chat-bot.md` §6. Existing systems are **not** auto-migrated (re-run deploy + configure to migrate). Full design: `factory-research-context.md`; status + troubleshooting: `docs/telegram-chat-bot.md`.

**Follow-up shipped — web search & research (`research-web-search`).** The bot can now search the live internet. Both the `research-agent` (converted to an `agent` node on `claude-sonnet-4.5`) and the general chat `unknown-agent` carry two Tavily HTTP tools — `web_search_quick` (fast, `search_depth=basic`) and `web_search_extended` (deeper, `advanced`) — created by `configure-agent-router.yml` from the `tavily-api-key` generic secret (soft-fail: stripped if the key is absent). Sources come back in a `[[SOURCES]]` block that "Egress Validation" exempts from URL redaction (full links, deduped, ≤10); the rest of the reply stays allowlist-redacted. Prompts are hardened (never expose tool names, never claim it can't browse, stick to results). A supporting factory workflow — **`refresh-system-agents.yml`** — applies such agent-workflow fixes to an existing live system *without* a re-provision (the cheap iterate-on-one-live-system loop). Verified live on `factory-test-tavily2`. True minutes-long **async deep research** is still deferred (n8n 1.121's Wait-in-subworkflow is unstable, and a synchronous minutes-long search would hit the Telegram webhook timeout). New systems only.

## Phase G — feat: OIL auto-fix loop (done)

The "second half" of the failure mechanism. The observability pipeline already *detects* failures and opens a Linear **OIL** ticket; Phase G adds the autonomous agent that reads the ticket, root-causes it, prepares a small fix, asks Or for one Telegram ✅, merges it (separate `oil-autofix-approver` identity, green-CI-gated), then **verifies the fix on merged `main` and closes the ticket** — or alerts and leaves it open. Or never touches a terminal. Full reference: `docs/oil-autofix.md`.

Shipped as ordered `/dev-stage` stages, each merged + verified before the next:

- **Stage 1** ✅ — read-only investigator workflow (`oil-autofix-investigate.yml`).
- **Stage 2** ✅ — Linear webhook + rules-only triage in the MCP → `repository_dispatch(oil-investigate)`.
- **Stage 3** ✅ — AI fixer + deterministic safety gate (`scripts/oil-autofix-validate.sh`) → DRAFT PR.
- **Stage 4** ✅ — Telegram ✅/❌ approval bridge; the separate `oil-autofix-approver` App merges via native auto-merge. (GitHub Environment protection turned out to be Enterprise-only on a private repo, so the gate is Telegram + branch protection, not a GitHub Environment.)
- **Stage 5** ✅ — post-merge verifier (`oil-autofix-verify.yml` + `scripts/oil-verify.sh`): re-run the reproducer on merged `main` → `issueUpdate(completed)` + closing comment + Telegram, or alert + leave the ticket open. Verified live end-to-end (success: OIL-22 auto-closed; failure: OIL-23 left open + alert — the failure demo itself caught + fixed a real `bash -e` bug in the verifier).
- **Stage 6** ✅ — docs (this section + `docs/oil-autofix.md`).

**Stage 7 (deferred):** widen the fixer beyond bash-runnable `scripts/*.sh` (a TS test runner, etc.) — it will start as its own `/dev-stage`. Today the fixer only touches `or-factory-master` and only code with a bash reproducer; `.github/workflows/*`, WIF/IAM, and secrets are always off-limits.

## Phase H — feat: standing reference system + anti-drift

A live, permanent, isolated "reference car" the factory validates provisioning-process changes against *before* they land in template code — closing the gap between static template checks (which catch typos, not behaviour) and throwaway test systems (which only ever prove a clean Day-0 install). **Two-layer model:** Layer A is the standing system (`reference-system/config.yml`) where a change is applied and proven end-to-end (catches **Day-2** breakage of a system with state); Layer B is the unchanged `factory-test-25`, a fresh from-scratch build (catches **Day-0**). A standing system can **drift** from current output, so three mechanisms keep it faithful. Full reference: `docs/reference-system.md`.

Shipped as ordered `/dev-stage` stages (code gates first, at zero cost; the real provision last):

- **Stage 1** ✅ — descriptor + reader + docs (`reference-system/config.yml`, `scripts/reference-config.sh`, `docs/reference-system.md`).
- **Stage 2** ✅ — static golden gate (`scripts/render-system-golden.sh` + `scripts/check-system-golden.sh` → `tests/golden/system/MANIFEST.sha256`), wired into the **Playground tests** job.
- **Stage 3** ✅ — twin anti-drift CI gate (`scripts/check-reference-sync.sh`): mould↔golden coupling + envsubst allow-list parity, in the **Changelog gates** job.
- **Stage 4** ✅ — scheduled reconciliation (`reference-system-reconcile.yml`, 6h): mould-drift + liveness → `ok` / `drift` event. **Alert-only**, clean no-op until provisioned.
- **Stage 5** ✅ — end-to-end smoke (`scripts/reference-system-smoke.sh`): n8n health behind Caddy, UI via Caddy, edge HMAC guard.
- **Stage 6** ✅ — the `/dev-stage-factory` skill (`audience: factory-only`): runs a provisioning-process development through both layers, every costed move Or-gated.
- **Stage 7** ✅ — docs (this section + `CLAUDE.md` + `docs/reference-system.md`).

**Stage 0 (the real provision of the standing system — `or-factory-reference`, a new GCP project: cost + a project-quota slot) runs only on Or's explicit go**, after the code gates. Until then the runtime pieces (reconcile, smoke) are clean no-ops.

## Things we are deliberately not building

The previous factory had these and they bought less than they cost:

- **factory-actions MCP server.** The read-only inspection MCP (`5b6e937f-*`) already covers every verify/inspect/list we need. Building a write-tools MCP would mean more code paths to secure with no real upside.
- **Manifests** (`factory/manifests/<system>.yml`). The state lives in GCP IAM and GitHub settings; reconstructing it from a manifest would duplicate the source of truth.
- **Evidence records** (`factory/evidence/*.json`). The workflow runs *are* the audit log; GitHub keeps them.
- **Issue-based reporting** (`factory-success` / `factory-failure` labels). The agent watches workflow runs in real time; Issues are async clutter. *(The OIL auto-fix loop (Phase G) is the deliberate, bounded exception — but it is **Linear**-issue-driven, consuming the failure tickets the observability pipeline already opens, not GitHub `factory-*` Issues. See `docs/oil-autofix.md`.)*
- **Handoff gates / direct verification**. The factory builds; the user verifies in the same session via the inspection MCP. If verification fails, fix and re-run — no separate gate workflow.
- **Auto-chain between workflows**. Every workflow is a separate manual dispatch. The user decides when to move to the next step. *(The OIL auto-fix loop (Phase G) is the deliberate, bounded exception: it chains investigate → fix → merge → verify → close, but every step is verified and the merge is human-gated by a Telegram ✅. See `docs/oil-autofix.md`.)*

If you want one of these later, that's fine, but each one needs to justify itself against the "manual, visible, restart-from-scratch" principle in CLAUDE.md.

## Maintenance cadence

There's no scheduled work. Things to watch for:

- **GCP IAM model changes.** If GCP changes what's in `roles/owner`, the workflow's `_bind` for `iam.workloadIdentityPoolAdmin` may become redundant or insufficient. The retries will surface the change.
- **GitHub App permissions.** New endpoints sometimes need new permissions. Add them in the UI when they break something.
- **Old factory archival.** `edri2or/factory` is still live and burning $0. At some point we'll want to formally archive it (`PATCH /repos/edri2or/factory {"archived": true}`). Not blocking anything.

## When to call this "done"

The factory has been done since `v2-test-6` succeeded. Phase A makes it useful for the actual workflow the user cares about (running n8n systems on Railway). Phase B makes it round-trippable. Phase C is a "nice to have."

Stop building when adding features stops paying for itself. Right now, the simplest path is: do Phase A, build the first real system, see what breaks.
