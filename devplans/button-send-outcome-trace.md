<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל ע"י /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה (/dev-status).
-->
---
dev_name: אימות אמיתי של שליחת כפתורי-האישור בבוט-הטלגרם
slug: button-send-outcome-trace
opened: 2026-06-11
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — אימות אמיתי של שליחת כפתורי-האישור בבוט-הטלגרם

## מטרה

הבוט-טלגרם של כל מערכת מופקת שולח כפתורי ✅/❌ לאישור פעולות. היום הוא מחזיר לסוכן הודעת-הצלחה
**מקובעת** ("שלחתי כפתורים") גם כשהשליחה נכשלה או לא-ודאית — אז הסוכן "חושב" ששלח בלי שזה קרה.
מחילים על מסלול-השליחה את אותו דפוס "ניסיון→תוצאה אמיתית" (`agent_trace_events`) שכבר עובד
ל-3 כלי-הקריאה, עם ענף-שגיאה נפרד ובדיקת-`message_id` מגנה, כך שהסוכן **תמיד** יודע אם הכפתורים
נשלחו בפועל, וההודעה המוחזרת נגזרת מהתוצאה האמיתית.

## תכן נעול (מאומת מול הקוד — 2026-06-11)

- **reuse, בלי שינוי-סכמה.** ה-`message_id` נכנס ל-`output_summary` (JSONB) של `agent_trace_events`
  הקיימת. אין טבלה חדשה; `db-setup.json` לא נגעים בו; `claim_actual_mismatch` עובד ללא שינוי —
  רשומת `tool_name='request_write_action_send'` עם `status='failed'` נתפסת מיד דרך ענף ה-`had_failure`.
- **נתיב `message_id` עמיד (שיפור על ה-handoff).** ה-handoff נעל על `{{ $json.result.message_id }}`
  וסימן "לאמת אמפירית". מכיוון שמבנה-ההחזרה של צומת-טלגרם ב-n8n אינו ודאי (`result.message_id`
  מול top-level `message_id`), נשתמש בביטוי-coalescing `{{ $json.result?.message_id ?? $json.message_id ?? '' }}`
  בכל מקום שקוראים אותו — הגארד נכון בשני המבנים. שלב ההוכחה-החיה עדיין מאמת איזה נתיב פעל בפועל.
- **בלי `continueRegularOutput` על צומת-השליחה** — היה משחזר את ההצלחה-השקרית. צומת-השליחה:
  `onError:"continueErrorOutput"` + `alwaysOutputData:false` (כדי שלא שני הפורטים יפלטו).
- **גארד-`message_id` חיובי, לא לסמוך על ניתוב-ענף לבד** — n8n ידוע כמנתב כשלים לענף-הצלחה
  בשילובי-גרסאות; רק בדיקת-id חיובית מסמנת 'delivered'.
- **סוג-ב' מחוץ לסקופ** (החלטת Or, 2026-06-11). "הסוכן טוען ששלח בלי לקרוא לכלי" הוא עניין
  שכבת-פרומפט (קבצים אחרים, מנגנון אחר). מתועד כפער-ידוע; לא ממומש כאן.
- **המתקין (`configure-agent-router.yml`) ללא עריכה** — אומת שהוא כבר מזריק
  `@@CRED_POSTGRES_ID@@`/`@@CRED_TELEGRAM_ID@@`/`@@CHAT_ID@@` ל-`request-write-action.json`
  (בלוק ה-sed של `RWA_SRC`). אנו משתמשים מחדש בטוקנים קיימים → אין טוקן חדש → allow-list של
  envsubst ו-`check-golden-sync` לא מושפעים.

**עוגני-קוד שנעולים (מספרי-שורות נכונים ל-2026-06-11):**
- מודל ה-trace: `postgres-named-queries.json` שורות 340–380 (Mint Trace / Write Trace Attempt / Write Trace Result).
- סכמת ה-IF: ה-`Inserted?` בקובץ עצמו (`operator:{type:"string",operation:"notEmpty"}`, `typeValidation:"loose"`).
- מקור ה-`message_id`: `services/mcp-server/src/observability-client.ts` → `sendTelegramKeyboard` (`data.result?.message_id`).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | פתיחת-תוכנית + נעילת-תכן | completed | `devplans/button-send-outcome-trace.md` |
| 1 | ניתוח-JSON: trace+גארד+תשובות נגזרות-תוצאה + הוכחה סטטית | in-progress | `request-write-action.json`, golden, changelog, devplan |
| 2 | הוכחה חיה על מערכת-טסט זמנית **[עולה כסף — בגייט של Or]** | pending | מערכת-טסט (reuse-mode), אימות round-trip |
| 3 | תיעוד + קידום (merge) + סגירה + teardown | pending | `docs/telegram-chat-bot.md`, devplan, changelog |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שעובד *באותו שלב*. שלב 1 = הוכחה סטטית (jq + שערי-זהב +
> CI); שלב 2 = ההוכחה ההתנהגותית החיה (round-trip אמיתי של הצלחה וכשל).

---

### שלב 0 — פתיחת-תוכנית + נעילת-תכן

**Acceptance:**
- [x] `devplans/button-send-outcome-trace.md` נוצר מהתבנית, `status: active`.
- [x] התכן נעול מול הקוד האמיתי (גרף-הצמתים, אי-ודאות נתיב-ה-`message_id`, מבנה ענף-השגיאה).
- [x] החלטת-Or על סוג-ב' (מחוץ לסקופ) מתועדת.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — אין התנהגות רצה. אומת: הקובץ נקרא ע"י שער-ה-devplan
כ-`status: active` (path-scoped), והתבנית ב-`templates/devplan/` פטורה.

