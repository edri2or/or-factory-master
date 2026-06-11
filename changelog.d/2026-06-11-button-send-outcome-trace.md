## אימות אמיתי של שליחת כפתורי-האישור בבוט-הטלגרם (button-send-outcome-trace)

סוגר פער שבו בוט-הטלגרם של מערכת מופקת החזיר הודעת-הצלחה מקובעת ("שלחתי כפתורים") גם כשהשליחה
נכשלה או לא-ודאית. מחיל על מסלול שליחת-הכפתורים ב-`request-write-action.json` את דפוס
ה-attempt→outcome הקיים (`agent_trace_events`), עם ענף-שגיאה נפרד ובדיקת-`message_id` מגנה —
כך שהסוכן תמיד יודע אם הכפתורים נשלחו בפועל, וההודעה המוחזרת נגזרת מהתוצאה.

### שלב 1 — ניתוח-JSON: trace + גארד + תשובות נגזרות-תוצאה

- **תיעוד ניסיון לפני השליחה** ב-`templates/system/workflows/n8n/request-write-action.json`:
  צמתים חדשים `Mint Trace` (Code — מטביע `tool_call_id` ו-`input_summary_sql` SQL-בטוח עם `esc()`,
  אותו ניב כמו `postgres-named-queries`) ו-`Write Trace Attempt` (Postgres INSERT ל-`agent_trace_events`:
  `status='attempted'`, `tool_name='request_write_action_send'`, `session_id='tg:'||@@CHAT_ID@@`,
  עוגן `turn_id` = `max(id)` מ-`n8n_chat_histories`), בין `Inserted?(true)` ל-`Send Approval Buttons`.
- **צומת השליחה** `Send Approval Buttons`: נוסף `onError:"continueErrorOutput"` (`alwaysOutputData`
  נשאר false) — כשל שליחה מנותב לפורט-שגיאה במקום לשחזר "הצלחה שקרית".
- **גארד-`message_id`** (`Guard message_id`, IF `notEmpty`) על פלט-ההצלחה, עם ביטוי-coalescing
  `{{ $json.result?.message_id ?? $json.message_id ?? '' }}` — מסמן 'delivered' רק עם הוכחה חיובית,
  ולא סומך על ניתוב-הענף לבד (n8n עלול לנתב כשל לענף-הצלחה).
- **תיעוד תוצאה:** `Write Trace Result OK` (UPDATE `status='success'`, `output_summary=jsonb_build_object('ok',true,'message_id',…)`)
  מגארד-true; `Write Trace Result Failed` (UPDATE `status='failed'` + השגיאה) מהענף-הכושל. צומת-עזר
  `Normalize Failure` (Code) מאחד את סיבת-הכשל מ-שני המקורות (פורט-שגיאה של השליחה + גארד-false)
  ו-`esc()` אותה SQL-בטוח. כל צמתי-ה-trace: `onError:continueRegularOutput` + `alwaysOutputData:true`.
- **תשובת-כלי נגזרת-תוצאה:** הוסר `Tool Response` הסטטי; הוחלף ב-`Tool Response Sent`
  (`status:'sent'`, ההודעה כוללת את ה-`message_id` האמיתי) בקצה-delivered, וב-`Tool Response Failed`
  (`status:'send_failed'`, הודעת-כשל כנה) בקצה-הכושל. כל מסלול מסתיים בצומת-תשובה משלו.
- **בלי שינוי-סכמה:** ה-`message_id` נכנס ל-`output_summary` (JSONB) הקיים — אין טבלה חדשה,
  `db-setup.json` לא נגעים בו, `claim_actual_mismatch`/`tool_trace_recent` עובדים ללא שינוי.
- **בלי שינוי-מתקין:** `configure-agent-router.yml` כבר מזריק `@@CRED_POSTGRES_ID@@`/`@@CHAT_ID@@`
  ל-request-write-action (אומת) — שימוש-חוזר בטוקנים קיימים, אין טוקן חדש, allow-list לא מושפע.
- golden רוענן (`scripts/check-system-golden.sh --update` — שורת ה-MANIFEST של request-write-action בלבד);
  `jq` תקין; שני ה-Code-nodes החדשים עברו `node --check`; שערי "Playground tests" + "Changelog gates" ירוקים.
- **מחוץ לסקופ (החלטת Or):** "כשל סוג-ב'" (הסוכן טוען ששלח בלי לקרוא לכלי) — שכבת-פרומפט נפרדת,
  לא ממומש כאן; מתועד כפער-ידוע ב-`docs/telegram-chat-bot.md` (שלב 3).

### שלב 2 — הוכחה חיה (Day-0) על מערכת-טסט זמנית

- הוקמה מערכת-טסט זמנית `factory-test-398` ב-reuse-mode (`shared_gcp_project=factory-test-25`, **0 מכסת-GCP**):
  `provision-system.yml` → `register-system-app.yml` (2 הקלקות אופרטור) → `deploy-railway-cloudflare.yml` (n8n 2.25.7 + Postgres).
- השינוי הוחל דרך `prove-on-test-system.yml` (off-branch, זהות-sandbox): עבר את ה-CI **של מערכת-הטסט עצמה**
  (changelog/pipeline/secret/supply-chain) ומוזג דרך ה-PR המוגן; `configure-agent-router.yml` ייבא ופרסם את
  `request-write-action.json` המעודכן ל-n8n החי (`PASS … request-write-action → id=…`).
- **הוכחת Day-0:** n8n 2.25.7 אמיתי קלט את הגרף החדש (ענף-שגיאה, Guard, Code-nodes עם `?.`/`??`, צמתי-trace) — מה ש-jq סטטי לא יכול.
- מגבלה (מתועדת בכנות ב-devplan): round-trip התנהגותי מלא (לחיצה→trace) לא בוצע אוטונומית — אין כלי הרצת/שאילתת-n8n בסשן +
  בוט-הטסט חולק טוקן-טלגרם. הסיכון השיורי מוקטן: גארד-coalescing דו-מצבי, SQL זהה לדפוס שהוכח חי ב-#382, וניטור-עצמי (`claim_actual_mismatch`).

### שלב 3 — תיעוד + קידום + פירוק

- `docs/telegram-chat-bot.md` (§6): שורה חדשה ל-`button-send-outcome-trace` — תיאור השינוי + **מגבלת רינדור-לקוח
  (Telegram desktop #29497)** (200 OK + `message_id` תקין ≠ כפתורים שרונדרו; לא ניתן-להוכחה ע"י trace) + **פער סוג-ב'** (מחוץ-לסקופ).
- מערכת-הטסט `factory-test-398` פורקה דרך `decommission-test-system.yml` (Railway + Cloudflare DNS + ארכוב ריפו) בסגירה.
