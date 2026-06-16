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

## The 12 tool groups (what exists)

Read + write across: **gmail**, **calendar**, **drive**, **docs**, **sheets**, **slides**, **forms**,
**tasks**, **contacts**, **chat**, **search** (Custom Search), **appscript** (Apps Script). Two limits
worth knowing up front:

- **Gmail is trash-only** — delete = move to trash (reversible). There is **no permanent delete**.
- **Drive in-place content edit works only on Google-native files** (Docs / Sheets / Slides), not
  `.md` / `.txt` / binary. Trash, move, and rename work on **any** file.

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
