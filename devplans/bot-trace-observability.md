<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
פיתוח בתהליך-הקמה: מוכח על מערכת-טסט חיה לפני קידום (docs/live-test-loop.md).
-->
---
dev_name: ראות מובנית על בוט-הטלגרם (claim-vs-actual)
slug: bot-trace-observability
opened: 2026-06-10
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — ראות מובנית על בוט-הטלגרם של כל מערכת

## מטרה

כל מערכת חדשה שהפקטורי מקים תיוולד עם "קופסה שחורה" לבוט-הטלגרם שלה: טבלת `agent_trace_events`
שרושמת לכל קריאת-כלי זוג **ניסיון→תוצאה אמיתית**, ו-3 שאילתות שחושפות לסוכן-פיתוח (דרך MCP)
גם את תמלול-השיחה וגם את רשומות-הכלים — כדי לתפוס את הפער "הבוט טען אך לא עשה" (תבנית n8n
#28843: צומת שמדווח הצלחה אך הפעולה נעלמה בשקט). שינוי בתהליך-ההקמה → מוכח על מערכת-טסט חיה.

## תכן נעול (מאומת מול הקוד, צעד 0)

- **קורלציה בלי חיווט:** שורת-הניסיון מחשבת `turn_id` ישירות ב-SQL —
  `(SELECT max(id) FROM n8n_chat_histories WHERE session_id='tg:'||@@CHAT_ID@@)`. אפס נגיעה
  ב-`tg-inbound`/`agent-router`/הסוכנים. (החלפת "שינוי 3" של ה-handoff.)
- **בלי שינוי מתקין:** `configure-agent-router.yml` כבר מריץ db-setup, מחליף+מתקין
  postgres-named-queries (`@@CRED_POSTGRES_ID@@`,`@@CHAT_ID@@`) ומייצא אותו ב-mcp-server.
  SQL חדש שמשתמש באותם placeholders מחווט אוטומטית. (ביטול "שינוי 6".)
- **scope v1:** אינסטרומנטציה ל-3 כלי-הקריאה בלבד (postgres-named-queries, github-readonly,
  railway-readonly). `request-write-action` **נדחה** — תוצאות-כתיבה כבר נרשמות ב-`pending_actions`
  (`executed_at`/`error_record`); אינסטרומנטציה שם = הכפלה (החלטה 2 ב-handoff).
- **gotcha קריטי (מאומת):** `toolWorkflow` מחזיר את פלט **הצומת האחרון** שרץ. כתיבת-trace אחרי
  `Format Output` תשבור את החוזה מול ה-LLM → נדרש צומת Code זעיר `Return Tool Payload` שמשדר
  מחדש `$('Format Output').first().json`. כל צומת-trace = `onError:continueRegularOutput` +
  `alwaysOutputData:true` (לעולם לא שובר את תשובת הבוט).
- **סכמה:** `agent_trace_events(id BIGSERIAL PK, trace_id TEXT, session_id TEXT NN, turn_id BIGINT,
  tool_name TEXT NN, tool_call_id TEXT NN, status TEXT NN DEFAULT 'attempted', input_summary JSONB,
  output_summary JSONB, error_message TEXT, started_at TIMESTAMPTZ NN DEFAULT now(),
  finished_at TIMESTAMPTZ, duration_ms INTEGER)`, אינדקסים על (session_id),(tool_call_id),(started_at).
  `tool_call_id = md5(random()::text || clock_timestamp()::text)` (בלי pgcrypto), נישא ל-result
  דרך `$('Write Trace Attempt').first().json`.
- **מאומת:** אין שום `INSERT INTO audit_log` באף workflow (audit_log לקריאה בלבד) — הטבלה החדשה
  עומדת בכוחות עצמה. הכלים נקראים כ-`toolWorkflow` עם input מה-LLM; `@@CHAT_ID@@` מוזרק בזמן-בנייה
  ולכן session_id ידוע בכל sub-workflow ללא חיווט.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | נעילת תכן + פתיחת תוכנית (קריאה בלבד) | completed | devplans/bot-trace-observability.md |
| 1 | טבלת `agent_trace_events` | completed | db-setup.json + golden + changelog |
| 2 | postgres-named-queries: אינסטרומנטציה + 3 שאילתות חשיפה | completed | postgres-named-queries.json + golden + changelog |
| 3 | שכפול אינסטרומנטציה ל-github-readonly + railway-readonly | pending | github-readonly / railway-readonly + golden + changelog |
| 4 | חשיפה ב-MCP + תיאורי-כלי | pending | mcp-server / ops-agent / unknown-agent + golden + changelog |
| 5 | הוכחה חיה על מערכת-טסט [עולה כסף] | pending | (בלי עריכת תבנית; ייתכן push תיקונים) |
| 6 | תיעוד + קידום + סגירה | pending | docs/telegram-chat-bot.md + changelog/golden + devplan |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב (מודל /dev-stage-factory):** שלבי-תבנית מוכחים same-stage ע"י golden מרוענן +
> "Playground tests" + "Changelog gates" ירוקים + `validate_workflow` (n8n MCP) על ה-JSON; ההוכחה
> ההתנהגותית מרוכזת בשלב 5 על מערכת-טסט חיה (זה המודל — static בכל שלב, live בשלב ייעודי).

---

### שלב 0 — נעילת תכן + פתיחת תוכנית

**Acceptance:**
- [x] אומת: אין `INSERT INTO audit_log` באף workflow (התוכנית לא נשענת עליו).
- [x] אומת: כלים = `toolWorkflow`, `@@CHAT_ID@@` בזמן-בנייה, session_id=`'tg:'||chat_id`.
- [x] אומת ה-gotcha של ערך-החזרה של toolWorkflow + הפתרון (Return Tool Payload).
- [x] נקבעו 2 ההקלות (קורלציה ב-SQL, בלי שינוי מתקין) ו-scope v1 (3 כלי-קריאה).
- [x] טרמינולוגיה יושרה ל-#28843 (צומת מדווח success אך הפעולה נעלמה בשקט).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — אימות קריאה-בלבד מול ה-JSON האמיתי, מתועד כאן.

**הערת התקדמות אחרונה:** הושלם. אומת מול db-setup.json, postgres-named-queries.json, ושלושת
דוחות-החקירה. התכן נעול. ממתין לאישור Or להתחיל שלב 1.

**שינוי תוכנית:** מול ה-handoff — בוטל חיווט turn_id ב-tg-inbound (הוחלף בעוגן SQL), ובוטל שינוי
המתקין (כבר מחווט). נדחתה אינסטרומנטציה של request-write-action (כפילות עם pending_actions).

---

### שלב 1 — טבלת `agent_trace_events`

**Acceptance:**
- [x] DDL אידמפוטנטי (`CREATE TABLE/INDEX IF NOT EXISTS`) נוסף ל-"Create Tables" ב-db-setup.json, לפני ה-SELECT המאמת.
- [x] `'agent_trace_events'` נוסף לרשימת ה-`IN (…)` של ה-SELECT המאמת.
- [x] golden רוענן (`scripts/check-system-golden.sh --update`) ונכלל באותו commit.
- [x] fragment ל-changelog.d + עדכון devplan באותו commit.

**הוכחה תפקודית (באותו שלב):** JSON תקין (jq) — שינוי SQL בלבד בצומת קיים, בלי שינוי מבני;
golden + "Playground tests" + "Changelog gates" ירוקים. (`validate_workflow` המבני נדרש בשלבים
2–3 שמוסיפים צמתים; יצירת-הטבלה בפועל מוכחת בשלב 5 על מערכת חיה — מודל הפקטורי.)

**הערת התקדמות אחרונה:** הושלם. db-setup.json עודכן (CREATE+ALTER+3 אינדקסים, +רשימת-אימות),
JSON תקין (jq), golden רוענן (MANIFEST בלבד), שני שערי-הזהב ירוקים מקומית. נוסף `ALTER TABLE
... ADD COLUMN IF NOT EXISTS` לריפוי-עצמי אם הטבלה קיימת מסכמה ישנה.

**שינוי תוכנית:** —

---

### שלב 2 — postgres-named-queries: אינסטרומנטציה + 3 שאילתות חשיפה

**Acceptance:**
- [x] גבול-הכלי ב-postgres-named-queries: "Mint Trace" (Code — tool_call_id ב-JS + input_summary
      בטוח-SQL ב-`esc()`), "Write Trace Attempt" (INSERT 'attempted' + עוגן-תור `max(id)` ב-SQL),
      "Write Trace Result" (UPDATE success/failed + output_summary/duration_ms), "Return Tool Payload"
      (Code — משדר מחדש את Format Output כך שה-toolWorkflow מחזיר את payload-הכלי).
- [x] כל צמתי-ה-trace: `onError:continueRegularOutput` + `alwaysOutputData:true`, credential `@@CRED_POSTGRES_ID@@`.
- [x] input מה-LLM בטוח-SQL ב-`esc()`+אינטרפולציה (דפוס request-write-action) — לא queryReplacement.
- [x] 5 תנאי ה-Switch הופנו ל-`$('Normalize Input')` (clobber של צומת Postgres).
- [x] 3 שאילתות חדשות (conversation_transcript / tool_trace_recent / claim_actual_mismatch) + whitelist + Unknown-Query text; Unknown Query נשאר אחרון.
- [x] golden + changelog + devplan באותו commit.

**הוכחה תפקודית (באותו שלב):** jq תקין + בדיקת-חיווט בלתי-תלוית-MCP (אפס IDs/שמות כפולים; כל
קצה-חיבור וכל `$('…')` מצביע לצומת קיים; Switch 9 פלטים = 9 חיבורים); golden + שערי-הזהב ירוקים.
(התנהגות חיה — כתיבת trace + 3 השאילתות — מוכחת בשלב 5.)

**הערת התקדמות אחרונה:** הושלם. postgres-named-queries עבר מ-13 ל-17 צמתים; אומת מבנית.

**שינוי תוכנית:** מיזגתי את שלב 3 המקורי (3 השאילתות) לתוך שלב 2, כי הן באותו קובץ
(postgres-named-queries) — עריכה אחת קוהרנטית עדיפה על שתיים. שלב 3 הוגדר מחדש: שכפול
האינסטרומנטציה לשני כלי-הקריאה האחרים (github-readonly + railway-readonly).

---

### שלב 3 — שכפול אינסטרומנטציה ל-github-readonly + railway-readonly

**Acceptance:**
- [ ] אותו דפוס trace (Mint Trace → Write Trace Attempt → … → Write Trace Result → Return Tool Payload)
      מוחל על github-readonly.json ו-railway-readonly.json, עם tool_name מתאים ו-input_summary מהפקודה.
- [ ] קריאה לפי-שם היכן ש-Postgres "מוחק" $json (כמו ב-Switch של postgres-named-queries).
- [ ] כל צמתי-ה-trace `onError:continueRegularOutput`; ה-toolWorkflow ממשיך להחזיר את ה-payload המקורי.
- [ ] golden + changelog + devplan באותו commit.

**הוכחה תפקודית (באותו שלב):** jq + בדיקת-חיווט בלתי-תלוית-MCP על שני הקבצים; CI ירוק.
(התנהגות חיה — שלב 5.)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** הוגדר מחדש (ראו שלב 2): מ-"3 שאילתות חשיפה" ל-"שכפול אינסטרומנטציה לשני הסיבלינגים".

---

### שלב 4 — חשיפה ב-MCP + תיאורי-כלי

**Acceptance:**
- [ ] תיאור `postgres_named_query` ב-mcp-server.json + ops-agent.json + unknown-agent.json הורחב
      ל-8 השמות (5 קיימים + 3 חדשים) עם gloss קצר לכל אחד.
- [ ] golden + changelog + devplan באותו commit.

**הוכחה תפקודית (באותו שלב):** `validate_workflow` על 3 הקבצים עובר; CI ירוק; התיאור מציג את 3
השמות החדשים. (קריאה דרך MCP מוכחת בשלב 5.)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — הוכחה חיה על מערכת-טסט [עולה כסף — אישור Or מפורש לפני]

**Acceptance:**
- [ ] מערכת-טסט לזריקה הוקמה ב-reuse mode (`shared_gcp_project=factory-test-25`): provision → register-app → deploy.
- [ ] השינוי מהענף הוחל חי: `prove-on-test-system.yml` (`ref=claude/affectionate-feynman-qb3ppd`,
      `paths=templates/system/workflows/n8n`, `post_apply_workflow=configure-agent-router.yml`).
- [ ] round-trip אמיתי בטלגרם שמפעיל כלי → דרך MCP: conversation_transcript מחזיר שיחה;
      tool_trace_recent מחזיר attempted+success/failed; claim_actual_mismatch מזהה פער מאולץ
      (כולל תבנית #28843: attempted בלי success).

**הוכחה תפקודית (באותו שלב):** השלב **הוא** ההוכחה החיה (probe_endpoint / Telegram / MCP).
iterate fix→apply→verify עד ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — תיעוד + קידום + סגירה

**Acceptance:**
- [ ] docs/telegram-chat-bot.md עודכן (טבלה חדשה + 3 שאילתות + יכולת-הראות).
- [ ] fragment changelog סופי + golden אחרון בסנכרון.
- [ ] PR מוזג ל-main (קידום).
- [ ] Teardown ledger מולא; `status: completed`.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד לתיעוד; הקידום = merge; ה-ledger מתעד את מצב מערכת-הטסט.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> שורה חיה — מתעדכנת גם אחרי שהתוכנית `completed`, ברגע שפירוק קורה בפועל.

- (טרם הוקמה מערכת-טסט — יתמלא בשלב 5.)

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 0 הושלם — נעלנו את התכן (אימות מול הקוד), פתחנו קובץ-תוכנית, ומצאנו 2 קיצורי-דרך שמקטינים סיכון.
- שלב 1 הושלם — הוספנו את טבלת-התיעוד שתיוולד בכל מערכת חדשה. השערים ירוקים, לא נגענו בשום דבר חי.
- שלב 2 הושלם — חיווטנו את הכלי המרכזי של הבוט שירשום כל קריאה (ניסיון→תוצאה), והוספנו את 3 השאילתות שהסוכן ימשוך דרכן שיחה+תיעוד. בדיקות מבניות ירוקות.
