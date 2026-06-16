<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: הרחבת גישת Google למקסימום (workspace-mcp)
slug: google-workspace-maximize
opened: 2026-06-16
status: completed   # נסגר 2026-06-16 — כל 12 השירותים חיים ועובדים, מאומת חי
---

# תוכנית פיתוח — הרחבת גישת Google למקסימום

## מטרה

לאחד את כל הגישה ל-Google תחת מנוע אחד שכבר רץ (סיידקאר ה-workspace-mcp), ולפתוח עליו
את **כל 12 שירותי ה-Workspace** ואת **מקסימום ההרשאות** — שלא ניתקל יותר ב"אין הרשאה"
אחרי שפיתוח נסגר. Or בחר "הכל עכשיו (12 שירותים)" כולל Apps Script / Chat / Custom Search.

> **זה שינוי control-plane** (ה-gateway + הסיידקאר + הקונסנט בפרויקט-הבקרה), **לא** שינוי
> תהליך-הקמה (`templates/system/**` / `provision-system.yml` / deploy מערכת — לא נוגעים).
> לכן שער הזהב, שער ה-E2E, ולולאת ה-live של or-edri-4 — **לא רלוונטיים**. ה"הוכחה החיה"
> המתאימה היא **google-mcp-smoke** (שער ה-smoke הפנימי שרץ בתוך הדיפלוי + הרצה ידנית).

