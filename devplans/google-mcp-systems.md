<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא המצפן של הסוכן, לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית.
-->
---
dev_name: Google MCP מובנה לכל מערכת
slug: google-mcp-systems
opened: 2026-06-09
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — Google MCP מובנה לכל מערכת

## מטרה

כל מערכת חדשה שהפקטורי בונה תיוולד עם סוכן n8n שיודע להשתמש בכלי Google (Gmail + Calendar)
דרך MCP — בלי הגדרה ידנית. בונים את זה כ**תשתית רב-כלית לשימוש חוזר**: אחרי שגוגל עובד,
הוספת Slack/Notion/וכו' לכל המערכות = עוד sidecar אחד, בלי בנייה מחדש. הטוקן של גוגל נשאר
מרכזי (ב-control) ולא מועתק לתוך כל n8n — רווח אבטחה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0a | ספייק de-risk: הוכחת מנגנון headless mode-C | completed | (ספייק מבודד ב-/tmp, ללא קוד מאגר) |
| 0b | אירוח Google Workspace MCP כ-sidecar מרכזי ב-gateway | pending | `scripts/render-mcp-service-yaml.sh`, `.github/workflows/deploy-mcp-server.yml`, `services/mcp-server/src/workspace-mcp-proxy.ts`, `services/mcp-server/src/index.ts`, `.github/workflows/google-mcp-smoke.yml`, `scripts/google-mcp-smoke.py` |
| 1 | תבנית מערכת: bootstrap-google-mcp + חיווט הסוכן | pending | `templates/system/.github/workflows/bootstrap-google-mcp.yml`, `templates/system/workflows/n8n/ops-agent.json`, `.github/workflows/provision-system.yml`, golden + registry-exempt |
| 2 | הוכחה חיה על מערכת בדיקה זמנית | pending | (ריצה חיה, ללא שינוי קוד) |
| 3 | קידום ל-main + פירוק מערכת הבדיקה | pending | merge + `decommission-test-system.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 0 — אירוח Google Workspace MCP כ-sidecar מרכזי

מוסיפים קונטיינר שלישי ל-Cloud Run של ה-gateway (כמו n8n-mcp), עם זהות Google משותפת אחת
(הסודות `gmail-oauth-*` שכבר ב-control). route חדש `/workspace/:system/mcp` + פרוקסי שמזריק
את הזהות server-side + bearer ארוך-טווח scoped למערכת.

**Acceptance:**
- [ ] `render-mcp-service-yaml.sh` מרנדר 3 קונטיינרים; ה-Workspace MCP על localhost:3002.
- [ ] `deploy-mcp-server.yml` ממליט את `gmail-oauth-*` + `workspace-mcp-internal-auth-token`.
- [ ] route `/workspace/:system/mcp` + minter `/workspace/:system/token` + bearer kind `workspace-runtime`.
- [ ] פריסה (Or-gated) ירוקה.

**הוכחה תפקודית (באותו שלב):** `google-mcp-smoke.yml` — mint bearer → MCP handshake →
list Google tools → קריאת read אחת (list calendars) מחזירה אמת. ירוק = הוכח.

**הערת התקדמות אחרונה (2026-06-09):** שלב 0a (ספייק) הושלם והוכח מקומית ב-/tmp:
`taylorwilsdon/google_workspace_mcp` v1.21.1 הורם ב-streamable-http headless עם
`--single-user --read-only`; MCP handshake עבר; tools/list החזיר 11 כלי-קריאה
(`list_calendars`, `get_events`, `search_gmail_messages`...); קריאת `list_calendars`
עם קרדנציאל מזויף הזריקה refresh מול `oauth2.googleapis.com` ונדחתה ב-`invalid_client`
— כלומר נתיב הקרדנציאל **מגיע לגוגל**; עם המפתח האמיתי (שכבר אומת מול גוגל בפיתוח השני)
זה יחזיר אמת. mode-C מוכח. נותר: 0b (קוד פרודקשן) ואז פריסה Or-gated.

**מסקנות מנגנון לקוד 0b/1:** הרצה = `workspace-mcp --single-user --transport
streamable-http --tools calendar gmail` (+`--read-only` או `--permissions`); env:
`WORKSPACE_MCP_CREDENTIALS_DIR`, `WORKSPACE_MCP_HOST=0.0.0.0`, `WORKSPACE_MCP_PORT`,
`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MCP_SINGLE_USER_MODE=1`; boot-shim כותב
`<dir>/<email>.json` = {token:null, refresh_token, token_uri, client_id, client_secret,
scopes[], expiry:null}; הכלים דורשים ארגומנט `user_google_email` → הסוכן חייב להעביר
את כתובת חשבון הגוגל המשותף (יוכנס ל-system prompt בשלב 1).

**שינוי תוכנית:** שלב 0 פוצל ל-0a (ספייק, הושלם) ו-0b (קוד+פריסה) — כדי להוכיח את
המנגנון לפני כתיבת קוד פרודקשן, לפי "תוכיח כל לבנה לבד".

---

### שלב 1 — תבנית מערכת: bootstrap + חיווט הסוכן

**Acceptance:**
- [ ] `bootstrap-google-mcp.yml` (תאום של bootstrap-gmail-oauth) יוצר קרדנציאל MCP Client Tool ב-n8n.
- [ ] נוד MCP Client Tool מחובר ל-`ops-agent` (ai_tool).
- [ ] `provision-system.yml` מעתיק את ה-bootstrap + יוצר מעטפת `workspace-mcp-bearer`.
- [ ] golden מסונכרן, registry-exempt מעודכן, שערי CI ירוקים.

**הוכחה תפקודית (באותו שלב):** שערי CI הסטטיים (golden sync/gate, changelog, skills-mirror,
shellcheck/yamllint) ירוקים על ה-PR.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה חיה על מערכת בדיקה זמנית

**Acceptance:**
- [ ] מערכת בדיקה זמנית (reuse, factory-test-25, 0 מכסה) עומדת — Or-gated.
- [ ] השינוי הוחל חי + bootstrap-google-mcp רץ + סוכנים יובאו מחדש.
- [ ] הסוכן עונה על שאלת Google אמיתית עם דאטה אמיתי דרך נתיב ה-MCP.

**הוכחה תפקודית (באותו שלב):** שאלה חיה ("מה ביומן מחר?") → תשובה עם דאטה אמיתי,
מאומת דרך `inspect_n8n_execution` + Telegram. זה השער שתופס מה ש-CI לא תופס.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — קידום + פירוק

**Acceptance:**
- [ ] merge ל-main (התבנית מעתה שולחת Google MCP לכל provision חדש).
- [ ] provision חדש מאמת שהקבצים נשלחים (golden משקף).
- [ ] מערכת הבדיקה הזמנית פורקה — Or-gated, user-triggered.

**הוכחה תפקודית (באותו שלב):** PR ממוזג + provision מאוחר שמראה את ה-bootstrap+node החדשים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 0a הושלם — הוכחתי בקטן (בלי עלות, בלי לגעת בחשבון האמיתי) ששרת ה-Google MCP
  עולה לבד עם מפתח משותף ומגיע עד גוגל. הדרך לבנות עליה — בטוחה.
