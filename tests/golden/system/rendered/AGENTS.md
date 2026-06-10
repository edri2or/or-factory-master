---
apiVersion: factory.internal/v1
kind: System
metadata:
  name: golden-reference-system
  created: 2026-01-01T00:00:00Z
  factoryRunId: "000000000000"
  factoryRunUrl: https://github.com/edri2or/or-factory-master/actions/runs/000000000000
  provisionMode: test
spec:
  gcpProjectId: golden-reference-system
  gcpProjectNumber: "000000000000"
  publicUrl: https://n8n-golden-reference-system.or-infra.com
  healthUrl: https://n8n-golden-reference-system.or-infra.com/healthz
  repo: edri2or/golden-reference-system
  serviceAccounts:
    runtime: runtime-sa@golden-reference-system.iam.gserviceaccount.com
    deploy: deploy-sa@golden-reference-system.iam.gserviceaccount.com
  wifProvider: projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider
---

# System: golden-reference-system

This repository was provisioned automatically by **or-factory-master** on 2026-01-01T00:00:00Z
(provision [run #000000000000](https://github.com/edri2or/or-factory-master/actions/runs/000000000000)). It contains a self-contained system
built on n8n + Postgres on Railway, behind a Caddy gateway and Cloudflare DNS.

## מי המשתמש ואיך עובדים מולו (קבוע לכל המערכות)

**מי הוא:** אור אדרי — הבעלים והמפעיל של המערכת. לא איש טכני ואין לו רקע טכני; הוא בונה ומפעיל אוטומציות, לא קורא קוד. יצירתי, סקרן, עם ADHD (מתקשה בריבוי פרטים טכניים ובהחלטות עמוסות). הוא האדם האנושי היחיד במערכת.

**איך לדבר איתו:** בעברית, תמיד. שפה פשוטה, אפס ז'רגון, אנלוגיות מהחיים. תן לו תחושת שליטה (תיעוד קצר, התקדמות ברורה) בלי להציף במלל — מצא את המינון.

**תפקידך מולו:** אתה הידיים והעיניים שלו. הוא לא נוגע בטרמינל, לא קורא לוגים, לא לוחץ כפתורים. אתה מבצע את כל הפעולה הטכנית ועוצר בגבולות ברורים כדי שיאשר — מתוך דוח קצר ופשוט בעברית. כשמשהו נכשל: אל תעתיק לוג גולמי. הבן בעצמך, והסבר בעברית פשוטה מה קרה ומה האפשרויות.

**גבולות אדומים (אנושיים):** אל תדחוף אותו לעבודה טכנית ידנית. אל תציף אותו במלל. אל תבצע מהלך גדול או יקר בלי אישור מפורש ממנו קודם.

## Purpose

Golden reference render — deterministic fixture

**Agent: if you encounter `TODO(human):` anywhere in this repo, STOP and ask the user
to provide the missing context. Do not guess. Do not proceed with the task until resolved.**

## Identity

- **Agent name**: Golden Agent
- **GCP Project**: `golden-reference-system` (number: 000000000000)
- **Public URL**: https://n8n-golden-reference-system.or-infra.com
- **Health check**: https://n8n-golden-reference-system.or-infra.com/healthz
- **Repo**: https://github.com/edri2or/golden-reference-system
- **Provision mode**: test (normal = own GCP project; reuse = shared test project; adopt = existing/recovered GCP project whose id differs from the repo name — `gcpProjectId` above is the source of truth, not the repo name)
- **Provisioned at**: 2026-01-01T00:00:00Z
- **Factory run**: [000000000000](https://github.com/edri2or/or-factory-master/actions/runs/000000000000)

## Service Accounts and WIF

- **Runtime SA**: `runtime-sa@golden-reference-system.iam.gserviceaccount.com`
- **Deploy SA**: `deploy-sa@golden-reference-system.iam.gserviceaccount.com`
- **WIF Provider**: `projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

The deploy workflow authenticates as deploy-sa via WIF (no SA keys). Runtime workloads run as runtime-sa.

## What was provisioned

The factory has set up the following components for this system:

- **n8n** 2.25 on Railway (with Postgres + persistent volume)
- **Caddy gateway** in front of n8n, enforcing HMAC-SHA256 on `/webhook/*` and per-IP rate limits
- **Cloudflare DNS** + Let's Encrypt certificate (DNS-only mode)
- **`.claude/`** package — slash commands and skills (incl. `gcp-hands-client`)
- **Agent Router + Telegram Chat Bot** — n8n workflows wired by `configure-agent-router.yml`: a classifier routes to ops/code/research/infra/unknown sub-agents, and an inbound Telegram bot turns the system's bot token into a smart, system-aware chat agent. → see [**Telegram Chat Bot**](#telegram-chat-bot) below.
- **Observability emitter** — `scripts/emit-event.sh` ships factory.deploy.* events to Axiom/Telegram/Linear
- **Claude n8n connector** — control this system's n8n directly from Claude.ai via the factory's central MCP gateway: add a custom connector with URL `https://factory-master-actions-mcp-140345952904.me-west1.run.app/n8n/golden-reference-system/mcp` and "Login with Google" (allowlisted account). No token. The deploy sends this connector link to your Telegram when it finishes.
- **Queue mode** *(optional, off by default)* — see [**Queue mode (scaling)**](#queue-mode-scaling) below

## Telegram Chat Bot

This system ships with a per-system Telegram chat bot (Phase F). It turns the Telegram
bot token already in Secret Manager into a smart, system-aware conversational agent —
natural language, persistent memory, learned style, and **read-only** access to live
system data — without touching the Agent Router's classifier or its Macro-F1 CI gate.

### Two separate bots (one shared chat)

| Bot | Token secret | Direction | Driven by |
|---|---|---|---|
| 🤖 **Chat bot** | `n8n-telegram-bot-token` (per-system) | two-way — answers questions, knows the system | `tg-inbound` workflow in n8n |
| 🟡/🔴 **Alerts bot** | `telegram-bot-token` (copied from control) | one-way — errors / warnings | `scripts/emit-event.sh` |

Both talk to the same `chat_id` (`n8n-telegram-chat-id`, seeded from `telegram-chat-id`).
In a private chat `chat_id == user_id`, so the same operator faces both bots.

### Inbound flow

```
operator → Telegram → https://n8n-golden-reference-system.or-infra.com/webhook/telegram-in/inbound
  → Caddy: /webhook/telegram-in/* is exempt from HMAC and authed instead by Telegram's
    X-Telegram-Bot-Api-Secret-Token header (value = secret n8n-telegram-webhook-secret;
    wrong/missing header → 401)
  → tg-inbound: normalize + filter to the operator chat_id → dedup → route:
      • text / approval-press → Agent Router (unchanged): classify → sub-agent → reply
      • photo / image-document → tg-vision: getFile → OpenRouter VLM → OCR + Hebrew
        description (image text is untrusted; defensive prompt; Gemini fallback)
      • voice → tg-voice-stt: getFile → Deepgram Nova-3 (he) → transcript →
        feed back into the router as text
  → tg-inbound → Telegram sendMessage (🤖) → operator
```

`tg-inbound` calls the router over the **internal** `http://n8n.railway.internal:5678/webhook/agent-router`
— the public domain would be blocked by Caddy's HMAC.

### n8n workflows (Phase F)

- **`tg-inbound`** — inbound handler (active): webhook → normalize + chat_id filter → Dedup Guard (`tg_updates_seen`) → route text/approval to the router, a photo/image-document to `tg-vision`, or a voice message to `tg-voice-stt` → 🤖 reply.
- **`tg-vision`** — image-understanding subworkflow (inactive; Execute-Workflow-Trigger): the image branch of `tg-inbound` calls it with `{file_id, chat_id, file_size, mime}` → Telegram getFile → robust base64 data-URI → OpenRouter VLM (`qwen/qwen3-vl-30b-a3b-instruct`, defensive system prompt; `google/gemini-2.5-flash` fallback) → OCR + visual description in Hebrew → L5-style egress validation → reply. 20 MB guard; reuses the existing OpenRouter credential (no new secret); image text is treated as untrusted (OWASP LLM01). Independent of the Agent Router.
- **`tg-voice-stt`** — voice-to-text subworkflow (inactive; Execute-Workflow-Trigger): the voice branch of `tg-inbound` calls it with `{voice_file_id, chat_id}` → Telegram getFile → download audio → Deepgram Nova-3 (Hebrew, `language=he`) → extract transcript → feed back into the Agent Router as if the user had typed it. Gated on `deepgram-api-key`: if the secret is missing in SM, `configure-agent-router.yml` strips the voice branch + `tg-voice-stt` upsert is skipped (graceful degradation — voice messages get no reply, text/image keep working).
- **`tg-proactive`** — daily 08:00 UTC (active): aggregates the last 24 h (audit + spend) + recent failed executions → Haiku summary → 🟢 message.
- **`style-refresh`** — daily 03:00 UTC (active): reads the last 50 messages → Haiku extracts a style-profile JSON → upserts `style_profile`.
- **`postgres-named-queries`** — subworkflow (Stage 108): the read-only query whitelist behind the `postgres_named_query` tool (below).
- **`db-setup`** — one-shot manual workflow: creates the 7 Postgres tables (idempotent, `IF NOT EXISTS`).
- **`github-readonly`** — subworkflow (Stage 114): read-only live GitHub for `ops-agent` + `unknown-agent` (recent CI runs / commits / open PRs, and file contents via `read_file:<path>`) as the system's own GitHub App; installed only when the `github-app-*` secrets are present.
- **`railway-readonly`** — subworkflow (Stage 114): read-only live Railway for `ops-agent` + `unknown-agent` (latest deploy status / recent deployment logs); installed only when `railway-api-token` is present.

The Agent Router and its five sub-agents (`ops`, `code`, `research`, `infra`, `unknown`)
pre-date Phase F; `unknown-agent` and `ops-agent` were upgraded with the system-aware tools below.

### Postgres tables (created by `db-setup`)

| Table | Key columns | Purpose |
|---|---|---|
| `n8n_chat_histories` | `session_id` (= `tg:<chat_id>`), `message` (JSONB) | Conversation memory (Postgres Chat Memory) |
| `style_profile` | `chat_id` (PK), `profile` (JSONB), `refreshed_at` | Per-operator learned style; refreshed daily |
| `audit_log` | `ts`, `chat_id`, `action`, `params`, `decision`, `intent_confidence` | Bot decisions / intent records |
| `spend_log` | `ts`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd` | LLM spend per call (see Deferred) |
| `tg_updates_seen` | `update_id` (PK), `seen_at` | Telegram update dedup |
| `pending_actions` | `chat_id`, `description`, `tool`, `args`, `status` | HITL approval queue (see Deferred) |
| `events` | `ts`, `chat_id`, `action`, `dow`, `hour` | Activity events for future pattern analysis |

### System-aware tools (read-only)

`unknown-agent` (general chat) and `ops-agent` both carry these read-only mechanisms — including the two live GitHub/Railway readers below, so the general chat agent can answer GitHub/file/Railway questions in any phrasing, not only when a message is classified as an operational task:

- **`postgres_named_query`** — a fixed whitelist of four read-only SELECTs (no free SQL): `style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`.
- **SYSTEM-INFO injection** — `configure-agent-router.yml` injects a JSON block (`system_name`, `n8n_domain`, `gcp_project_id`, `gcp_region`, `runtime`, `capabilities`) into the system prompt at install time, so the bot can answer "where am I / what am I" with no runtime dependency.
- **`github_readonly`** (`ops-agent` + `unknown-agent`) — live read-only GitHub for this repo as the system's GitHub App: send one raw string `ci_runs` | `recent_commits` | `open_prs`, or `read_file:<path>` to read a repo file's text contents (e.g. `read_file:AGENTS.md`; directory paths return a listing of that folder's entries, files >1 MB are out of scope). It mints a short-lived installation token inside n8n (built-in JWT node, RS256) and caches it; returns `{ok, command, data}` (for `read_file`, `data` is `{path, size, content, truncated, html_url}`), and `html_url` links are allowed in replies.
- **`railway_readonly`** (`ops-agent` + `unknown-agent`) — live read-only Railway: send one raw string `deploy_status` | `recent_logs`. Returns `{ok, command, data}`, and `staticUrl` links are allowed in replies.
- **file resolver** (in the Agent Router) — imprecise or misspelled file references are auto-resolved to a real path before the agent answers, so the bot never gives up or invents a filename. A `file-catalog-refresh` workflow keeps an hourly snapshot of this repo's file paths in Postgres `file_catalog` (one recursive Git Trees call as the GitHub App); the router extracts the file name the user mentioned and fuzzy-matches it (Jaro-Winkler) against that catalog. A confident match (≥0.85) injects the verified path so the agent calls `read_file` on it directly; a near match (0.70–0.84) asks "did you mean X?" or shows a short numbered list; below that it offers to list a folder. Soft-fail: if the catalog/Postgres is unavailable the router falls back to normal conversation.

Every Postgres path is **soft-fail**: if the Postgres credential is missing, `configure-agent-router.yml` logs a WARN and the bot keeps working with in-memory window memory (the `postgres_named_query` tool is `jq`-stripped out). Likewise `github_readonly` is installed + wired only when the `github-app-*` secrets exist, and `railway_readonly` only when `railway-api-token` exists; otherwise each tool node is `jq`-stripped from **both** `ops-agent` and `unknown-agent` (graceful degradation — never a dangling reference).

### Deferred (Phase F follow-up — intentional, not bugs)

- **Real cost in `spend_log`** — `cost_usd` is currently a constant `0`; wiring real OpenRouter usage is a separate change (handoff Gap 5).
- **HITL for write actions** (`pending_actions`) — there are no write tools yet, so nothing asks for approval; the async approve/deny path will be built when a write tool is added (handoff Gap 1).

Full detail (Hebrew) lives in `docs/telegram-chat-bot.md` in the factory repo
([edri2or/or-factory-master](https://github.com/edri2or/or-factory-master)).

## Queue mode (scaling)

By default this system runs n8n as a **single process** — fine for most workloads. For
heavy, highly-parallel automation it can optionally run in **queue mode**: a **Redis**
broker plus a separate n8n **worker** process, so executions run in parallel through a
queue (Bull) instead of one at a time.

- **Switch:** the repo variable **`QUEUE_MODE`** (default **`false`**). Set it to `true`
  on this repo, then re-run the **deploy** workflow to enable. The deploy also takes an
  optional `queue_mode` dispatch **input** that overrides the variable for one run (so the
  factory can toggle queue mode hands-off without editing the variable). Turning it off
  again is a manual Railway cleanup — treat enabling as a deliberate choice.
- **What it adds:** a `redis:7-alpine` service (with an AOF volume so the queue survives a
  restart) and a second `worker` service (same n8n image, started with the `worker` command, no
  public domain — it never serves HTTP). Webhooks still arrive through the main n8n + Caddy.
- **Cost:** roughly **~$10–20/month** extra (Redis + worker run 24/7). That's why it's
  opt-in per system, not the default.
- **Storage note:** queue mode sets `N8N_DEFAULT_BINARY_DATA_MODE=database` (the in-memory
  `default` mode was removed in n8n 2.0; filesystem binary storage isn't shared across
  separate worker containers), so binary data lives in Postgres — expect the database to
  grow faster.
- **Off = unchanged:** with `QUEUE_MODE=false` the deploy is byte-identical to a non-queue
  system — no Redis, no worker, no extra cost.

## Secrets in GCP Secret Manager (names only — never echo, print, or log values)

This system has access to the following secrets in its own GCP Secret Manager.
The runtime and deploy service accounts have `secretAccessor` on all of them.

### Generic (copied from or-factory-master-control)

- `golden-secret-one`
- `golden-secret-two`

### Runtime shells (filled by the deploy workflow on first deploy)

- `n8n-encryption-key`
- `n8n-owner-email`
- `n8n-owner-password`
- `railway-project-id`
- `railway-project-token`
- `railway-n8n-service-id`
- `railway-postgres-service-id`
- `railway-postgres-volume-id`
- `railway-n8n-volume-id`
- `n8n-telegram-bot-token`
- `n8n-telegram-chat-id`
- `n8n-api-key`
- `webhook-hmac-secret`
- `n8n-telegram-webhook-secret`
- `caddy-railway-service-id`
- `caddy-railway-url`
- `redis-password` *(queue mode only)*
- `railway-redis-service-id` *(queue mode only)*
- `railway-redis-volume-id` *(queue mode only)*
- `railway-worker-service-id` *(queue mode only)*

### OpenRouter (per-system inference key, minted at provision)

- `openrouter-api-key`
- `openrouter-key-hash`

### GitHub App (this system's GitHub identity)

- `github-app-id`
- `github-app-private-key`
- `github-app-installation-id`

## GitHub App (this system's GitHub identity)

This system has its own dedicated GitHub App, **locked to this repo only**. Permissions:
`contents:write`, `metadata:read`, `actions:write`, `workflows:write`, `secrets:write`. Its
credentials live in Secret Manager (`github-app-id`, `github-app-private-key`,
`github-app-installation-id`); the App ID and installation ID are also repo variables `APP_ID`
and `APP_INSTALLATION_ID`.

To act on GitHub **as this App**:

- **Inside a workflow:** use `actions/create-github-app-token` (preferred — auto-masks and
  auto-revokes the token), or read the private key from Secret Manager via WIF and mint a token.
- **Interactively:** never fetch the private key. Use the GitHub tools you already have, or run a
  workflow. See the `github-app-operations` skill for details.

## External Resources

- [GCP Console — Project home](https://console.cloud.google.com/home/dashboard?project=golden-reference-system)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=golden-reference-system)
- [Cloud Run services](https://console.cloud.google.com/run?project=golden-reference-system)
- [Cloud Build history](https://console.cloud.google.com/cloud-build/builds?project=golden-reference-system)
- [IAM bindings](https://console.cloud.google.com/iam-admin/iam?project=golden-reference-system)

## Built-in MCP connections (Claude Code sessions)

This repo ships a committed `.mcp.json`, so every Claude Code session opened on it is
born connected to two MCP servers — zero setup, zero secrets in the repo (authentication
is the central gateway's own browser login, prompted on first use):

- **`factory`** → the factory gateway's main surface (`/mcp`): read-only verify/inspect
  tools over this system's GCP, Railway, Cloudflare, n8n and CI, plus the allowlisted
  `dispatch_workflow`. The same toolset the factory operator works with.
- **`n8n-live`** → the live n8n development gateway for THIS system
  (`/n8n/golden-reference-system/mcp`): browse, validate, and develop workflows against the
  system's own live n8n. Live writes are scratch-only (`dev-*` workflow names) — git
  stays the source of truth.

The per-system telemetry route (`/factory/<system>/mcp`) is deliberately NOT listed
here — that surface is for the n8n agent's bearer-bound `factory_tools` node;
interactive sessions get the richer `factory` server above.

This system is also an MCP **server**: its n8n exposes three read-only tools
(`postgres_named_query`, `github_readonly`, `railway_readonly`) to external agents at
`https://n8n-golden-reference-system.or-infra.com/mcp/system-tools` (Bearer — the
`n8n-mcp-server-token` secret in this system's SM). Deliberately NOT in `.mcp.json`:
that file is committed to the repo and this endpoint requires its secret.

## Forbidden Actions

- **Never echo, print, or log values from Secret Manager.** Reference by name only.
- **Never run `gcloud projects delete`** against this project.
- **Never commit `.env*`, `*.pem`, or `*.key` files.**
- **Never disable branch protection** on the `main` branch.
- **Never modify** the per-system Railway project or Cloudflare DNS without dispatching the deploy workflow.
- **Never give the chat bot free-SQL or write tools.** Its DB access is the fixed read-only `postgres_named_query` whitelist; state-changing actions must route through the (deferred) HITL `pending_actions` flow.
- **Never print, log, or write to disk the `github-app-private-key` or any minted installation token.** Never fetch the private key outside a GitHub Actions workflow.

## Development workflow (`/dev-stage`)

This system inherits the factory's staged-development workflow. Run any non-trivial
change through it so every step is documented, gated, and stop-for-approval:

- **`/dev-stage`** (`.claude/commands/dev-stage.md`) manages a development as ordered,
  documented stages tracked in a living plan file at `devplans/<slug>.md` (instantiated
  from `templates/devplan/DEVPLAN.template.md`). Every development gets its own
  `devplans/<slug>.md`, so parallel developments never collide on the plan file.
- **`/dev-status`** (`.claude/commands/dev-status.md`) gives a plain-Hebrew, on-demand
  summary of the active plan(s) — the user never opens a file.
- A committed `SessionStart` hook (`.claude/settings.json` →
  `scripts/devplan-session-start-hook.sh`) re-injects every active plan's state at the
  start of each session and after compaction, so you re-orient automatically. It is
  read-only and silent when no plan is active.
- **CI gate:** `scripts/check-devplan-updated.sh` runs inside the "Changelog gates" job
  and blocks merging code while any `devplans/*.md` is `status: active` unless an active
  plan is updated in the same diff. Each stage writes its changelog entry to a fragment
  `changelog.d/<YYYY-MM-DD>-<slug>.md` (never the head of `CHANGELOG.md`). Set a plan's
  front-matter `status: completed` at closure to release the gate.

## Further reading (load only when relevant to the task at hand)

*This directory is empty by design — add files here as the system grows.
Each file should describe one concern (e.g. `agent_docs/architecture.md` for service layout, `agent_docs/runbook.md` for operational tasks).*

---

*This document was generated automatically. To update its template, edit `templates/system/AGENTS.md.template` in [edri2or/or-factory-master](https://github.com/edri2or/or-factory-master) — changes propagate to systems provisioned after the edit.*
