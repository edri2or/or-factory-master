---
audience: factory-only
description: Prove a claude.ai-facing MCP connector is actually usable end-to-end — reads the live issuer URL the operator must paste, proves the server side headlessly via the existing smoke path, then records Or's "added it in claude.ai, tool X ran ✅" before declaring a connector-touching change "done". Use after any change to a connector route, OAuth surface, or tool exposed to claude.ai ("הוכח מחבר", "prove connector", "wire claude.ai connector").
---

# Prove Connector — the gate before declaring a claude.ai-facing connector "done"

## Role
You prove a claude.ai MCP connector is actually usable end-to-end, BEFORE a connector-touching
change is declared done. Given a connector (its route + a tool it exposes), you (1) read the
**live `issuer` URL** from the gateway — the URL the operator must paste into claude.ai;
(2) prove the **server side** works headlessly by reusing the existing smoke path; (3) surface
that exact URL to Or; (4) record his confirmation that the connector rendered the tools and
one ran; (5) fill a **Connector Card** with a **go/no-go** verdict. You talk to Or in plain
Hebrew and stop for his decision.

> This skill is the connector twin of `/prove-capability`: same prove-the-load-bearing-brick
> discipline (`docs/capability-first.md`), aimed at the one brick CI cannot prove for itself
> — that the connector renders and runs *inside* claude.ai. `probe_endpoint` allowlists only
> `.or-infra.com`/`.up.railway.app`/`.run.app` (`services/mcp-server/src/probe.ts:12`), so the
> claude.ai UI is the human-in-the-loop ceiling. This skill makes that one manual step a
> scripted paste-and-confirm — not a search-and-rescue.

## Context — Read First
1. `docs/mcp-connector-setup.md` — the canonical doc: which URL goes where, why, the failure mode.
2. `services/mcp-server/src/index.ts:461-499` — the `.well-known` handlers that advertise the
   `issuer` claude.ai locks onto.
3. `scripts/google-mcp-smoke.py` (for `/workspace/<sys>/mcp`) / `scripts/factory-mcp-smoke.py`
   (for `/factory/<sys>/mcp`) — the existing headless smoke scripts you reuse for step 2; the
   server-side proof is *already automated*.
4. `docs/google-identities.md` § "Drive write tools exposed to claude.ai" — `OAUTH_ALLOWED_EMAILS`,
   Research-mode safety. The auth gate Or will sign in through.

## Connector Card (fill it; this is the artifact)

| field | meaning |
|---|---|
| `connector name` | short label (e.g. `factory-workspace`) |
| `route` | `/mcp` \| `/workspace/<sys>/mcp` \| `/factory/<sys>/mcp` |
| `issuer URL` | the live `issuer` value (read in Step 1) — the exact URL Or pastes |
| `auth` | "Login with Google · `OAUTH_ALLOWED_EMAILS` = …" |
| `tool exercised` | one real tool called end-to-end (e.g. `search_drive_files`) |
| `server-side proof` | smoke script + last-run link / pasted output excerpt |
| `operator confirmation` | "Or added the connector in claude.ai and `<tool>` ran ✅ · YYYY-MM-DD" |
| `verdict` | `go` \| `no-go` (+ why) |

## Instructions

### Step 1 — Read the live `issuer` (no guessing)
Pick whichever is at hand; all read the live server, not docs:
- **Latest `deploy-mcp-server.yml` Summary** — the row labelled **"claude.ai connector URL (issuer)"**.
- **`verify_mcp_server` on any system** — the `mcp-oauth-issuer` check's `evidence` field.
- **`probe_endpoint`** on
  `https://factory-master-actions-mcp-<GCP_PROJECT_NUMBER>.<GCP_REGION>.run.app/.well-known/oauth-authorization-server`
  → parse `issuer` from the JSON body.

Cross-check against the `EXPECTED_CONNECTOR_ISSUER=` line in `docs/mcp-connector-setup.md`. If
they disagree, update the doc in the same PR — `deploy-mcp-server.yml` only emits a `::warning::`
on drift (deliberately not a hard fail), so silent drift is possible.

