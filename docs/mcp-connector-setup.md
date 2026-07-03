# MCP Connector Setup — the one URL to paste into claude.ai

## The one fact, in one line

The exact URL to paste into a claude.ai **custom connector** is the gateway's advertised
**OAuth issuer**, which since `connector-url-clear` Stage 2 is the deterministic **Region URL**:

`EXPECTED_CONNECTOR_ISSUER=https://factory-master-actions-mcp-140345952904.me-west1.run.app`

This is now the **same** URL as the Claude Code toolbox `mcp_url` — **one address for both
consumers.** The deploy workflow prints it in its job Summary, on the row labelled **"claude.ai
connector URL (issuer)"**. Read that line. Paste *it*.

> The literal value above is the *expected* issuer. The deploy workflow reads the live issuer
> from the server and warns (loudly) if they ever disagree — that's how this doc stays honest
> without manual sync. The grep-able `EXPECTED_CONNECTOR_ISSUER=` line is what the warning
> checks against; since Stage 2 the live issuer **is** this Region URL, so the check passes clean.

## One URL (previously two)

The Cloud Run gateway has two stable hostnames pointing at the same service — the deterministic
**Region URL** (`https://factory-master-actions-mcp-140345952904.me-west1.run.app`,
`${SERVICE}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app`) and a legacy hash URL
(`…-risl6twm4a-zf.a.run.app`, Cloud Run's per-service `status.url`). Both serve the same service.

Since `connector-url-clear` Stage 2, **both consumers use the Region URL** — `deploy-mcp-server.yml`
pins `PUBLIC_BASE_URL` to the Region URL, so the advertised `issuer` (what claude.ai locks onto
during OAuth discovery) is the Region URL too:

| Consumer | URL to use |
|---|---|
| Claude Code **toolbox** (the `5b6e937f-…` read/inspect server's `mcp_url`) | **Region URL** |
| **claude.ai custom connector** (OAuth path) | **Region URL** (= the advertised `issuer`) |

Before Stage 2 the connector needed the legacy hash URL — the server advertised *it* as `issuer`
(`PUBLIC_BASE_URL` came from `gcloud run … status.url`), which silently split the two consumers:
the Region URL served a `200` on `/.well-known/oauth-authorization-server` whose `issuer` field
was the *other* host, and claude.ai treated that as authoritative. That split is gone.

## How to get / verify the URL right now

Three paths, pick whichever is at hand. All read from the live server, not from documentation.

1. **From the latest `deploy-mcp-server.yml` run.** Open the run's job Summary; the row
   labelled **"claude.ai connector URL (issuer)"** is the URL to paste.
2. **From an agent session, on demand.** Call `verify_mcp_server` on any system (factory MCP);
   the `mcp-oauth-issuer` check returns the live issuer in its `evidence` field.
3. **By probe.** Call `probe_endpoint` on
   `https://factory-master-actions-mcp-140345952904.me-west1.run.app/.well-known/oauth-authorization-server`
   and read the `issuer` field of the JSON body (`probe_endpoint` allows `.run.app`).

You cannot probe `claude.ai` from any factory tool — `probe.ts:12` allowlists only
`.or-infra.com` / `.up.railway.app` / `.run.app` (intentional SSRF defense). The "paste +
confirm" step inside claude.ai is therefore the only manual link in the chain. The
`/prove-connector` skill makes that single manual step scripted.

## Operator checklist (Or-facing)

1. פותח את claude.ai → **Settings** → **Connectors** → **Add custom connector**.
2. מדביק את הכתובת מ-"How to get / verify" למעלה — היום זו כתובת אחת (Region URL = ה-`issuer`).
3. **Login with Google** עם `edri2or@gmail.com` (זה החשבון היחיד ב-`OAUTH_ALLOWED_EMAILS`;
   כל חשבון אחר נחסם).
4. רואה את הכלים נטענים ברשימה. מריץ כלי אמיתי אחד (למשל `search_drive_files` או
   `update_drive_file`) — אם חזרה תוצאה חיה, סיימת.
5. **חשוב:** ב-claude.ai _Research mode_ — כבה כלי-כתיבה ידנית (Research מריץ כלים בלי
   אישור פר-קריאה). פירוט: `docs/google-identities.md` › "Drive write tools exposed to claude.ai".

### מחבר קיים שעדיין תחת הכתובת הישנה (חד-פעמי, בעקבות Stage 2)

מחבר שהוספת **לפני** Stage 2 נעול על הכתובת הישנה (ה-hash, `…-risl6twm4a-zf…`), והשרת כבר
מכריז על ה-Region URL — אז אימות ה-OAuth שלו יפסיק להתאים. התיקון חד-פעמי: ב-claude.ai →
**Settings → Connectors** — למחוק את המחבר הישן ולהוסיף אותו מחדש עם ה-Region URL (השלבים 1–5
למעלה), **פעם אחת לכל מחבר** (למשל ה-Workspace, ואם קיים גם ה-n8n). שום נתון לא נמחק — רק
ההתחברות מתרעננת. אם claude.ai אומר *"A server with this URL already exists"* — הוא כבר שם.

אם משהו לא עובד — סביר להניח שהכתובת לא תואמת ל-`issuer` החי. תריץ `/prove-connector` —
הסקיל מוודא את הכתובת ומאמת בקריאת-כלי אמיתית את הצד-שרת לפני שמדביקים מחדש.

## Failure mode (why this doc exists) — resolved by Stage 2

`drive-content-edit` (merged 2026-06-16) הוכיח את כלי ה-Drive על הצד-שרת — ההגדרה ב-claude.ai
הצריכה אז ריצות מיותרות כי ה-Region URL הומלץ ב-deploy summary אבל ה-`issuer` החי היה שונה
(ה-hash URL). Stage 1 סגר את הפער בכך שה-deploy עצמו מדפיס את הכתובת המדויקת ומאמת אותה מול
`EXPECTED_CONNECTOR_ISSUER` בכל ריצה. **Stage 2 (זה) חיסל את הפער מהשורש:** `PUBLIC_BASE_URL`
נעוץ ל-Region URL, אז ה-`issuer` החי == ה-Region URL == השורה במסמך — כתובת אחת לשני הצרכנים,
בלי שתי כתובות שאפשר להתבלבל ביניהן.

## Claude Code on the web — the Google tools work too

The same gateway connector also serves Claude Code **on the web**: the Workspace tools
(`/workspace/<system>/mcp`) surface automatically in a Code web session, just like in claude.ai
(connectors added at the claude.ai account level surface in Code web — proven live: both the factory
`/mcp` connector and the Workspace connector appear in-session). A new Code web session may be needed
to pick up a freshly-added connector. **You generally do not add a second connector** — if claude.ai
says *"A server with this URL already exists"*, the connector is already there; just use it.

⚠️ **The `localhost:3002` trap is NOT a connector problem — it is a wrong `user_google_email`.**
A tool call that errors with an OAuth prompt to `http://localhost:3002/oauth2callback` means the
caller passed the wrong `user_google_email`. The `workspace-mcp` sidecar is single-user with the
shared token filed under the label **`edriorp38@or-infra.com`**; any other value (e.g. the
natural-but-wrong `edri2or@gmail.com`) finds no credential and falls back to the sidecar's internal
localhost OAuth. **Fix: pass `user_google_email="edriorp38@or-infra.com"`** (the data is still Or's
`edri2or@gmail.com` — the label is only a storage key). Proven live from a Code web session
2026-06-17 (`search_drive_files` returned real Drive files, no localhost). Full detail:
`.claude/commands/google-workspace-guide.md` › "Known failure".

> **Why a connector and not the repo's `.mcp.json` direct URL:** a Claude Code **web** session's
> sandbox blocks outbound egress to the gateway host (network policy), so a direct `.mcp.json` HTTP
> server is unreachable — but connector traffic routes through Anthropic's servers, bypassing the
> egress allowlist (per the Claude Code web docs, §Network access). So the Workspace tools must be a
> **connector**, exactly as the coordinator connector below.

## Coordinator connector — reaching a coordinator agent-repo (mechanism)

A coordinator agent-repo is reached the SAME way: a claude.ai **custom connector** at the
coordinator route — `https://<issuer-host>/coordinator/<repo>/mcp` (issuer host as above + the
`/coordinator/<repo>/mcp` path). This is **the door** Or uses to talk to a coordinator from Claude
Code on the web. **Why a connector, not the repo's `.mcp.json` direct URL:** a Claude Code **web**
session's sandbox blocks outbound egress to the gateway host (network policy), so the direct
`.mcp.json` HTTP server is unreachable — but **connector traffic routes through Anthropic's servers,
bypassing the egress allowlist** (per the Claude Code web docs, §Network access). Added once + Google
login, reused across sessions; no per-environment network setting.

Proven live once (2026-06-18, historical — the agents involved have since been deleted): a coordinator
session called `route_to_agent` (the narrow coordinator write tool) through the connector and it was
**NOT** blocked by the platform connector-gate — the broker dispatched to a worker (run `27788706190`,
`triggering_actor=factory-master-broker[bot]`) and the result landed in the requester agent-repo.
Historical record: `devplans/nuriel-coordinator.md`. **Current state: there are no live agent-repos**
(see `CLAUDE.md` › "Agent-repos (the agent-repo product)").

## Cross-links

- `CLAUDE.md` § "Web-session connector gate — never tell Or to 'click Allow' (there is no button)" — קשור אבל שונה: הוא על gating server-side של *כלים* במחבר; הקובץ הזה על הכתובת *של המחבר עצמו*.
- `docs/google-identities.md` § "Drive write tools exposed to claude.ai" — מי מורשה ל-`OAUTH_ALLOWED_EMAILS` ומה הסיכון בכלי כתיבה.
- `docs/e2e-enforcement-standard.md` — מודל "shared-service gate:deploy" שאליו שלב B1 משתייך (smoke בזמן deploy, לא merge-gate).
- `.claude/commands/prove-connector.md` — הסקיל הקבוע להוכחת מחבר חדש לפני שמכריזים "גמור".
