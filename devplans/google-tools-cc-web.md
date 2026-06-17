<!--
DEVPLAN — google-tools-cc-web
מנוהל על-ידי /dev-stage-factory. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: גישת כלי Google מ-Claude Code on the web
slug: google-tools-cc-web
opened: 2026-06-17
status: active
---

# תוכנית פיתוח — גישת כלי Google מ-Claude Code on the web

## מטרה

ב-Claude Code on the web כלי-הגוגל (Drive/Gmail/Calendar) נכשל כי מחבר "שבור" מנסה
OAuth דרך `http://localhost:3002/oauth2callback` — מה שלא יכול להסתיים בקונטיינר ענן
אֶפֶמֶרי (מגבלת-פלטפורמה מתועדת, לא באג שלנו). התיקון בצד הפקטורי: ה-gateway שלנו כבר
OAuth 2.1 server מלא שמחזיק את טוקן-גוגל **בצד-שרת** וחושף את כלי-הגוגל ב-`/workspace/<system>/mcp`.
הלקוח מתאמת **ל-gateway** (לא לגוגל), אז מגבלת ה-redirect של גוגל לא חלה — בדיוק כמו
שזה כבר עובד כ-connector ב-claude.ai וכמו שמחבר ה-`/mcp` של הפקטורי כבר עובד ב-Claude
Code web. המטרה: להפנות מחבר ל-`<issuer>/workspace/or-edri-4/mcp`, ולהוכיח חי קריאת
Drive אמיתית (`search_drive_files` על `edri2or@gmail.com`) בסשן Claude Code web.

> **אין יכולת חדשה.** זה תיעוד + הרחבת סקיל `/prove-connector` + הוכחה חיה. הקוד של
> ה-gateway (OAuth + `/workspace`) כבר עושה הכל — לא נוגעים בו, ולא בחוזה-ה-scope
> (`docs/google-tools-feasibility.md`, 4 אתרים). Step 0 של capability-first מדולג מפורשות.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | אימות צד-שרת (קריאה בלבד, ללא Or) | completed | — (כלי MCP בלבד) |
| 3 | הוכחה חיה (Or-gated) — Drive read ב-Claude Code web | in-progress | — (סשן חי) |
| 2 | תיעוד הכתובת + מלכודת ה-localhost + הרחבת `/prove-connector` | pending | `docs/mcp-connector-setup.md`, `CLAUDE.md`, `.claude/commands/google-workspace-guide.md`, `.claude/commands/prove-connector.md` |

> **סדר עודכן (prove-first):** שלב 3 (הוכחה חיה) רץ **לפני** שלב 2 (תיעוד) — מתעדים מציאות
> מאומתת, לא ניחוש. עיקרון dev-stage-factory: מוכיחים חי, ואז נועלים בתיעוד.

> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח. שלב 3 הוא שער ההצלחה — בלי קריאת Drive חיה
> מאומתת בסשן Claude Code web, הפיתוח לא נסגר.

---

### שלב 1 — אימות צד-שרת (קריאה בלבד, ללא Or)

**Acceptance:**
- [ ] קוראים את ה-issuer החי (`verify_mcp_server` → `mcp-oauth-issuer`, או ה-Summary של ה-deploy האחרון).
- [ ] מאמתים ש-`edri2or@gmail.com` ב-`OAUTH_ALLOWED_EMAILS` ושהטוקן המשותף + כלי Drive עובדים חי בצד-שרת (מסלול `google-mcp-smoke`, עבר 2026-06-17).
- [ ] `probe_endpoint` על `/workspace/or-edri-4/mcp` מחזיר `401` עם header `WWW-Authenticate` שמצביע ל-`resource_metadata` (האתגר שמחבר צריך).

**הוכחה תפקודית (באותו שלב):** קריאות MCP חיות — `verify_mcp_server` מחזיר את ה-issuer; `probe_endpoint` מחזיר 401 + WWW-Authenticate. אם `google-mcp-smoke` כבר ירוק היום — מצטטים את הריצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם 2026-06-17. `probe_endpoint` על `/.well-known/oauth-authorization-server` → `200`, `issuer=https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app` (תואם המתועד; authorize/token/register + PKCE-S256). `probe_endpoint` POST על `/workspace/or-edri-4/mcp` → `401 {"error":"unauthorized"}` — שער ה-OAuth שמחבר צריך (ה-header WWW-Authenticate→resource_metadata מוגדר ב-index.ts ונקרא ישירות). `google-mcp-smoke` עבר 2026-06-17 (נתון מהמשימה). `WORKSPACE_ALLOWED_SYSTEMS="*"` → `or-edri-4` תקף. `OAUTH_ALLOWED_EMAILS` = Or בלבד (מתועד ב-CLAUDE.md). `oauth` bearer עובר את `/workspace` (systemRouteAllows, index.ts:124-127).

**שינוי תוכנית:** —

---

### שלב 2 — תיעוד הכתובת + מלכודת ה-localhost + הרחבת `/prove-connector`

**Acceptance:**
- [ ] `docs/mcp-connector-setup.md`: קטע חדש "Claude Code on the web" — כתובת המחבר ל-Workspace (`<issuer>/workspace/or-edri-4/mcp`), שזה מחבר נפרד ממחבר ה-`/mcp` של הפקטורי ו-scope-אימות נפרד מ-claude.ai, ושצריך להסיר את המחבר השבור (`localhost:3002/oauth2callback`) + למה.
- [ ] `CLAUDE.md` (§ Web-session connector gate): שורה אחת על המלכודת ועל המסלול הנכון.
- [ ] `.claude/commands/google-workspace-guide.md`: איך Claude Code web מגיע לכלים.
- [ ] `.claude/commands/prove-connector.md`: מכסה גם את מסלול ה-Workspace (מדפיס את הכתובת החיה ל-Or, רושם "הוספתי + כלי X רץ ✅").
- [ ] `changelog.d/2026-06-17-google-tools-cc-web.md` נוסף; CI ירוק (כולל skills-mirror אם נגעו בסקיל).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד + סקיל מנחה). הכתובת המתועדת מאומתת מול ה-issuer החי שנקרא בשלב 1.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — הוכחה חיה (Or-gated) — Drive read ב-Claude Code web

**Acceptance:**
- [ ] Or מקבל הוראה אחת בעברית פשוטה עם הכתובת המדויקת: ב-Claude Code web להוסיף מחבר `<issuer>/workspace/or-edri-4/mcp`, להתחבר עם `edri2or@gmail.com`, ולהסיר את המחבר השבור.
- [ ] בסשן Claude Code web: `search_drive_files` (קריאה בלבד) על `edri2or@gmail.com` מחזיר תוצאה אמיתית — ללא OAuth-localhost.
- [ ] התוצאה המאומתת נרשמת בקובץ הזה; `status: completed`.
- [ ] אם מתברר קיר-פלטפורמה: מתועד עם מקור (תיעוד Claude Code) + חלופה נתמכת, במקום ניחוש.

**הוכחה תפקודית (באותו שלב):** קריאת Drive חיה בסשן Claude Code web — זו הגדרת ההצלחה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- 2026-06-17: התוכנית פתוחה. חקרתי לעומק (קוד ה-gateway + תיעוד Claude Code) — ההשערה אומתה: ה-gateway שלנו מחזיק את טוקן-גוגל אצלו, אז אפשר לחבר אותו כ-connector ל-Claude Code web והכלים יעבדו ללא localhost. נשאר להוכיח חי.
