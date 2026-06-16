## הרחבת גישת Google למקסימום (google-workspace-maximize) — שלב 1

הרחבת הגישה ל-Google על סיידקאר ה-workspace-mcp הקיים מ-4 שירותים (Gmail, Calendar, Drive,
Docs) ל-**כל 12 שירותי ה-Workspace** ול-**מקסימום ההרשאות** — כדי שלא ייווצרו עוד קירות
"אין הרשאה" אחרי סגירת פיתוח. שינוי **control-plane** (ה-gateway + הסיידקאר + הקונסנט
בפרויקט-הבקרה), לא תהליך-הקמה.

**שלב 1 — הרחבת דלת-ההרשאות (gateway):**
- `services/mcp-server/src/google-oauth.ts` → `WORKSPACE_SCOPES` הורחב מ-17 ל-**41 scopes**
  (האיחוד המנוכה-כפילויות של כל 12 הקבוצות, נגזר מילולית מ-`auth/scopes.py` של החבילה @ תג
  v1.21.1 + base openid/userinfo). Gmail נשאר granular (לחבילה אין `https://mail.google.com/`,
  אז הפרופיל הוא trash-only ללא מחיקה-לצמיתות).
- `services/mcp-server/test/google-oauth.test.mjs` עודכן בהתאם (ליטרל ה-scope + `length` 17→41) —
  זהו אתר byte-equal **רביעי** שלא תועד קודם, ורץ ב-CI דרך `npm test` (Playground tests).
- `.github/workflows/request-workspace-scopes-consent.yml` — רענון טקסט מיושן ("6 scopes /
  Gmail+Calendar+Drive+Docs") לסט המלא, והוספת הבהרה ש-"אפליקציה לא מאומתת" תקין לחשבון פרטי.

**הסדר חסר-הנפילה:** הבקשה (gateway) מתרחבת קודם, ורק אחרי הסכמה-מחדש מתרחב הסיידקאר (הבדיקה) —
כך אין רגע של "Scope has changed". כשל-הסכמה נשאר לא-מזיק (הטוקן הישן חי).

מנוהל כפיתוח מתועד בשלבים (`devplans/google-workspace-maximize.md`). השלבים הבאים: הסכמה-מחדש
(Or לוחץ), מעבר הסיידקאר + הדלקת הכלים + עדכון ה-smoke, ותיעוד היתכנות.

## הרחבת גישת Google למקסימום (google-workspace-maximize) — שלבים 2–3

**שלב 2 — הסכמה-מחדש:** Or אישר בקליק אחד (`request-workspace-scopes-consent.yml`), וגוגל
העניק את **כל 41 ההרשאות** לחשבון האישי `edri2or@gmail.com` — בלי קיצוץ של אף scope (גם Chat,
Apps Script ו-Custom Search עברו). אומת דרך לוגי ה-gateway (הקולבק החזיר 200 + "captured +
stored") ותזמון הרוויזיה (הקונסנט רץ מול הדלת בת-41 ההרשאות).

**שלב 3 — מעבר (הרחבת הסיידקאר):**
- `scripts/render-mcp-service-yaml.sh` + `services/workspace-mcp/entrypoint.sh` —
  `WORKSPACE_MCP_TOOLS` הורחב ל-12 השירותים, ו-`WORKSPACE_MCP_SCOPES` / `default_scopes` ל-41
  ההרשאות. כל ארבעת אתרי ה-byte-equal זהים (41).
- `scripts/google-mcp-smoke.py` — נוספה בדיקת-נוכחות לקבוצות החדשות (Sheets:
  `read_sheet_values`/`modify_sheet_values`; Tasks: `list_task_lists`/`list_tasks`); הקריאות-החיות
  ל-Gmail/Drive נשמרו — הן המוכיחות שטוקן ה-41 מתרענן בלי "Scope has changed".
- בזכות הסדר חסר-הנפילה (הטוקן כבר רחב מאז שלב 2), מיזוג שלב 3 מרחיב את הסיידקאר ללא נפילה.
  אימות תפקודי-חי של הקבוצות החדשות + פער הפעלת-API נבדק אחרי הדיפלוי (מחוץ לשער, כדי לא לחסום
  את המעבר בכזב).

## הרחבת גישת Google למקסימום (google-workspace-maximize) — שלב 4 (אימות חי + ניקוי מחרוזות)

- `scripts/google-mcp-smoke.py` + `.github/workflows/google-mcp-smoke.yml` — בדיקת-העשן הורחבה
  בקריאה חיה אופציונלית (`CHECK_NEW_GROUPS` / `check_new_groups`) לקבוצה חדשה (`list_task_lists`
  → Tasks API), שמאמתת שהקבוצות החדשות באמת *יורות* (לא רק רשומות) ומגלה פער הפעלת-API אם קיים
  (השגיאה נוקבת בפרויקט + ב-API). כבוי כברירת-מחדל, אז שער ה-smoke הפנימי של הדיפלוי נשאר נוכחות-בלבד.
- `services/mcp-server/src/index.ts` — מחרוזות "6-scope" מיושנות בקולבק הקונסנט (הלוג + דף ההצלחה)
  הפכו **דינמיות** (`result.scopes.length`), כך שלא ייוותרו שגויות שוב; תיקון מקביל בהודעת ה-smoke.
