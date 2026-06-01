# Factory Telegram chat bot

The factory's own **bidirectional** Telegram bot — dogfooding the capability the systems it
builds already have (roadmap Phase F), adapted to the factory's runtime. Or can *ask* the bot
about an alert he received ("מה קרה? למה זה נדלק?") and get a real, factory-aware answer in
Hebrew, and can *request* a small set of safe actions that run only after his Telegram ✅.

It is **not** a port of the systems' n8n bot. The factory core runs on **Cloud Run + GitHub
Actions**; the bot is an extension of the existing Express/MCP service at `services/mcp-server`.
n8n/Railway stay for child systems only (putting the control plane on n8n would create a
circular dependency — see the anchor decision in `docs/roadmap.md`, Phase I).

## Architecture

```
Telegram (chat bot)  ──POST /telegram-chat-webhook──▶  services/mcp-server (Cloud Run)
                                                          │
   X-Telegram-Bot-Api-Secret-Token  ── layer 1 (index.ts, constant-time)
   sender allowlist + ~120s freshness ── layer 2 (telegram-chat.ts)
                                                          │
                                                          ▼
                              OpenRouter (Haiku 4.5) + read-only tools
                                                          │
                          final Hebrew answer ──▶ sendMessage (chat bot)
```

Two **physically separate** Telegram bots share one chat: the **alerts bot**
(`telegram-bot-token`, send-only + OIL approval callbacks on `/telegram-webhook`) and the
**chat bot** (`factory-telegram-chat-bot-token`, this feature, on `/telegram-chat-webhook`). A
Telegram bot can register only one webhook, hence the split.

## Files

| File | Role |
|---|---|
| `services/mcp-server/src/telegram-chat-guards.ts` | Pure, side-effect-free guards + parsers (allowlist, freshness, message/callback parsing). No heavy imports → unit-tested hermetically. |
| `services/mcp-server/src/telegram-chat.ts` | The handler: inbound message → LLM tool-calling loop → Hebrew reply; HITL approval send + callback dispatch. |
| `services/mcp-server/src/index.ts` | Registers `POST /telegram-chat-webhook` (503 dormant, constant-time secret-token check, always 200). |
| `services/mcp-server/test/telegram-chat-guards.test.mjs` | Unit tests for the pure guards (run by `node --test`, the repo convention). |
| `.github/workflows/deploy-mcp-server.yml` | Mints + mounts the 4 chat secrets; registers the chat bot's `setWebhook`. |
| `.github/workflows/playground-tests.yml` | "MCP server build + unit tests" step (`tsc` + `node --test`) — the first PR-time gate over the mcp-server TS. |

## Secrets (GCP Secret Manager, `or-factory-master-control`)

| Secret | Env var | Purpose |
|---|---|---|
| `factory-telegram-chat-bot-token` | `FACTORY_TG_CHAT_BOT_TOKEN` | @BotFather token of the chat bot. Operator-supplied; placeholder until set → bot dormant. |
| `factory-telegram-chat-webhook-secret` | `FACTORY_TG_CHAT_WEBHOOK_SECRET` | `setWebhook` secret_token (layer 1). Minted random. |
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

The allowlist is a small, fixed set of **safe, parameterless, idempotent** workflows
(`meta-monitoring-watchdog.yml`, `deploy-mcp-server.yml`). Destructive workflows
(`decommission*`, `provision*`) are deliberately **not** reachable by the bot.

## Operational notes

- **Synchronous processing.** Cloud Run only guarantees CPU during a request, so the handler
  processes the LLM loop synchronously (bounded: ≤4 tool rounds, 45s/call) and then `sendMessage`s
  the reply, rather than fire-and-forget. This mirrors the OIL approval webhook.
- **Dormant by default.** Until the real bot token + an OpenRouter key are set, the bot stays off
  (the deploy creates placeholders; `setWebhook` skips a placeholder token). The OpenRouter LLM key
  is minted automatically from `openrouter-management-key` at deploy.

### Activating the bot (one-time)

Two operator-supplied values are needed; `deploy-mcp-server.yml` seeds both into Secret Manager
and then `setWebhook` activates the bot — no terminal, no printed secrets:

1. **Create the bot** — in Telegram, message **@BotFather** → `/newbot`, follow the prompts, copy
   the bot token it gives you.
2. **Store the token** — add it as a GitHub Actions **secret** named `FACTORY_TG_CHAT_BOT_TOKEN`
   on `edri2or/or-factory-master` (Settings → Secrets and variables → Actions → New secret). It's
   masked and never logged; the deploy's seed step writes it to `factory-telegram-chat-bot-token`.
3. **Allow your account** — re-run `deploy-mcp-server.yml` with the `chat_allowlist` input set to
   your numeric Telegram user id (from @userinfobot). The seed step validates it (numeric CSV) and
   writes `factory-telegram-chat-allowlist`. (Mirrors `set-oil-allowlist.yml`; the id is non-secret.)

The same deploy run mounts the new `:latest` versions and registers the chat bot's `setWebhook`.
Re-running with both blank is a safe no-op (never overwrites a real value with empty).

## Not in scope here

Self-healing for **automation/workflow** failures (extending OIL beyond `scripts/*.sh`) is a
separate follow-up development (roadmap Phase G, Stage 7), not part of this bot.