**הערת התקדמות אחרונה:** הושלם. התוכנית נפתחה והתכן ננעל; הגרף, ה-SQL והסכמות אומתו מול הקבצים החיים.

**שינוי תוכנית:** —

---

### שלב 1 — ניתוח-JSON + הוכחה סטטית

**Acceptance:**
- [x] `request-write-action.json`: נוספו `Mint Trace` + `Write Trace Attempt` (status='attempted', tool_name='request_write_action_send') בין `Inserted?(true)` ל-`Send Approval Buttons`.
- [x] `Send Approval Buttons`: `onError:"continueErrorOutput"` (ו-`alwaysOutputData` נשאר false).
- [x] צומת `Guard message_id` (IF, notEmpty על ביטוי-coalescing) על פלט-ההצלחה.
- [x] `Write Trace Result OK` (success + `message_id` ב-output_summary) מגארד-true; `Write Trace Result Failed` (failed + השגיאה) מגארד-false וגם מפורט-השגיאה (דרך צומת-עזר `Normalize Failure`).
- [x] `Tool Response` הסטטי הוסר; הוחלף ב-`Tool Response Sent` (status='sent') ו-`Tool Response Failed` (status='send_failed', הודעה כנה) — כל מסלול מסתיים בצומת-תשובה משלו.
- [x] כל צמתי-ה-trace: `onError:continueRegularOutput`+`alwaysOutputData:true`.
- [x] golden רוענן (`scripts/check-system-golden.sh --update`); fragment ב-`changelog.d/`; devplan עודכן.
- [ ] שני שערי-ה-CI ירוקים: "Playground tests" + "Changelog gates" (ממתין ל-PR).

**הוכחה תפקודית (באותו שלב):** הוכחה סטטית — `jq empty` על ה-JSON; טענות-jq: 8 הצמתים החדשים
קיימים, `Send Approval Buttons.onError=="continueErrorOutput"`, אין צומת בשם `"Tool Response"`,
ומפת-החיבורים שווה לגרף-היעד (Inserted?→Mint Trace→Write Trace Attempt→Send; success→Guard,
error→Normalize Failure; Guard-true→OK→Sent; Guard-false→Normalize Failure→Failed→Failed-Response).
שני ה-Code-nodes עברו `node --check`; golden רוענן (שורת MANIFEST אחת). ההוכחה ההתנהגותית
(message_id אמיתי, תפיסת-כשל) — שלב 2.

**הערת התקדמות אחרונה:** קוד הושלם והוכח סטטית (jq + גרף + `node --check` + golden מינימלי).
ממתין לאישור CI על ה-PR לפני סימון completed. בידוד נשמר — רק `request-write-action.json` נגע
(+ golden/changelog/devplan).

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה חיה על מערכת-טסט זמנית **[עולה כסף — בגייט של Or]**

**Acceptance:**
- [ ] Or אישר במפורש את העלות לפני הקמת מערכת-הטסט.
- [ ] מערכת-טסט זמנית הוקמה ב-reuse-mode (`shared_gcp_project=factory-test-25`, 0 מכסת-GCP): provision → register-app → deploy.
- [ ] השינוי הוחל חי (`prove-on-test-system.yml` על ה-branch, או merge→`refresh-system-agents.yml`) ויובא ל-n8n החי.
- [ ] `validate_workflow` (n8n-mcp דרך הגייטוויי) עובר על ה-JSON המיובא.
- [ ] **הצלחה:** round-trip אמיתי → הודעת-טלגרם עם כפתורים → רשומת `status='success'` עם `message_id` ב-`output_summary`; אומת איזה נתיב-JSON פעל.
- [ ] **כשל:** שליחה כושלת מאולצת → רשומת `status='failed'` עם השגיאה; `claim_actual_mismatch`/`tool_trace_recent` חושפים זאת דרך MCP.
- [ ] ההודעה המוחזרת לסוכן נגזרת מהתוצאה (sent / send_failed).

**הוכחה תפקודית (באותו שלב):** זהו ה-fixture החי — בקשת-אישור אמיתית מול הבוט החי, קריאה
ל-`tool_trace_recent`/`claim_actual_mismatch` דרך ה-MCP של המערכת, ואילוץ-כשל. נצפה בעיניים
שהרשומה תואמת את התוצאה ושההודעה המוחזרת כנה.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תיעוד + קידום + סגירה

**Acceptance:**
- [ ] `docs/telegram-chat-bot.md`: תועדה מגבלת רינדור-הלקוח (Telegram #29497 — 200 OK + id תקין אך כפתורים שלא מוצגים; לא ניתן-להוכחה ע"י trace) + פער סוג-ב'.
- [ ] שאלת סוג-ב' (שכבת-פרומפט) הוצגה ל-Or כצעד-המשך (לא מומש).
- [ ] קודם ל-`main` (PR מוזג).
- [ ] devplan נסגר (`status: completed`) + רשומת-teardown.
- [ ] מערכת-הטסט פורקה דרך `decommission-test-system.yml` (user-triggered בלבד).

**הוכחה תפקודית (באותו שלב):** תוכן + קידום — אומת: ה-PR מוזג ל-main ב-CI ירוק; devplan משוחרר
(`status: completed`); רשומת-ה-teardown משקפת את מצב מערכת-הטסט בפועל.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 0 הושלם — פתחתי תוכנית-פיתוח מסודרת ונעלתי בדיוק מה משנים ואיך מאמתים, מול הקוד האמיתי.

---

## מצב מערכת-הטסט (Teardown ledger)

> נרשם בסגירה (שלב 3): `torn-down — <תאריך>` או `left-alive by user decision — <תאריך>`.

- (טרם — מערכת-טסט תוקם בשלב 2 בלבד, באישור Or.)