### Step 2 — Prove the server side headlessly (reuse the smoke path)
For `/workspace/<sys>/mcp` → run `python3 scripts/google-mcp-smoke.py` (mints bearer →
`tools/list` → real tool call). For `/factory/<sys>/mcp` → `python3 scripts/factory-mcp-smoke.py`.
For `/mcp` (factory toolbox surface) → assert with `verify_mcp_server` (health 200, oauth
metadata 200, issuer field present). Capture the smoke output or workflow-run link in the
"server-side proof" field of the Card. **Never** paste an admin secret into a session — the
smoke scripts read it server-side via WIF inside CI (`gcloud secrets versions access`).

### Step 3 — Surface the issuer URL to Or, plainly
Give Or **one** line, in Hebrew, with **only** the issuer URL to paste — not the region URL,
not both. Reference `docs/mcp-connector-setup.md` § "Operator checklist" for the 5-step UI flow.

### Step 4 — Record Or's confirmation (the only manual link)
Or pastes the URL, signs in with Google (`edri2or@gmail.com`), confirms the tools render in
claude.ai, runs ONE real tool, and tells you "ran ✅". Record verbatim into the Card's
`operator confirmation` field with the date. If Or sees nothing render or auth fails, verdict
is **no-go** and you diagnose (most likely cause: doc drift — the issuer changed and `Step 1`
caught a different value than the Card holds).

### Step 5 — Fill the Connector Card + verdict
- **Go** — Steps 1-4 all green → record the Card, hand off to the calling development (which
  can now declare the connector-touching change "done").
- **No-go** — record the failing step + why; do **not** declare done. Common fail modes:
  doc drift (Step 1 ≠ `EXPECTED_CONNECTOR_ISSUER`), smoke failure (Step 2), Or sees tools but
  one doesn't run (gate at `OAUTH_ALLOWED_EMAILS`, or the tool's actual API permission).

### Step 6 — Report + stop
Plain Hebrew to Or: the connector name, the URL he pasted, the tool he ran, the verdict,
and the next decision (close the development, or fix the issuer/doc and retry).

## Safety Rules
1. **Never machine-claim the manual link.** Steps 1-2 are fully automated; Step 4 is operator-
   confirmed because `probe.ts:12` refuses `claude.ai` and `accounts.google.com`. Don't write
   "tools render in claude.ai" without Or's verbatim confirmation — and don't invent an
   "Allow button" (per `CLAUDE.md` § Web-session connector gate).
2. **Never paste a bearer or admin secret into a session.** Smokes read them server-side via WIF.
3. **No new capability is built here.** This is a proof skill; building/changing the connector
   itself is the calling development.
4. **Doc-drift is a no-go, not a warning.** If Step 1's live `issuer` differs from
   `EXPECTED_CONNECTOR_ISSUER` in `docs/mcp-connector-setup.md`, update the doc in the same PR
   as the calling development — *don't* paper over it.
5. **Plain Hebrew to Or; stop for his decision.** Especially at Step 3 (give him the URL) and
   Step 6 (verdict).

## Examples

**User:** "תוכיח שהמחבר של ה-Workspace ב-claude.ai עובד עם הכלי החדש לעריכת קבצי Drive"

**Agent behaviour:**
Names connector (`factory-workspace`, route `/workspace/or-edri-4/mcp`). Reads live issuer via
`verify_mcp_server` → `mcp-oauth-issuer` evidence. Cross-checks against
`EXPECTED_CONNECTOR_ISSUER` (matches). Runs `scripts/google-mcp-smoke.py` against the live
gateway → all 6 steps pass (incl. `update_drive_file` presence assertion). Surfaces the issuer
URL to Or in one Hebrew line. Or adds the connector in claude.ai, runs `edit_drive_file_content`
on a real `.md` in his Drive, replies "עבד ✅". Records the Connector Card with verdict
`go`; the calling development's stage can close.

**User:** "תוסיף `unread_count` ל-Gmail tool ותוודא שהוא מופיע ב-claude.ai"

**Agent behaviour:**
After the change ships and a redeploy completes, this skill reads the live issuer (Step 1),
runs `google-mcp-smoke` extended with the new tool's presence (Step 2 — server side green),
gives Or the URL (Step 3), Or pastes + runs the new tool in claude.ai and confirms (Step 4),
records the Card with `verdict: go` (Step 5), reports in Hebrew (Step 6).
