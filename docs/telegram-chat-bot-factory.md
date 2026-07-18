# Factory Telegram chat bot

> **הערה היסטורית (2026-07-18).** במסגרת קיפול `or-factory-master` למערכת אחת שמשרתת את `or-aios`, מכונת-הייצור פורקה: `provision-system.yml`, כל `templates/system/**`, ו-`monitoring/` **כבר לא קיימים בריפו זה**, ו-`deploy-railway-cloudflare.yml` / `configure-agent-router.yml` הם workflows של מערכת-יעד (למשל `or-aios`), לא של המפעל. אזכורים במסמך זה למנגנונים אלה הם **רקע היסטורי — לא מצב חי**. הליבה החיה מתוארת ב-`CLAUDE.md`.

The factory's own **bidirectional** Telegram bot — dogfooding the capability the systems it
builds already have (roadmap Phase F), adapted to the factory's runtime. Or can *ask* the bot
about an alert he received ("מה קרה? למה זה נדלק?") and get a real, factory-aware answer in
Hebrew, and can *request* a small set of safe actions that run only after his Telegram ✅.

It is **not** a port of the systems' n8n bot. The factory core runs on **Cloud Run + GitHub
Actions**; the bot is an extension of the existing Express/MCP service at `services/mcp-server`.
n8n/Railway stay for child systems only (putting the control plane on n8n would create a
circular dependency).

## Architecture — one bot

The factory has **one** Telegram bot (`telegram-bot-token`, the long-standing "alerts" bot). It
both **sends** alerts (incidents / HITL approval prompts for GCP red-ops + repo-delete) **and answers** Or's
questions. Its single webhook posts to the unified `/telegram-webhook`, which routes by update
kind:

```
Telegram (the one factory bot) ──POST /telegram-webhook──▶ services/mcp-server (Cloud Run)
                                                             │  X-Telegram-Bot-Api-Secret-Token (index.ts, constant-time)
                                                             ▼
                              ┌─ callback gcpok:/gcpno:, repo-delete → gcp-approval.ts / repo-approval.ts (HITL ✅/❌)
                              └─ message  OR  callback cdo:/cno:   → telegram-chat.ts
                                                             │  sender allowlist + ~120s freshness (layer 2)
                                                             ▼
                                        OpenRouter (Haiku 4.5) + read-only tools
                                                             │
                              final Hebrew answer ──▶ sendMessage (same bot, observability-client)
```

