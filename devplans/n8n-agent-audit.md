<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: ביקורת אוטומציות n8n + מנגנון הפעלת-סוכנים
slug: n8n-agent-audit
opened: 2026-06-13
status: active
---

# תוכנית פיתוח — ביקורת אוטומציות n8n + מנגנון הפעלת-סוכנים

## מטרה

בדיקת-מצב אמיתית של כל האוטומציות/הסוכנים ב-n8n של המערכת החיה (or-edri-4) — מה התפקיד
של כל אחד והאם הוא **הוכח** כעובד (לא "פעיל"/"ירוק"). הביקורת חשפה 3 סוכנים שמעולם לא רצו;
כדי להוכיח אותם חי בונים מנגנון אוטונומי קבוע (`exercise-agent.yml`) שמזרים הודעה אמיתית
דרך המסלול המאובטח ובודק את התשובה בפועל — וגם יתפוס פערים כאלה לבד בעתיד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | בדיקת-מצב חיה של כל ה-workflows ב-or-edri-4 | completed | (חקירה חיה; MCP) |
| 2 | מנגנון הפעלת-סוכנים אוטונומי | completed | `.github/workflows/exercise-agent.yml` |
| 3 | הוכחת code-agent + infra-agent חי | completed | (הרצות חיות) |
| 4 | הוכחת deep-research חי | completed | (הרצה חיה + טלגרם) |
| 5 | תיקון tg-proactive (SQL) | in-progress | `templates/system/workflows/n8n/tg-proactive.json` |
| 6 | תיקון style-refresh (קלט LLM) | in-progress | `templates/system/workflows/n8n/style-refresh.json` |
| 7 | הפצה ל-or-edri-4 + כלי-הרצה on-demand | completed | (refresh-system-agents; `trigger-system-workflow.yml`) |
| 8 | הרצה חיה של 2 העובדים (הוכחה סופית) | in-progress | (הרצות חיות) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 1 — בדיקת-מצב חיה של כל ה-workflows ב-or-edri-4

**Acceptance:**
- [x] מיפוי כל 25 ה-workflows החיים + מי פעיל
- [x] לכל אחד: תפקיד + ריצת-אמת אחרונה (success/error/מעולם-לא-רץ)
- [x] זיהוי פערים בין "טוענים שעובד" ל"באמת עובד"

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (ביקורת קריאה-בלבד מול ה-MCP + n8n Public API).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. ממצאים: מערכת חיה אחת (or-edri-4, על GCP project
`factory-test-21`). עובד+מוכח: הליבה השיחתית (tg-inbound/router/ops/unknown/research),
הכלים (github/railway-readonly, postgres-named-queries, mcp-server), קלט קול/תמונה,
מסלול אישור-הכתיבה (request-write-action→pending-actions-executor), ותחזוקה
(spend-track/file-catalog-refresh/pending-actions-cleanup). **שבורים (נכשלים יומית
בשקט):** `tg-proactive` (SQL: chat_id כשם-עמודה) ו-`style-refresh` ("Bad request" בקריאת
המודל). **לא רצו מעולם:** `code-agent`, `infra-agent`, `deep-research`. **`DB Vacuum`**:
לא שבור — תזמון שבועי שעוד לא הגיע (המערכת בת יומיים).

**שינוי תוכנית:** —

---

### שלב 2 — מנגנון הפעלת-סוכנים אוטונומי

**Acceptance:**
- [x] `exercise-agent.yml` (workflow_dispatch): WIF→broker→קריאת 3 סודות מ-SM→הרצת
      `scripts/e2e-verify-inbound.sh` עם `PROBE_TEXT` מותאם; ללא proof/commit
- [x] מקבע actions ל-SHA, `permissions:{}` + job `id-token:write`, `if: refs/heads/main`
- [x] yamllint + actionlint נקי; CI ירוק; ממוזג ל-main

**הוכחה תפקודית (באותו שלב):** הרצה חיה של ה-workflow מול or-edri-4 (gcp_project=factory-test-21)
מחזירה ריצה ירוקה + `result.json` עם תשובת-סוכן אמיתית. (ההוכחה החיה בפועל מתבצעת בשלבים 3–4.)

**הוכחת E2E (artifact):** לא-התנהגותי — זהו כלי-תשתית (workflow), לא קובץ-התנהגות n8n
(`workflows/n8n/*.json` / `configure-agent-router.yml`). שער ה-E2E נשאר no-op.

