---
dev_name: עריכת תוכן של קבצים לא-נייטיב ב-Google Drive
slug: drive-content-edit
opened: 2026-06-16
status: active
---

# תוכנית פיתוח — עריכת תוכן של קבצים לא-נייטיב ב-Google Drive

## מטרה

להוסיף יכולת לערוך את ה*תוכן* של קבצים לא-נייטיב ב-Google Drive (‎.md / .txt / בינארי),
שהכלי הקיים `update_drive_file` לא תומך בו (הוא עורך תוכן רק של Docs/Sheets/Slides).
הפתרון: כלי-MCP סינתטי חדש על ה-gateway המרכזי שקורא ישירות ל-Drive API
(`files.update` עם media upload), בלי לגעת בחוזה ה-scopes ובלי fork של `workspace-mcp`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | capability-first: הוכחת היכולת הגולמית מחוץ ל-n8n (go/no-go) | completed | `scripts/probe-drive-content-edit.mjs`, `tests/fixtures/drive-content-edit/`, `.github/workflows/drive-content-edit-probe.yml`, `docs/agent-specs/drive-content-edit.md` |
| 1 | הכלי ב-gateway (מודול + מיירוט פסאדה) | in-progress | `services/mcp-server/src/workspace-drive-edit.ts`, `services/mcp-server/src/workspace-mcp-proxy.ts`, `services/mcp-server/test/workspace-drive-edit.test.mjs` |
| 2 | פריסה + הוכחה חיה על or-edri-4 | in-progress | `scripts/drive-edit-smoke.mjs`, `.github/workflows/drive-edit-smoke.yml`, פריסה דרך `deploy-mcp-server.yml` |
| 3 | תיעוד + נעילה (promote) | pending | `docs/google-tools-feasibility.md`, `docs/google-identities.md`, `.claude/commands/google-workspace-guide.md`, מראה+זהב |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 0 — capability-first: הוכחת היכולת הגולמית

**Acceptance:**
- [ ] סקריפט מחוץ ל-n8n מעדכן תוכן של `.md` אמיתי ב-Drive דרך `files.update(media)` ומאמת שינוי.
- [ ] אותו דבר לקובץ בינארי קטן (PNG) — מאמת bytes.
- [ ] go/no-go נרשם ב-`docs/agent-specs/drive-content-edit.md`.

**הוכחה תפקודית (באותו שלב):** ריצת `drive-content-edit-probe.yml` (WIF→broker→SM→Google)
מסתיימת ירוקה והלוג מאשר `content changed` ל-.md ולבינארי, ואז trash לשני הקבצים הזמניים.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע ב-`workflows/n8n/*.json`).

**הערת התקדמות אחרונה:** ✅ הושלם — run `27636636406` ירוק: `.md` ובינארי PNG עודכנו ואומתו
ב-read-back, הקבצים הזמניים נמחקו. verdict=GO נרשם ב-Capability Card.

**שינוי תוכנית:** —

---

### שלב 1 — הכלי ב-gateway

**Acceptance:**
- [x] מודול `workspace-drive-edit.ts` עם מינטינג access token + מגן MIME + `files.update(media)`.
- [x] מיירוט פסאדה: `tools/list` כולל `edit_drive_file_content`, `tools/call` מנותב.
- [x] `npm test` ירוק.

**הוכחה תפקודית (באותו שלב):** בדיקות יחידה ירוקות (118/118, 15 חדשות); `injectToolIntoToolsList`
מוכיח שהכלי נכנס לרשימה, `parseDriveEditArgs`/`isGoogleNativeMime` מוכיחים ולידציה ומגן MIME.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הכלי + הפסאדה נבנו, 118/118 בדיקות עוברות. ממתין לפריסה+הוכחה חיה (שלב 2).

**שינוי תוכנית:** —

---

### שלב 2 — פריסה + הוכחה חיה על or-edri-4

**Acceptance:**
- [ ] פריסה דרך `deploy-mcp-server.yml` (אוטומטית על המיזוג של שלב 1).
- [ ] smoke חי (`drive-edit-smoke.yml`) על מסלול ה-workspace של or-edri-4: `tools/list` כולל הכלי, עריכת `.md` + read-back תואם.

**הוכחה תפקודית (באותו שלב):** ריצת smoke ירוקה עם read-back assert על Drive חי.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הפריסה רצה אוטומטית מהמיזוג של שלב 1; ה-smoke החי נבנה. ממתין לסיום הפריסה כדי לדסּפּץ' את ה-smoke.

**שינוי תוכנית:** —

---

### שלב 3 — תיעוד + נעילה

**Acceptance:**
- [ ] עדכון 3 מסמכי ה-Google (הסרת מגבלת ה-.md/.txt), הוספת הכלי.
- [ ] `sync-skills-mirror.sh` + רענון זהב; שערי CI ירוקים.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד + שערי CI ירוקים.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- (מתמלא תוך כדי)
</content>