A Telegram bot can register only one webhook, so the **single** webhook carries *both* kinds of
update and `index.ts` dispatches them. (An earlier iteration used a second, separate chat bot;
it was consolidated onto the one bot at Or's request — fewer moving parts.)

## Files

| File | Role |
|---|---|
| `services/mcp-server/src/telegram-chat-guards.ts` | Pure, side-effect-free guards + parsers (allowlist, freshness, message/callback parsing). No heavy imports → unit-tested hermetically. |
| `services/mcp-server/src/telegram-chat.ts` | The handler: inbound message → LLM tool-calling loop → Hebrew reply; HITL approval send + callback dispatch. Replies reuse the alerts-bot senders in `observability-client.ts`. |
| `services/mcp-server/src/{gcp-approval,repo-approval}.ts` | The HITL ✅/❌ approval bridges (GCP red-ops via `gcpok:`/`gcpno:`; repo-delete) the unified webhook routes to. (The former `oil-approval.ts` bridge was removed in the fold, batch 5b — `oilapprove:`/`oilreject:` is no longer routed.) |
| `services/mcp-server/src/index.ts` | The **unified** `POST /telegram-webhook` (constant-time secret-token check, routes by update kind, always 200). |
| `services/mcp-server/test/telegram-chat-guards.test.mjs` | Unit tests for the pure guards (run by `node --test`, the repo convention). |
| `.github/workflows/deploy-mcp-server.yml` | Mints + mounts the chat allowlist + OpenRouter key; sets the one bot's webhook (`allowed_updates:["message","callback_query"]`). |
| `.github/workflows/playground-tests.yml` | "MCP server build + unit tests" step (`tsc` + `node --test`) — the first PR-time gate over the mcp-server TS. |

## Secrets (GCP Secret Manager, `or-factory-master-control`)

| Secret | Env var | Purpose |
|---|---|---|
| `telegram-bot-token` | (read at runtime) | The one factory bot's token — used to **send** alerts and now the chat replies (via `observability-client`). |
| `telegram-approval-webhook-secret` | `TELEGRAM_APPROVAL_WEBHOOK_SECRET` | The unified webhook's `setWebhook` secret_token (layer 1), shared by chat + OIL approvals. |
| `factory-telegram-chat-allowlist` | `FACTORY_TG_CHAT_ALLOWLIST` | CSV of Telegram user ids allowed to chat (Or's id). Placeholder → closed by default. |
| `factory-telegram-chat-openrouter-key` | `FACTORY_TG_CHAT_OPENROUTER_KEY` | OpenRouter inference key (LLM credential). Minted from `openrouter-management-key`; placeholder if unavailable → LLM dormant. |
| — | `FACTORY_TG_CHAT_MODEL` | LLM model id (default `anthropic/claude-haiku-4.5`). |

## Guardrails (security posture)

1. **secret_token (layer 1)** — `X-Telegram-Bot-Api-Secret-Token` is verified constant-time in
   `index.ts` before any handler runs; absent secret → `503`, mismatch → `401`.
2. **sender allowlist (layer 2)** — only `from.id`s in `FACTORY_TG_CHAT_ALLOWLIST` are served;
   unknown senders are dropped silently (no oracle).
3. **freshness** — messages older than ~120s (or far-future) are dropped (anti-replay).
4. **read-only by construction** — the LLM is handed only read tools; no write/dispatch function
   is imported into the read path, so a prompt injection physically cannot mutate anything.
5. **untrusted input** — the system prompt treats tool output and alert text as untrusted data
   (never obey embedded instructions), never reveals tool names/secrets, and the bot holds no
   standing admin token.
6. **HITL writes** — see below; nothing runs without Or's ✅.

## Read-only tools the LLM can call

`list_recent_workflow_runs`, `get_run_jobs`, `read_job_log`, `factory_inventory`,
`project_quota_status`, `probe_endpoint` (allow-listed URLs only). Typical "why did this fire?"
flow: recent runs → the failed job → its log → a one-line root cause.

## HITL write actions (Stage D)

The bot may **request** an action via the `request_action` tool, which only sends Or a ✅/❌
approval message — it never dispatches. The dispatch happens in `handleChatCallback` **only after
an allow-listed ✅**, mirroring the OIL "AI proposes / human approves" invariant. State is
encoded entirely in the button's `callback_data` (`cdo:<idx>` / `cno:<idx>`, well under
Telegram's 64-byte cap), so a Cloud Run instance swap can never lose a pending approval.

The allowlist is a small, fixed set of workflows (`deploy-mcp-server.yml`,
`publish-static-site.yml`, `deploy-railway-cloudflare.yml`, `configure-agent-router.yml` —
the current `DISPATCHABLE_WORKFLOWS` in `services/mcp-server/src/tools.ts`). Destructive
workflows (`decommission*`, `provision*`) are deliberately **not** reachable by the bot.

## Operational notes

- **Synchronous processing.** Cloud Run only guarantees CPU during a request, so the handler
  processes the LLM loop synchronously (bounded: ≤4 tool rounds, 45s/call) and then `sendMessage`s
  the reply, rather than fire-and-forget. This mirrors the OIL approval webhook.
- **No separate bot.** The bot already exists (the alerts bot) and its token + webhook secret are
  long-standing, so there's nothing to create. The chat answers go dark only if the **LLM** key is
  unset (`llmConfigured()` → a one-line "AI not configured yet" reply). The OpenRouter LLM key is
  minted automatically from `openrouter-management-key` at deploy.

### Activating the chat (one-time)

The only thing needed is to **allow Or's account** to chat (and have the LLM key, which the deploy
mints). Re-run `deploy-mcp-server.yml` with the `chat_allowlist` input set to Or's numeric Telegram
user id (from @userinfobot). The seed step validates it (numeric CSV, mirroring `set-oil-allowlist.yml`;
the id is non-secret) and writes `factory-telegram-chat-allowlist`; the same run sets the one bot's
webhook to `allowed_updates:["message","callback_query"]`. Then Or messages the **existing** bot and
gets an answer. Re-running with a blank input is a safe no-op.

## Not in scope here

Self-healing for **automation/workflow** failures (extending OIL beyond `scripts/*.sh`) is a
separate follow-up development (roadmap Phase G, Stage 7), not part of this bot.
