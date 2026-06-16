---
audience: shared
description: >-
  The single source of truth for the unified Google Workspace tools — all 12 groups (Gmail,
  Calendar, Drive, Docs, Sheets, Slides, Forms, Tasks, Contacts, Chat, Search, Apps Script) over
  Or's personal edri2or@gmail.com. A map, not a manual: it says what exists, the identity, how each
  context reaches the tools, the safety rules, and what is NOT feasible — and routes you to the live
  tools/list, never to a hard-coded tool list. Load this when sending mail, reading/editing
  Calendar/Drive/Docs/Sheets/Tasks, wiring or reasoning about Google access, or asking "what Google
  tools do I have / can it do X?". Triggers on Google, Gmail, Calendar, Drive, Docs, Sheets, Tasks,
  Workspace, google_workspace, "send email".
---

# Google Workspace tools — the unified guide

All Google access in this ecosystem is **one unified Workspace MCP** (the `workspace-mcp` sidecar on
the central gateway) over **Or's personal `edri2or@gmail.com`** — the real data account the tools
read and write. This skill is a **map, not a manual**: the authoritative *inventory* is the live
`tools/list`, and the per-context *wiring* is in the live config below. Don't hard-code tool names —
they evolve with the package.

## Identity — two names, don't mix them up

The **data** is Or's personal **`edri2or@gmail.com`** — what the token authenticates as, and where
the mail / files / calendar actually live (proven live). **But** when a tool asks for a
**`user_google_email`** argument, you pass the credential storage-key label
**`edriorp38@or-infra.com`** — *not* `edri2or` (which fails: no credential is filed under that
name). The label is a filename, not the account — see `docs/google-identities.md` (factory repo).
*(In a provisioned system this is set inside the `google_workspace` n8n tool's config, so you don't
type it.)*

## The 12 tool groups (what exists)

Read + write across: **gmail**, **calendar**, **drive**, **docs**, **sheets**, **slides**, **forms**,
**tasks**, **contacts**, **chat**, **search** (Custom Search), **appscript** (Apps Script). Two limits
worth knowing up front:

- **Gmail is trash-only** — delete = move to trash (reversible). There is **no permanent delete**.
- **Drive content edit:** `update_drive_file` edits the content of **Google-native** files only
  (Docs / Sheets / Slides). For **non-native** files (`.md` / `.txt` / binary) use the gateway-owned
  **`edit_drive_file_content`** (`file_id` + one of `content` / `content_base64`) — it rewrites the
  content via the Drive `files.update` media path and refuses native files. Trash, move, and rename
  (`update_drive_file`) work on **any** file.

The **exact, current tool names** are whatever the live `tools/list` returns (~120 tools) — read it;
never trust a hard-coded list here.

## How you reach the tools (route to live — don't guess)

- **In the factory repo / Or's claude.ai** — the Workspace MCP route (`/workspace/<system>/mcp`,
  operator Google-login). The live `tools/list` over that route is the real inventory.
- **In a provisioned system** — the **`google_workspace`** tool inside the system's n8n (the
  bot/agents call it to send mail / manage Calendar / Drive). See this system's **`AGENTS.md`** for
  the live detail: it is authed by the `workspace-mcp-bearer` secret and is **HITL-gated** (a write
  becomes a Telegram ✅ card via `request_write_action`). If that bearer is empty, the tool is
  stripped — `AGENTS.md` says so.

## Safety — this is Or's PERSONAL account

- **Turn write tools OFF in claude.ai _Research_ mode.** Research auto-calls tools without
  confirmation; a prompt-injection on the personal account could trash / rename / move / edit. Reduce
  the dangerous tools in the claude.ai connector UI and keep writes off for Research tasks.
- **The operator gate is `OAUTH_ALLOWED_EMAILS`** (= Or only; fail-closed when empty).
- **In a system, every write is HITL-gated** — the bot proposes, a human ✅ approves. Mirror that;
  never self-approve a Google write.
- **Never narrow scopes to restrict tools.** The scope set is a **byte-equal contract across four
  sites**; editing it breaks the token refresh ("Scope has changed"). Reduce tools in the client UI
  instead.

## What is NOT feasible (don't chase these as a permission bug)

- **Not possible on a personal account:** **Keep** (enterprise-only API), **NotebookLM** (no consumer
  API), **Photos** "all your photos" (broad scopes removed 2025-03-31).
- **Separate API-key track, not built here:** **Maps**, **YouTube**, **Translate** (billed API keys,
  not user OAuth).

## Where the authoritative detail lives

- The **live `tools/list`** — the real, current inventory.
- **In the factory repo only:** `docs/google-tools-feasibility.md` (full feasibility + the four-site
  scope contract + the API-enablement note) and `docs/google-identities.md` (the identity truth). A
  provisioned system does not ship these — use its own **`AGENTS.md`** instead.

## When in doubt

Read the live `tools/list` (or `AGENTS.md` in a system) before acting; keep writes human-gated; never
hard-code tool ids or scopes here.