**הערת התקדמות אחרונה:** `exercise-agent.yml` נוסף ומוזג (PR #442). הצנרת אומתה: ל-broker
`roles/owner` על factory-test-21, ותעודת `e2e-proofs/master-system-integrity-b10.json`
מוכיחה ש-`e2e-verify` כבר רץ מול or-edri-4 (PASS). **באג שנתפס בהרצה החיה הראשונה:** ה-checkout
נכשל ב-`Repository not found` כי בלוק ה-`permissions` ברמת ה-job ציין רק `id-token: write`,
ובלוק permissions מאפס את כל השאר ל-`none` — כולל `contents`. תוקן בהוספת `contents: read`
(PR-תיקון). זו בדיוק לולאת ה-live-test: הכלי החדש חשף את הבאג של עצמו בריצה אמיתית.

**שינוי תוכנית:** —

---

### שלב 3 — הוכחת code-agent + infra-agent חי

**Acceptance:**
- [x] הפעלת `exercise-agent.yml` עם הודעת "קוד" → code-agent מחזיר קוד אמיתי
- [x] הפעלת `exercise-agent.yml` עם הודעת "תשתית" → infra-agent מחזיר ייעוץ אמיתי
- [x] אימות-על: ריצה חדשה ב-MCP `inspect_n8n_execution` על ה-workflowId של כל סוכן (success)

**הוכחה תפקודית (באותו שלב):** ריצת ה-workflow ירוקה + תשובה אמיתית; אימות שזה הסוכן הנכון
דרך execution חדש של `tU39yAkUEYHNwB2J` (code) / `SyPAgO5Sm0C9FisJ` (infra).

**הוכחת E2E (artifact):** לא-התנהגותי (לא משנים קבצי-התנהגות; רק מפעילים סוכנים קיימים).

**הערת התקדמות אחרונה:** הושלם והוכח חי. code-agent: exec 379 (success) — החזיר קוד פייתון תקין.
infra-agent: exec 382 (success) — החזיר ייעוץ DNS אמיתי. שניהם היו "0 ריצות" וכעת יש להם
execution חדש ומוצלח דרך ה-exerciser.

**שינוי תוכנית:** —

---

### שלב 4 — הוכחת deep-research חי

**Acceptance:**
- [x] הפעלת `exercise-agent.yml` עם "תחקור לעומק ..." → ack מיידי חוזר
- [x] ריצת הרקע של deep-research (`dXS6r6cjPkMQk4tD`) מסתיימת ב-success (poll ב-MCP)
- [x] Or מקבל את דוח המחקר בטלגרם

**הוכחה תפקודית (באותו שלב):** ה-ack חוזר סינכרונית; ה-execution ברקע מסתיים success;
הדוח נשלח לטלגרם (תלות Tavily אומתה קיימת ב-SM).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם והוכח חי. exec 385 (success, ~2:19 דק') — ה-ack חזר מיד,
מחקר-הרקע רץ והצומת האחרון "Send Report" הצליח; **Or אישר שקיבל את הדוח בטלגרם ב-4 חלקים.**

**שינוי תוכנית:** —

---

### שלב 5 — תיקון tg-proactive (SQL)

**Acceptance:**
- [x] `tg-proactive.json` — הסרת `JSON.stringify` מתת-שאילתת `total_messages` (גרשיים כפולים → שם-עמודה)
- [ ] הרצה חיה on-demand מסתיימת success (אין יותר `column "..." does not exist`)

**הוכחה תפקודית (באותו שלב):** הרצת tg-proactive (`nyx1Nom0cu38W8Il`) על or-edri-4 לאחר ההפצה →
status success; הבוט שולח סיכום-יום.

**הוכחת E2E (artifact):** התנהגותי — `e2e-proofs/fix-broken-workers.json` (השינוי בקבצי n8n מפעיל את שער ה-E2E).

**הערת התקדמות אחרונה:** התיקון הוחל בתבנית (`'tg:' || {{ '@@CHAT_ID@@' }}`, זהה לדפוס המוכח).
golden רוענן. ממתין להפצה + הרצה חיה (שלב 7).

**שינוי תוכנית:** —

---

### שלב 6 — תיקון style-refresh (קלט LLM)

**Acceptance:**
- [x] שמירה מפני קלט ריק ל-"Extract Style" + `onError: continueRegularOutput` (רשת-ביטחון)
- [ ] הרצה חיה on-demand מסתיימת success (אין יותר `Bad request`) ונכתב פרופיל

**הוכחה תפקודית (באותו שלב):** הרצת style-refresh (`ZGt6kDKpNHRsrh2c`) על or-edri-4 לאחר ההפצה →
status success; `style_profile` מתעדכן.

**הוכחת E2E (artifact):** התנהגותי — מכוסה ע"י אותה `e2e-proofs/fix-broken-workers.json`.

**הערת התקדמות אחרונה:** התיקון הוחל בתבנית (guard ל-text + onError). golden רוענן. הסיבה
המדויקת (transcript ריק?) תאומת בהרצה החיה — ה-guard מבטיח prompt לא-ריק, וה-onError מבטיח
אי-קריסה גם אם נשארה סיבה שולית.

**שינוי תוכנית:** —

---

### שלב 7 — הפצה ל-or-edri-4 + הוכחה חיה

**Acceptance:**
- [ ] e2e-proof נוצר (`e2e-verify.yml`) ו-CI ירוק → מיזוג ל-main
- [ ] `refresh-system-agents.yml` הפיץ את התבניות המתוקנות ל-or-edri-4 (ייבוא-מחדש + הפעלה)
- [ ] שתי ההרצות החיות (tg-proactive + style-refresh) → success דרך MCP `inspect_n8n_execution`

**הוכחה תפקודית (באותו שלב):** הרצה on-demand של 2 העובדים על or-edri-4 החיה → success.

**הוכחת E2E (artifact):** `e2e-proofs/fix-broken-workers.json` (inbound לא נפגע — אי-רגרסיה + חותמת hash).

**הערת התקדמות אחרונה:** ה-fix מוזג (PR #446) והופץ ל-or-edri-4 (`refresh-system-agents` →
`configure-agent-router` הצליחו — התבניות המתוקנות יובאו ל-n8n החי). להוכחה חיה של עובדי-הרקע
(מתוזמנים — אי-אפשר להריץ דרך ה-Public API) נבנה כלי-הרצה חדש
`.github/workflows/trigger-system-workflow.yml` (login פנימי → Execute-Workflow → קריאת status
מה-Public API). נותרה ההרצה בפועל של 2 העובדים + אימות success (שלב 8).

**שינוי תוכנית:** ההוכחה החיה דרשה כלי-הרצה ייעודי (ה-Public API לא מריץ workflows) — נבנה כשלב-משנה.

---

### שלב 8 — הרצה חיה של 2 העובדים (הוכחה סופית)

**Acceptance:**
- [ ] `trigger-system-workflow.yml` הורץ ל-tg-proactive (`nyx1Nom0cu38W8Il`) → execution success
- [ ] `trigger-system-workflow.yml` הורץ ל-style-refresh (`ZGt6kDKpNHRsrh2c`) → execution success
- [ ] אימות דרך MCP `inspect_n8n_execution` (לא רק לוג הכלי); אין יותר `column ...`/`Bad request`

**הוכחה תפקודית (באותו שלב):** שתי הריצות החדשות על or-edri-4 → status success; Or מקבל "🟢 סיכום-יום".

**הוכחת E2E (artifact):** לא-התנהגותי (כלי-הרצה; לא קובץ-התנהגות n8n).

**הערת התקדמות אחרונה:** הכלי עודכן (triggerToStartFrom) ומוזג. **הרצה חיה:** tg-proactive →
**exec 400 success** (תוקן, הבוט שלח סיכום-יום). style-refresh עבר את Extract Style (ה-fix עבד!)
אך נחשף **באג שני** ב-"Upsert Style Profile" — `JSON.stringify(JSON.stringify(...))::jsonb`
(גרשיים כפולים → syntax error). **ממצא נוסף:** ל-`file-catalog-refresh` "Upsert Catalog" אותו
באג, מוסתר ע"י `onError` (רץ ירוק אבל לא כתב קטלוג). שניהם תוקנו (מחרוזת SQL single-quote מוברחת)
+ e2e-proof. ממתין למיזוג + הרצה חוזרת של style-refresh (אימות גלוי) + file-catalog.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — בדקנו חי את כל האוטומציות. הליבה (השיחה איתך) עובדת ומוכחת; מצאנו 2 עובדי-רקע
  שבורים בשקט (יוזמה + התאמת-סגנון), ו-3 סוכנים שמעולם לא רצו שצריך להוכיח. DB Vacuum תקין, רק לא הגיע תורו.
- שלב 2 הושלם — בנינו כלי קבוע ש"מפעיל" כל סוכן עם הודעה אמיתית דרך המסלול המאובטח. הוא אפילו תפס באג של עצמו בריצה הראשונה ותוקן.
- שלב 3 הושלם — code-agent ו-infra-agent הוכחו חי: כל אחד קיבל הודעה אמיתית והחזיר תשובה אמיתית (קוד / ייעוץ DNS).
- שלב 4 הושלם — deep-research הוכח חי: רץ מחקר אמיתי כ-2 דקות ושלח לך דוח בטלגרם ב-4 חלקים (אישרת שקיבלת).
