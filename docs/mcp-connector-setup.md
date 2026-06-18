# MCP Connector Setup — the one URL to paste into claude.ai

## The one fact, in one line

The exact URL to paste into a claude.ai **custom connector** is the gateway's advertised
**OAuth issuer**. It is currently:

`EXPECTED_CONNECTOR_ISSUER=https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app`

That is **not** the same URL as the Claude Code toolbox `mcp_url`. The deploy workflow prints
both values in its job Summary — the connector URL is the one labelled **"claude.ai connector
URL (issuer)"**. Read that line. Paste *it*, nothing else.

> The literal value above is the *expected* issuer. The deploy workflow reads the live issuer
> from the server and warns (loudly) if they ever disagree — that's how this doc stays honest
> without manual sync. The grep-able `EXPECTED_CONNECTOR_ISSUER=` line is what the warning
> checks against.

> Forward note (Stage 2 of `connector-url-clear`): the next planned change pins the issuer to
> the Region URL so the two consumers collapse into one URL. When that ships, this line and the
> deploy assertion flip in lockstep — and Or re-adds the connector in claude.ai once.

## Why two URLs

The Cloud Run gateway has two stable hostnames pointing at the same service:

- **Region URL** — `https://factory-master-actions-mcp-140345952904.me-west1.run.app`
  (deterministic: `${SERVICE}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app`).
- **Legacy hash URL** — `https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app`
  (Cloud Run's per-service `status.url`).

Both serve. They differ for one consumer only — OAuth discovery.

| Consumer | URL to use | Why |
|---|---|---|
| Claude Code **toolbox** (the `5b6e937f-…` read/inspect server's `mcp_url`) | **Region URL** | Direct MCP client, no OAuth discovery, deterministic region URL is preferred. |
| **claude.ai custom connector** (OAuth path) | **Issuer URL** (currently the hash URL) | claude.ai does OAuth discovery on the URL you give it; the server advertises `issuer = $PUBLIC_BASE_URL`, and `deploy-mcp-server.yml` sets `PUBLIC_BASE_URL = $(gcloud run services describe ... status.url)` = the hash URL. claude.ai then **locks onto that exact host** for every later token request. Mismatch → connector never completes auth. |

The mismatch is invisible: the region URL serves a 200 on `/.well-known/oauth-authorization-server`,
but its `issuer` field is the hash URL. claude.ai treats that as authoritative.

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
2. מדביק את הכתובת מ-"How to get / verify" למעלה (השורה של ה-`issuer`, לא Region URL).
3. **Login with Google** עם `edri2or@gmail.com` (זה החשבון היחיד ב-`OAUTH_ALLOWED_EMAILS`;
   כל חשבון אחר נחסם).
4. רואה את הכלים נטענים ברשימה. מריץ כלי אמיתי אחד (למשל `search_drive_files` או
   `update_drive_file`) — אם חזרה תוצאה חיה, סיימת.
5. **חשוב:** ב-claude.ai _Research mode_ — כבה כלי-כתיבה ידנית (Research מריץ כלים בלי
   אישור פר-קריאה). פירוט: `docs/google-identities.md` › "Drive write tools exposed to claude.ai".

אם משהו לא עובד — סביר להניח שהכתובת לא תואמת ל-`issuer` החי. תריץ `/prove-connector` —
הסקיל מוודא את הכתובת ומאמת בקריאת-כלי אמיתית את הצד-שרת לפני שמדביקים מחדש.

## Failure mode (why this doc exists)

`drive-content-edit` (merged 2026-06-16) הוכיח את כלי ה-Drive על הצד-שרת — ההגדרה ב-claude.ai
הצריכה ריצות מיותרות כי ה-Region URL הומלץ ב-deploy summary, אבל ה-`issuer` החי שונה. הוכחה
חיה: `probe_endpoint` על Region URL מחזיר 200 וגוף עם `"issuer":"…risl6twm4a-zf…"`. הקובץ
הזה + שלב ה-"Read + assert the live connector issuer" ב-`deploy-mcp-server.yml` סוגרים את
הפער: ה-deploy עצמו מספר לך מה הכתובת המדויקת, והמסמך פה נשאר נכון כי שורת
`EXPECTED_CONNECTOR_ISSUER` נבדקת מול הערך החי בכל ריצה.

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
> **connector**, exactly as below for Nuriel.

## Coordinator connector — Nuriel's door (proven 2026-06-18)

The coordinator agent-repo **Nuriel** is reached the SAME way: a claude.ai **custom connector** at
the coordinator route — `https://<issuer-host>/coordinator/nuriel/mcp` (issuer host as above + the
`/coordinator/nuriel/mcp` path). This is **the door** Or uses to talk to Nuriel from Claude Code on
the web. **Why a connector, not the repo's `.mcp.json` direct URL:** a Claude Code **web** session's
sandbox blocks outbound egress to the gateway host (network policy), so the direct `.mcp.json` HTTP
server is unreachable — but **connector traffic routes through Anthropic's servers, bypassing the
egress allowlist** (per the Claude Code web docs, §Network access). Added once + Google login, reused
across all nuriel sessions; no per-environment network setting. Proven live: Nuriel's session called
`route_to_agent` (the narrow coordinator write tool) through the connector and it was **NOT** blocked
by the platform connector-gate — the broker dispatched to `natan-research` (run `27788706190`,
`triggering_actor=factory-master-broker[bot]`) and the result landed in `edri2or/nuriel`. Full record:
`devplans/nuriel-coordinator.md` (שלב 5) + `docs/capability-cards/nuriel-orchestration.md` (`verdict: go`).

## Cross-links

- `CLAUDE.md` § "Web-session connector gate — never tell Or to 'click Allow' (there is no button)" — קשור אבל שונה: הוא על gating server-side של *כלים* במחבר; הקובץ הזה על הכתובת *של המחבר עצמו*.
- `docs/google-identities.md` § "Drive write tools exposed to claude.ai" — מי מורשה ל-`OAUTH_ALLOWED_EMAILS` ומה הסיכון בכלי כתיבה.
- `docs/e2e-enforcement-standard.md` — מודל "shared-service gate:deploy" שאליו שלב B1 משתייך (smoke בזמן deploy, לא merge-gate).
- `.claude/commands/prove-connector.md` — הסקיל הקבוע להוכחת מחבר חדש לפני שמכריזים "גמור".
