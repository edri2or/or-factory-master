## ראות מובנית על בוט-הטלגרם (bot-trace-observability)

> כל מערכת חדשה נולדת עם "קופסה שחורה" לבוט: טבלת `agent_trace_events` שרושמת לכל קריאת-כלי
> זוג ניסיון→תוצאה אמיתית, ו-3 שאילתות (שיחה+trace) חשופות לסוכן-פיתוח דרך MCP — לתפיסת הפער
> "הבוט טען אך לא עשה" (תבנית n8n #28843: צומת מדווח success אך הפעולה נעלמה בשקט).

### שלב 1 — טבלת `agent_trace_events` ב-db-setup

- **טבלת תיעוד חדשה** ב-`templates/system/workflows/n8n/db-setup.json` (צומת "Create Tables"):
  `agent_trace_events(id BIGSERIAL PK, trace_id TEXT, session_id TEXT NN, turn_id BIGINT,
  tool_name TEXT NN, tool_call_id TEXT NN, status TEXT NN DEFAULT 'attempted', input_summary JSONB,
  output_summary JSONB, error_message TEXT, started_at TIMESTAMPTZ NN DEFAULT now(),
  finished_at TIMESTAMPTZ, duration_ms INTEGER)` — שדות תואמי-OTel GenAI (זוג ניסיון→תוצאה
  per קריאת-כלי). אינדקסים על `(session_id)`,`(tool_call_id)`,`(started_at)`.
- **אידמפוטנטי בסגנון הקובץ:** `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN
  IF NOT EXISTS` (כמו audit_log/pending_actions) + `CREATE INDEX IF NOT EXISTS`; הטבלה נוספה
  גם לרשימת ה-`SELECT` המאמת בסוף הצומת.
- **בלי שינוי מתקין:** `configure-agent-router.yml` כבר מריץ את db-setup (`@@CRED_POSTGRES_ID@@`
  מוזרק קיים) — הטבלה נוצרת אוטומטית בכל מערכת חדשה, ובמערכת קיימת בריצה חוזרת אידמפוטנטית.
- golden רוענן (`scripts/check-system-golden.sh --update`); שני שערי-הזהב ירוקים.

### שלב 2 — אינסטרומנטציה + שאילתות חשיפה ב-postgres-named-queries

- **גבול-הכלי מתועד** ב-`templates/system/workflows/n8n/postgres-named-queries.json`: כל קריאה
  כותבת זוג ניסיון→תוצאה ל-`agent_trace_events`. צמתים חדשים: **Mint Trace** (Code — מייצר
  `tool_call_id` ב-JS + `input_summary` בטוח-SQL עם `esc()` כמו request-write-action),
  **Write Trace Attempt** (INSERT `status='attempted'` + עוגן-תור ב-SQL: `max(id)` מ-
  `n8n_chat_histories` — בלי חיווט), **Write Trace Result** (UPDATE `success`/`failed` +
  `output_summary`/`duration_ms`), ו-**Return Tool Payload** (Code — משדר מחדש את פלט
  Format Output כך שה-toolWorkflow מחזיר ל-LLM `{ok,query_name,rows}` ולא את תוצאת ה-UPDATE).
  כל הכותבים `onError:continueRegularOutput`+`alwaysOutputData` — לעולם לא שוברים תשובת בוט.
- **תיקון נדרש:** צומת Postgres "מוחק" את `$json`, אז 5 תנאי ה-Switch הופנו ל-
  `$('Normalize Input').first().json.query_name` (קריאה לפי-שם, ניצולת clobber).
- **3 שאילתות חשיפה חדשות** (אותו קובץ, אותו דפוס): `conversation_transcript` (תמלול מ-
  `n8n_chat_histories`, פורמט LangChain `message->'data'->>'content'`), `tool_trace_recent`
  (שורות trace אחרונות), `claim_actual_mismatch` (גלאי הפער: קריאות עם attempt בלי success →
  `silently_dropped`/`no_success`, או `failed`, עם LEFT JOIN להודעת-המפעיל לפי turn_id).
  הורחבו ה-whitelist ב-Normalize Input ורשימת השמות ב-Unknown Query. נחשפות אוטומטית ל-MCP
  (mcp-server מצביע לאותו sub-workflow).
- אומת מבנית (jq + בדיקת חיווט: אפס IDs/שמות כפולים, כל קצה-חיבור וכל `$('…')` מצביע לצומת קיים);
  golden רוענן; שערי-הזהב ירוקים. (התנהגות חיה — שלב 5.)

### שלב 3 — שכפול אינסטרומנטציה ל-github-readonly + railway-readonly

- **אותו דפוס trace** הוחל על `github-readonly.json` (15→19 צמתים) ו-`railway-readonly.json`
  (9→13): Mint Trace → Write Trace Attempt (לפני Token-mint / Route, tool_name תואם) →
  Format Output → Write Trace Result → Return Tool Payload. github כבר קרא `$('Normalize Input')`
  לפי-שם; ב-railway הופנו 2 תנאי ה-Switch לפי-שם (clobber של Postgres).
- **שינוי מתקין (configure-agent-router.yml):** prep של github/railway קיבל
  `@@CRED_POSTGRES_ID@@`+`@@CHAT_ID@@` (לא היו Postgres-consumers קודם), עם **fallback אם אין PG**
  — `jq` שמסיר את 4 צמתי-ה-trace ומשחזר את ה-topology המקורי (Normalize→Token Cache Check /
  Route by Command, Format Output טרמינל). זהו ה"שינוי 6" שה-handoff צפה. *(תיקון תוך-כדי: ה-jq
  הראשון השתמש ב-`index(.name)` ששגוי בהקשר; הוחלף ל-`.name | IN(...)` ואומת ששתי המערכות חוזרות
  ל-topology המקורי.)*
- אומת: yamllint על המתקין; happy-path (PG קיים) + מסלול-ה-strip (אין PG) שניהם מייצרים JSON תקין
  עם topology נכון; golden רוענן; שערי-הזהב ירוקים. (התנהגות חיה — שלב 5.)

### שלב 4 — חשיפה ב-MCP + תיאורי-כלי

- **תיאור `postgres_named_query` הורחב מ-5 ל-8 שמות** בשלושת המקומות שמתעדים את הכלי:
  `mcp-server.json` (המשטח שסוכן-הפיתוח קורא דרך `/mcp/system-tools`), `ops-agent.json`,
  `unknown-agent.json` — עם gloss קצר לכל שאילתה חדשה (conversation_transcript / tool_trace_recent /
  claim_actual_mismatch). כך סוכן-הפיתוח (וגם סוכני-הבוט) יודעים שהשאילתות קיימות וכיצד להשתמש בהן.
- גם רשימת-השמות ב-system-prompt של ops-agent עודכנה ל-8 השמות (עקביות).
- אומת jq על שלושת הקבצים; golden רוענן; שערי-הזהב ירוקים. (קריאה חיה דרך MCP — שלב 5.)

### שלב 5 — הוכחה חיה + תיקון באג db-setup שההוכחה תפסה

- **ההוכחה החיה רצה על factory-test-061** (provision → register-app → deploy → הוחל הענף דרך
  `prove-on-test-system` → configure): כל ה-workflows המחווטים הותקנו ופורסמו חי; הבוט חי ומגיב,
  והסוכן קרא בפועל את `postgres_named_query` (מנוע-השאילתות + הניתוב עובדים מקצה-לקצה).
- **באג קריטי שנתפס (fix‑forward, מעבר ל-scope המקורי, מאושר):** ב-n8n 2.x ההרצה של `db-setup`
  דרך `/rest/workflows/:id/run` **השמיטה `triggerToStartFrom`**, אז רץ רק צומת ה-trigger
  ("Run Once") ו-"Create Tables" **לעולם לא רץ** → אף טבלה לא נוצרת, בעוד `/run` מחזיר 200 →
  "PASS" שקרי. שובר בשקט את כל זיכרון-המסד של הבוט (spend/audit/style/pending + agent_trace_events)
  מאז שדרוג n8n 2.x. אומת חי: exec lastNode="Run Once", הבוט החזיר `relation "spend_track_state"
  does not exist`. *(זה בדיוק הפער "טען-אך-לא-עשה" שהפיתוח הזה נועד לחשוף.)*
- **התיקון ב-`configure-agent-router.yml`:** `RUN_BODY` קיבל
  `triggerToStartFrom:{"name":"Run Once"}` (כמו כפתור "Execute workflow" של n8n) — מריץ
  Run Once → Create Tables. בנוסף **אימות אמיתי**: קריאת ה-execution האחרון ובדיקה
  `lastNodeExecuted == "Create Tables"` (לא רק HTTP 200) — הורג את ה-false-positive שהסתיר את הבאג.
- אומת: yamllint; golden רוענן; שערי-הזהב + executeWorkflow gate ירוקים. (אימות חי על
  factory-test-061 — לאחר ההחלה.)
