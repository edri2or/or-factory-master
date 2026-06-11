<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל ע"י /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה (/dev-status).
-->
---
dev_name: אימות אמיתי של שליחת כפתורי-האישור בבוט-הטלגרם
slug: button-send-outcome-trace
opened: 2026-06-11
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)

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
| 1 | ניתוח-JSON: trace+גארד+תשובות נגזרות-תוצאה + הוכחה סטטית | completed | `request-write-action.json`, golden, changelog, devplan |
| 2 | הוכחה חיה על מערכת-טסט זמנית **[עולה כסף — בגייט של Or]** | completed (Day-0) | factory-test-398 (reuse-mode); ייבוא חי נקי |
| 3 | תיעוד + קידום (merge) + סגירה + teardown | completed | `docs/telegram-chat-bot.md`, devplan, changelog |

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
- [x] שני שערי-ה-CI ירוקים: "Playground tests" + "Changelog gates" (PR #398 — כל 5 הבדיקות ירוקות).

**הוכחה תפקודית (באותו שלב):** הוכחה סטטית — `jq empty` על ה-JSON; טענות-jq: 8 הצמתים החדשים
קיימים, `Send Approval Buttons.onError=="continueErrorOutput"`, אין צומת בשם `"Tool Response"`,
ומפת-החיבורים שווה לגרף-היעד (Inserted?→Mint Trace→Write Trace Attempt→Send; success→Guard,
error→Normalize Failure; Guard-true→OK→Sent; Guard-false→Normalize Failure→Failed→Failed-Response).
שני ה-Code-nodes עברו `node --check`; golden רוענן (שורת MANIFEST אחת). ההוכחה ההתנהגותית
(message_id אמיתי, תפיסת-כשל) — שלב 2.

**הערת התקדמות אחרונה:** הושלם. קוד הוכח סטטית (jq + גרף 16-קשתות + `node --check` + golden מינימלי)
וכל 5 בדיקות ה-CI על PR #398 ירוקות. בידוד נשמר — רק `request-write-action.json` נגע
(+ golden/changelog/devplan). ההוכחה ההתנהגותית החיה היא שלב 2 (בגייט של Or — עולה כסף).

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה חיה על מערכת-טסט זמנית **[עולה כסף — בגייט של Or]**

**Acceptance:**
- [x] Or אישר במפורש את העלות לפני הקמת מערכת-הטסט.
- [x] מערכת-טסט זמנית הוקמה ב-reuse-mode (`shared_gcp_project=factory-test-25`, 0 מכסת-GCP): provision (run 27343273096) → register-app (Or עשה 2 הקלקות, run 27343959085) → deploy (run 27344119161).
- [x] השינוי הוחל חי דרך `prove-on-test-system.yml` על ה-branch (run 27344547949): עבר את ה-CI **של מערכת-הטסט עצמה** (changelog/pipeline/secret/supply-chain) ומוזג דרך ה-PR המוגן.
- [x] **הוכחת Day-0 (חיה):** `configure-agent-router` (run 27344598141) ייבא ופרסם את `request-write-action.json` המעודכן ל-n8n 2.25.7 החי — `PASS … request-write-action → id=mnsoJNyRXFzcfz7y`; `list_n8n_workflows` מאשר נוכחות + מצב נכון (sub-workflow, לא-פעיל by design). הגרף החדש (צומת-טלגרם עם continueErrorOutput, Guard message_id, Code-nodes עם ?./??, צמתי-trace מתכנסים) **התקבל ע"י n8n אמיתי** — מה ש-jq סטטי לא יכול להוכיח. ה-request_write_action נשאר מחווט בסוכנים (creds קיימים, לא הוסר).
- [~] **round-trip התנהגותי (הצלחה+כשל+claim_actual_mismatch) — לא הושג אוטונומית.** אין בסשן כלי הרצת/שאילתת-n8n; בוט-הטסט חולק את טוקן-הטלגרם של הפקטורי (אי-אפשר לטרגר דרך טלגרם בלי להפריע); ובנוסף ה-Classifier Model של ה-router במערכת-הטסט עצמו שוגה (OpenRouter, לא-קשור לשינוי) — כך שגם טריגר לא היה מגיע ל-request_write_action. ראה "שינוי תוכנית".

**הוכחה תפקודית (באותו שלב):** הושגה הוכחת **Day-0 חיה** — השינוי המדויק עבר את ה-CI של מערכת-הטסט, מוזג, ויובא+פורסם בהצלחה ל-n8n 2.25.7 חי (id=mnsoJNyRXFzcfz7y). ההוכחה ההתנהגותית המלאה (send→trace round-trip) לא ניתנת-להשגה אוטונומית מהסשן (ראה למטה); הסיכון השיורי מוקטן בתכן: גארד-ה-message_id מכסה את שני מבני-ההחזרה, ה-SQL זהה לדפוס שכבר הוכח חי ב-#382, והפיצ'ר מנטר את עצמו (claim_actual_mismatch).

**הערת התקדמות אחרונה:** הושלם ברמת Day-0. מערכת-טסט factory-test-398 הוקמה (reuse, 0 מכסת-GCP), השינוי הוחל דרך prove-on-test-system, ויובא נקי ל-n8n חי. round-trip התנהגותי לא בוצע — מגבלת-כלים, לא ממצא קוד.

**שינוי תוכנית:** ה-handoff/התוכנית הניחו round-trip התנהגותי חי (Stage 5 של #382). בפועל הסשן הנוכחי **חסר כלי הרצת/שאילתת-n8n**, בוט-הטסט חולק את טוקן-הטלגרם של הפקטורי, וה-router LLM של הטסט שגה (לא-קשור) — כך ש-trigger+קריאת-trace אינם בני-ביצוע אוטונומי. במקום זאת הושגה הוכחת Day-0 חיה (ייבוא+פרסום נקי ל-n8n אמיתי + מעבר ה-CI של המערכת). יחד עם ההוכחה הסטטית, גארד-coalescing דו-מצבי, דפוס-trace שכבר הוכח חי ב-#382, וניטור-עצמי (claim_actual_mismatch) — רמת-הביטחון גבוהה. הוצג ל-Or להחלטה.

---

### שלב 3 — תיעוד + קידום + סגירה

**Acceptance:**
- [x] `docs/telegram-chat-bot.md`: תועדה מגבלת רינדור-הלקוח (Telegram #29497 — 200 OK + id תקין אך כפתורים שלא מוצגים; לא ניתן-להוכחה ע"י trace) + פער סוג-ב' (שורה חדשה ב-§6).
- [x] שאלת סוג-ב' (שכבת-פרומפט) הוצגה ל-Or; הוחלט **מחוץ-לסקופ**, מתועד כפער-ידוע (לא מומש).
- [x] קידום ל-`main` — PR #398 מוזג (squash `0c66c99`), main ירוק לגמרי בכל השערים.
- [x] מערכת-הטסט פורקה דרך `decommission-test-system.yml` (user-triggered — Or בחר "סגור: תעד → מזג → פרק").
- [x] סגירה פורמלית (`status: completed`) — בפולואפ docs-only על אותו branch (ראה שינוי תוכנית).

**הוכחה תפקודית (באותו שלב):** תוכן + קידום — התיעוד נוסף; factory-test-398 פורק; PR #398 מוזג ל-main
(squash `0c66c99`) ו-main ירוק בכל השערים (Changelog/Secret/Pipeline/Supply/Playground). הסגירה הפורמלית
ב-PR-המשך docs-only שעבר את שער-ה-devplan כ-no-op (אין קוד ב-diff).

**הערת התקדמות אחרונה:** הושלם וסגור. הקוד חי ב-main (כל מערכת חדשה תקבל אותו), מערכת-הטסט פורקה, התיעוד נוסף.

**שינוי תוכנית:** שער-ה-devplan (`check-devplan-updated.sh`) דורש שכל PR עם שינוי-קוד יעדכן **תוכנית
פעילה כלשהי**; הוא לא זוקף תוכנית ש**נסגרת** באותו diff. מכיוון ש-`google-wallet-unify` פעיל במקביל
ולא נגעתי בו, סימון `status: completed` ל-button-send באותו PR עם הקוד הפיל את השער (PR #398, SHA 9233153).
התיקון: ה-devplan נשאר `active` במיזוג #398 (כתוכנית-פעילה-שעודכנה → השער עובר), והסגירה הפורמלית
(`status: completed` + השלמת שלב 3) נעשית ב-PR-המשך docs-only על אותו branch — diff בלי קוד → השער no-op.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 0 הושלם — פתחתי תוכנית-פיתוח מסודרת ונעלתי בדיוק מה משנים ואיך מאמתים, מול הקוד האמיתי.
- שלב 1 הושלם — שיניתי את הבוט כך שיתעד אם כפתורי-האישור באמת נשלחו (במקום להגיד "שלחתי" בלי לבדוק). הכול עבר את כל הבדיקות האוטומטיות (PR #398). עוד לא הוכחתי על בוט חי — זה השלב הבא, ורק באישורך.
- שלב 2 הושלם ברמת Day-0 — הקמתי מערכת-טסט אמיתית (factory-test-398), והשינוי שלי נכנס לבוט חי ועבר בהצלחה את כל הבדיקות שלו וגם את הקליטה לתוך n8n החי. ההוכחה ה"מלאה" (ללחוץ כפתור אמיתי ולראות את הרישום) לא ניתנת לי לבצע לבד מכאן — אבל הקוד זהה למנגנון שכבר הוכח חי בעבר, והפיצ'ר מנטר את עצמו. פירוט והחלטה — בהודעה.
- שלב 3 הושלם — תיעדתי את המגבלות, מיזגתי ל-main (#398), ופירקתי את מערכת-הטסט. הפיתוח **סגור**: מעכשיו כל מערכת חדשה תיוולד עם בוט שיודע באמת אם כפתורי-האישור נשלחו, ואם לא — הוא אומר את האמת.

---

## מצב מערכת-הטסט (Teardown ledger)

> נרשם בסגירה (שלב 3): `torn-down — <תאריך>` או `left-alive by user decision — <תאריך>`.

- `torn-down — 2026-06-11` — factory-test-398 (reuse-mode על factory-test-25). פורק ע"י
  `decommission-test-system.yml` (Railway + Cloudflare DNS + ארכוב הריפו) בסגירת הפיתוח,
  באישור Or ("סגור: תעד → מזג → פרק"). GCP/SM של factory-test-25 לא נגעו.
