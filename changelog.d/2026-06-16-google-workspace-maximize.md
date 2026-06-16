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
