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
