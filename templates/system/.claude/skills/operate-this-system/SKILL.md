---
name: operate-this-system
description: >-
  Recognise and operate THIS repository as a system built by or-factory-master — an autonomous
  n8n (2.x) + Postgres + Caddy stack on Railway, fronted by a Telegram chat bot and an Agent
  Router, with its own GitHub App and GCP Secret Manager. Load this whenever you are working
  inside such a system's repo and need to understand what the system is or operate any part of
  it: its live n8n workflows, the Telegram bot, the Postgres tables, the per-system secrets, the
  GitHub App identity, or the built-in MCP connections. It does not duplicate facts — it routes
  you to AGENTS.md (the system's own live orientation doc) and to the right read-only tools and
  guardrails. Triggers on n8n, Railway, Caddy, Telegram bot, Agent Router, Postgres, system
  secrets, GitHub App, .mcp.json, or /mcp/system-tools in this repo.
---

# Operate this system

This repository is a **live system built by `or-factory-master`** — not a generic app. It is an
autonomous **n8n (2.x) + Postgres + Caddy** stack on **Railway**, with **Cloudflare** DNS, a
**Telegram** chat bot routed by an **Agent Router**, its own **GitHub App**, and its own **GCP
Secret Manager**. This skill is a **map, not a manual**: the living, per-system values are in
**`AGENTS.md`** at the repo root. Read it first, then act through the guardrails below.

## First move — read `AGENTS.md`

`AGENTS.md` (repo root) is this system's authoritative, provision-time orientation doc. Don't
guess values — go read the section you need:

- **`## Identity`** — the system name, its GCP project, the public URL, the health check, and the
  provision mode. Start here to learn *which* system you're in.
- **`## Telegram Chat Bot`** → **`### System-aware tools (read-only)`** — how the bot works and the
  read-only toolset it (and a Claude session) can use: `postgres_named_query` (a fixed whitelist of
  read-only SELECTs, incl. `conversation_transcript`, `tool_trace_recent`, `claim_actual_mismatch`
  — the bot's own history and "black box"), `github_readonly`, `railway_readonly`, `google_workspace`.
- **`### Postgres tables (created by db-setup)`** — the tables the bot and automations use
  (`audit_log`, `pending_actions`, `agent_trace_events`, `file_catalog`, …).
- **`## Secrets in GCP Secret Manager`** — the secret **names** (values are never echoed/printed).
- **`## GitHub App (this system's GitHub identity)`** — the per-system App, its scopes, and how to
  mint a token.
- **`## Built-in MCP connections`** — the committed `.mcp.json` servers and the system's own
  `/mcp/system-tools` endpoint.
- **`## Forbidden Actions`** — the hard "don't" list. Read it before any change.

## Reading the system's live state (read-only first)

Always understand the running system before touching it. Three read paths are already wired:

- **`.mcp.json`** (repo root, committed, zero secrets — auth is the central gateway's own browser
  login) gives every Claude session two MCP servers:
  - **`factory`** → read-only verify/inspect over this system's GCP, Railway, Cloudflare, n8n and
    CI (plus the allowlisted `dispatch_workflow`).
  - **`n8n-live`** → develop workflows against the system's **own live n8n**; live writes are
    scratch-only (`dev-*` names — git stays the source of truth).
- **`/mcp/system-tools`** — this system's own outward read-only MCP endpoint
  (`https://n8n-<system>.or-infra.com/mcp/system-tools`, Bearer `n8n-mcp-server-token` from its
  Secret Manager): `postgres_named_query`, `github_readonly`, `railway_readonly`. Use it to read
  the bot's transcript/trace without "discovering" anything — it's one named query.

Prefer these read tools to form a picture before proposing any change.

## The invariants — never break these

- **Writes are human-gated (HITL).** The bot *proposes*; a human ✅ approves via
  `request_write_action` / `pending-actions-executor` (Telegram card). Mirror that — never
  self-approve a state change, and never give the bot free-SQL or write tools.
- **Secrets are names only.** Never echo, print, log, or write to disk any Secret Manager value,
  the `github-app-private-key`, or any minted token.
- **GitHub work goes through the App.** Act as this system's GitHub App with least privilege — use
  the **`github-app-operations`** skill (already in this repo). Never fetch the private key outside
  a workflow.
- **GCP work goes through the broker.** Never run `gcloud` locally — use the **`gcp-hands-client`**
  skill (already in this repo) to dispatch any GCP operation.
- **`main` is protected** (the `protect-main` ruleset): PR-only, CI must pass. Never push to `main`
  directly and never disable branch protection.
- **Infra is deploy-workflow-owned.** Never hand-edit the Railway project or Cloudflare DNS — change
  them only by dispatching the system's `deploy-railway-cloudflare.yml`.

## Companion skills already in this repo

- **`github-app-operations`** — mint this system's GitHub App installation token for pushes, PRs,
  workflow runs, or secret operations.
- **`gcp-hands-client`** — dispatch any Google Cloud / `gcloud` operation to the broker instead of
  running it locally.

## When in doubt

`AGENTS.md` is the source of truth for this system's live values; this skill only tells you **where
to look** and **which guardrails are non-negotiable**. Read first, route to the right tool, keep
writes human-gated.
