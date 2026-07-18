## תיקון: verify_railway_system הפסיק לזהות את שירות ה-Postgres (התראת-שווא של רישיות)

הכלי `verify_railway_system` דיווח על שירות ה-Postgres של המערכת כ"לא קיים" — התראת-שווא. המסד
בריא ותקין; הכלי פשוט השווה את שם השירות מול המחרוזת `"postgres"` באות קטנה, בעוד ש-Railway
מקרא לשירות **`Postgres`** עם P גדולה. ההשוואה הייתה case-sensitive, אז היא פספסה.

**אומת חי (2026-07-18):** `verify_railway_system(or-aios)` החזיר `service-postgres-exists: fail`
ו-`RailwayReady: False`; `get_railway_project` הראה שהשירות **כן** קיים בשם `Postgres` והפריסה
האחרונה שלו = SUCCESS. כלומר תקלה בכלי-הבדיקה בלבד, לא במערכת.

**התיקון:** נוסף עוזר טהור `namesEqualCI` (`src/name-match.ts`) — השוואת-שם חסרת-רגישות-לרישיות
ובטוחה-ל-null. הוא מוחל בכלי ה-`verify_*` בכל מקום שבו מותאם משאב לפי שם שנבחר ע"י אדם:
- `verify_railway_system` — שירות (postgres/n8n), שם-פרויקט, וסביבת production.
- `verify_github_system` — ה-ruleset בשם `protect-main` (הגנה-לעומק; אין באג חי שם).

**ביקורת האחים (התבקשה):** `verify_gcp_system` (מתאים לפי מזהי-API כמו `run.googleapis.com`)
ו-`verify_cloudflare_system` (מתאים לפי מזהה-רשומה אטום + סוג-רשומה) **אינם** משווים לפי שם
שנבחר ע"י אדם — לכן לא שונו.

**בדיקה:** נוסף `test/name-match.test.mjs` — בדיקת רגרסיה (Postgres≡postgres, N8N≡n8n,
אי-התאמה, ובטיחות-null). לאחר מיזוג, `deploy-mcp-server.yml` פורס את השער אוטומטית (הדיף נוגע
ב-`services/mcp-server/**`), ואז אימות חי חוזר של or-aios אמור להראות את כל הבדיקות ירוקות.