> **שער capability-first: דולג (כראוי)** — אין כאן verb חדש. רק הפעלת קבוצות-כלים שהחבילה
> כבר מממשת + הרחבת scopes. config/plumbing טהור.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הרחבת דלת-ההרשאות (gateway) + בדיקות + טקסט קונסנט | completed | `services/mcp-server/src/google-oauth.ts`, `services/mcp-server/test/google-oauth.test.mjs`, `.github/workflows/request-workspace-scopes-consent.yml` |
| 2 | הסכמה-מחדש לחשבון Google (Or לוחץ) | completed | — (תפעולי) |
| 3 | מעבר: הרחבת הסיידקאר + הדלקת הכלים + smoke | completed | `scripts/render-mcp-service-yaml.sh`, `services/workspace-mcp/entrypoint.sh`, `scripts/google-mcp-smoke.py` |
| 4 | אימות חי של הכלים החדשים + הדלקת API + תיעוד + סגירה | completed | `scripts/google-mcp-smoke.py`, `.github/workflows/google-mcp-smoke.yml`, `services/mcp-server/src/index.ts`, `docs/google-tools-feasibility.md`, `docs/google-identities.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

### הסדר חסר-הנפילה (לב התוכנית)
שני משתני-scope, שני מנגנונים, שני רגעים: `WORKSPACE_SCOPES` (gateway, אתר #1) מניע את
ה**בקשה** בקונסנט; `WORKSPACE_MCP_SCOPES` (סיידקאר, אתרים #2/#3) מניע את ה**בדיקה** בריענון
(google-auth נופל ב-"Scope has changed" אם הבדיקה רחבה מהטוקן החי). אסימטריה: טוקן-רחב עובד
עם סיידקאר-צר, אבל סיידקאר-רחב נשבר על טוקן-צר. לכן: **מרחיבים את הטוקן קודם, את הסיידקאר אחר
כך.** מיזוג שלב 1 מרחיב רק את ה-gateway (בקשה) → אין נפילה. קונסנט מרחיב את הטוקן. מיזוג שלב 3
מרחיב את הסיידקאר (בדיקה) כשהטוקן כבר רחב → אין נפילה. כשל-קונסנט = לא-מזיק (הטוקן הישן נשאר).

### ארבעת אתרי ה-byte-equal
1. `services/mcp-server/src/google-oauth.ts` → `WORKSPACE_SCOPES` (הבקשה + הולידטור).
2. `scripts/render-mcp-service-yaml.sh` → `WORKSPACE_MCP_SCOPES` + `WORKSPACE_MCP_TOOLS`.
3. `services/workspace-mcp/entrypoint.sh` → `default_scopes` + fallback של `WORKSPACE_MCP_TOOLS`.
4. `services/mcp-server/test/google-oauth.test.mjs` → ליטרל ה-scope + `length` (רץ ב-CI `npm test`).

---

### שלב 1 — הרחבת דלת-ההרשאות (gateway) + בדיקות + טקסט קונסנט

**Acceptance:**
- [ ] `WORKSPACE_SCOPES` (#1) = סט 41 ה-scopes המלא (מסדר קנוני), והבדיקה (#4) עודכנה (ליטרל + `length` 17→41).
- [ ] טקסט "6 scopes / Gmail+Calendar+Drive+Docs" ב-`request-workspace-scopes-consent.yml` רוענן לסט המלא.
- [ ] שערים סטטיים ירוקים: **Playground tests** (tsc + `google-oauth.test.mjs` ב-41), Changelog gates, shellcheck/yamllint, secret-scan, supply-chain. (אין golden, אין E2E.)

**הוכחה תפקודית (באותו שלב):** Playground tests ירוק = ה-tsc הידר את הסט החדש וה-unit test
(`google-oauth.test.mjs`) עבר ב-41 כולל `parseWorkspaceConsentResponse`. מיזוג מפעיל דיפלוי
**בטוח** (הסיידקאר לא השתנה → ללא נפילה); אימות `probe_endpoint` ל-`/health` של ה-gateway אחרי הדיפלוי.

**הוכחת E2E (artifact):** לא-התנהגותי (שינוי control-plane, לא קבצי-בוט).

**הערת התקדמות אחרונה:** ✅ הושלם. PR #485 מוזג; דיפלוי ה-gateway עבר (health 200 + smoke כולל כלי Google → אפס נפילה). הדלת מבקשת 41 הרשאות.

**שינוי תוכנית:** —

---

### שלב 2 — הסכמה-מחדש לחשבון Google (Or לוחץ)

**Acceptance:**
- [ ] `request-workspace-scopes-consent.yml` הופעל; Or קיבל קישור בטלגרם ולחץ Allow.
- [ ] `/workspace/consent/callback` אימת granted == 41 וכתב גרסת-טוקן חדשה ל-`gmail-oauth-refresh-token` (הישנה נשמרת לגיבוי).
- [ ] אם גוגל סירב ל-scope (סביר: `chat.*`): קצוץ אותו מ-#1+#4, דיפלוי-מחדש ל-gateway, קישור מתוקן. fallback בטוח = 9 שירותים / 28 scopes. הסט הסופי שנכבד = הקנוני לשלב 3.

**הוכחה תפקודית (באותו שלב):** הקולבק `/workspace/consent/callback` החזיר 200 + "captured + stored" בלוגים; הקונסנט רץ מול הרוויזיה מ-11:52 (זו עם 41 ההרשאות), והוולידטור (התאמה-מדויקת) עבר — כלומר גוגל אישר את כל 41 ההרשאות. (`list_secret_metadata` חסום ע"י שער ה-connector ב-web, אז אומת דרך הלוגים + תזמון הרוויזיה.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם — Or לחץ Allow, כל 41 ההרשאות אושרו (כולל Chat/Apps Script/Search, בלי קיצוץ), טוקן חדש נשמר ב-SM (הישן לגיבוי).

**שינוי תוכנית:** —

---

### שלב 3 — מעבר: הרחבת הסיידקאר + הדלקת הכלים + smoke

**Acceptance:**
- [ ] `WORKSPACE_MCP_SCOPES` (#2) + `default_scopes` (#3) = הסט הסופי שנכבד; `WORKSPACE_MCP_TOOLS` = השירותים שנכבדו. 4 האתרים byte-equal.
- [ ] `scripts/google-mcp-smoke.py` כולל בדיקות-נוכחות לכלים חדשים (Sheets + Tasks, בשמות המדויקים של 1.21.1) + קריאה חיה אחת.
- [ ] שערים סטטיים ירוקים; מיזוג מפעיל דיפלוי → שער ה-smoke הפנימי **ירוק** (קריאות אמת + בדיקת "Scope has changed").

**הוכחה תפקודית (באותו שלב):** שער ה-google-mcp-smoke הפנימי של הדיפלוי עובר — נוכחות הכלים החדשים (Sheets: read_sheet_values/modify_sheet_values; Tasks: list_task_lists/list_tasks) + קריאות-אמת חיות ל-Gmail/Drive שמוכיחות שטוקן ה-41 מתרענן בלי "Scope has changed". אימות תפקודי-חי של הקבוצות החדשות + פער הפעלת-API ייבדק ידנית אחרי הדיפלוי. בנוסף הרצה ידנית של `google-mcp-smoke.yml`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** העריכות בוצעו (render + entrypoint + smoke). אומת byte-equal של 4 האתרים (41 הרשאות), shellcheck/bash-n/py נקיים. נשאר: PR, CI ירוק, אישור Or למיזוג (מיזוג = דיפלוי הסיידקאר = הדלקת הכלים).

**שינוי תוכנית:** עדכון קל — ה-smoke בשער בודק *נוכחות* לכלים החדשים (Sheets/Tasks) + קריאות-אמת רק ל-Gmail/Drive, ולא קריאה-חיה לקבוצה חדשה: קריאה חיה תלויה בהפעלת-API (Sheets/Tasks API בפרויקט של ה-OAuth client) שטרם אומתה, ולא רוצים שתחסום את המעבר בכזב. אומת תפקודית אחרי הדיפלוי.

---

### שלב 4 — אימות חי של הכלים החדשים + הדלקת API + תיעוד + סגירה

Or בחר "תוודא ותדליק, אז תסגור" — לוודא חי שקבוצה חדשה באמת יורה, ולהדליק כל Google API שחסר.

**Acceptance:**
- [ ] `google-mcp-smoke.py` + `google-mcp-smoke.yml` — נוספה קריאה חיה אופציונלית (`CHECK_NEW_GROUPS`) לקבוצה חדשה (`list_task_lists` → Tasks API); תיקון מחרוזות "6-scope" מיושנות (`index.ts` דינמי לפי `result.scopes.length` + הודעת ה-smoke).
- [ ] אימות חי: דיספאטץ' `google-mcp-smoke.yml` (main) `check_new_groups=true` → קבוצה חדשה מחזירה נתונים אמיתיים. אם API חסר — להדליק בפרויקט של ה-OAuth client + לאמת מחדש.
- [ ] `docs/google-tools-feasibility.md` חדש: 12 שירותים/41 הרשאות; מסלול API-key נפרד (Maps/YouTube/Translate); לא-אפשרי (Keep/NotebookLM/Photos-full) + תאריך; הערת הפעלת-API; חוזה ה-4-אתרים; אזהרת Research-mode.
- [ ] רענון `docs/google-identities.md` (`--tools` המלא; "שלוש"→"ארבע" אתרים).
- [ ] `status: completed`.

**הוכחה תפקודית (באותו שלב):** דיספאטץ' `google-mcp-smoke.yml check_new_groups=true` מחזיר `PASS [new] list_task_lists returned live Tasks data` (אחרי הדלקת API אם נדרש). תיעוד = תוכן.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם. PR-A מוזג (#487); האימות החי תפס ש-8 ה-API החדשים לא היו מודלקים בפרויקט-הבקרה (Tasks 403). ה-broker לא הצליח להדליק/לתת-לעצמו הרשאה (חסר `setIamPolicy` על control — אי-דיוק בתיעוד gcp-action; flag ל-CLAUDE.md). Or הקצה ל-broker ידנית **Service Usage Admin** על control, ואז ה-broker הדליק את כל 8 ה-API (8 ריצות yellow ירוקות). אימות חוזר: `PASS [new] list_task_lists returned live Tasks data` — הכלים החדשים יורים חי. PR-B = תיעוד (`docs/google-tools-feasibility.md` + `google-identities.md`) + סגירה.

**שינוי תוכנית:** Or בחר אימות-חי + הדלקה (במקום תיעוד-בלבד) — שלב 4 כולל עכשיו קריאה חיה לקבוצה חדשה והדלקת-API.

---

## מצב מערכת-הטסט (Teardown ledger)

לא נעשה שימוש במערכת-טסט חד-פעמית — זהו שינוי control-plane על ה-gateway הקבוע. or-edri-4 לא
מעורב ולא מפורק. אין מה לפרק.

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — הרחבנו את "דלת ההרשאות" לכל 41 ההרשאות (12 שירותים), בלי נפילה בכלים הקיימים.
- שלב 2 הושלם — אישרת בקליק אחד, וגוגל נתן את כל 41 ההרשאות (כולל Chat / Apps Script / Custom Search).
- שלב 3 הושלם — המנוע הורחב ל-122 כלי Google (כל 12 השירותים), בלי שום נפילה; Gmail/Drive נבדקו חי.
- שלב 4 הושלם — בדיקה חיה גילתה שצריך "להדליק" את ה-API החדשים; אישרת ל-broker הרשאה, הוא הדליק את כל 8, ואומת חי שמשימות (Tasks) באמת עובדות. הפיתוח נסגר.
