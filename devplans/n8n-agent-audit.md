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
| 2 | מנגנון הפעלת-סוכנים אוטונומי | in-progress | `.github/workflows/exercise-agent.yml` |
| 3 | הוכחת code-agent + infra-agent חי | pending | (הרצות חיות) |
| 4 | הוכחת deep-research חי | pending | (הרצה חיה + טלגרם) |

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
- [ ] `exercise-agent.yml` (workflow_dispatch): WIF→broker→קריאת 3 סודות מ-SM→הרצת
      `scripts/e2e-verify-inbound.sh` עם `PROBE_TEXT` מותאם; ללא proof/commit
- [ ] מקבע actions ל-SHA, `permissions:{}` + job `id-token:write`, `if: refs/heads/main`
- [ ] yamllint + actionlint נקי; CI ירוק; ממוזג ל-main

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
- [ ] הפעלת `exercise-agent.yml` עם הודעת "קוד" → code-agent מחזיר קוד אמיתי
- [ ] הפעלת `exercise-agent.yml` עם הודעת "תשתית" → infra-agent מחזיר ייעוץ אמיתי
- [ ] אימות-על: ריצה חדשה ב-MCP `inspect_n8n_execution` על ה-workflowId של כל סוכן (success)

**הוכחה תפקודית (באותו שלב):** ריצת ה-workflow ירוקה + תשובה אמיתית; אימות שזה הסוכן הנכון
דרך execution חדש של `tU39yAkUEYHNwB2J` (code) / `SyPAgO5Sm0C9FisJ` (infra).

**הוכחת E2E (artifact):** לא-התנהגותי (לא משנים קבצי-התנהגות; רק מפעילים סוכנים קיימים).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — הוכחת deep-research חי

**Acceptance:**
- [ ] הפעלת `exercise-agent.yml` עם "תחקור לעומק ..." → ack מיידי חוזר
- [ ] ריצת הרקע של deep-research (`dXS6r6cjPkMQk4tD`) מסתיימת ב-success (poll ב-MCP)
- [ ] Or מקבל את דוח המחקר בטלגרם

**הוכחה תפקודית (באותו שלב):** ה-ack חוזר סינכרונית; ה-execution ברקע מסתיים success;
הדוח נשלח לטלגרם (תלות Tavily אומתה קיימת ב-SM).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — בדקנו חי את כל האוטומציות. הליבה (השיחה איתך) עובדת ומוכחת; מצאנו 2 עובדי-רקע
  שבורים בשקט (יוזמה + התאמת-סגנון), ו-3 סוכנים שמעולם לא רצו שצריך להוכיח. DB Vacuum תקין, רק לא הגיע תורו.
