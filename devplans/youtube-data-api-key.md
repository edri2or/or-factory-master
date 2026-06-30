<!--
DEVPLAN — youtube-data-api-key
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: מפתח YouTube Data API v3 למערכת or-aios
slug: youtube-data-api-key
opened: 2026-06-30
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — מפתח YouTube Data API v3 למערכת or-aios

## מטרה

ל-or-aios חסר מפתח תקף ל-YouTube Data API v3 (ה-`google-api-key` הקיים נדחה — 400
"API key not valid"). הפיתוח מספק workflow אוטומטי בפקטורי שיוצר מפתח Google מוגבל
ל-YouTube Data API v3 בלבד, **בלי הגבלת-referrer** (שימוש server-side), שומר אותו ב-SM
של `factory-test-8` בשם `youtube-data-api-key`, ונותן secretAccessor ל-deploy-sa +
runtime-sa. זו בקשת provision — אין יכולת n8n חדשה, רק plumbing של סוד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | בניית workflow ה-provision + שערי CI | completed | `.github/workflows/provision-youtube-data-api-key.yml`, `monitoring/registry-exempt.txt`, `changelog.d/`, `devplans/` |
| 2 | מיזוג ל-main + הרצה חיה + אימות הסוד וההרשאות | pending | (הרצת workflow) |
| 3 | סגירה: עדכון or-aios (מצב הבקשה) + נעילת התוכנית | pending | (or-aios repo) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — בניית workflow ה-provision + שערי CI

**Acceptance:**
- [x] workflow חדש, broker SA via WIF, `if: refs/heads/main`, על דגם mirror/grant הקיימים.
- [x] יוצר/ממחזר מפתח מוגבל ל-`youtube.googleapis.com` בלבד, application-restriction = None.
- [x] ערך המפתח עובר בצינור ישירות ל-SM — לעולם לא ב-log/משתנה. grant ל-deploy+runtime-sa.
- [x] שערי CI: registry-exempt + changelog fragment + devplan.

**הוכחה תפקודית (באותו שלב):** תוכן + הגדרות בלבד; ההוכחה התפקודית האמיתית היא הרצת
ה-workflow חי (שלב 2) — אי-אפשר להריץ מענף כי ה-WIF CEL נעול ל-main.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע בקבצי-התנהגות של בוט).

**הערת התקדמות אחרונה:** הקבצים נכתבו; PR בדרך.

**שינוי תוכנית:** —

---

### שלב 2 — מיזוג ל-main + הרצה חיה + אימות

**Acceptance:**
- [ ] ה-PR ירוק וממוזג ל-main.
- [ ] הרצת `provision-youtube-data-api-key.yml` על main מסתיימת ב-success.
- [ ] אימות: הסוד `youtube-data-api-key` קיים ב-factory-test-8 עם גרסה enabled, המפתח מוגבל
      ל-YouTube Data API v3, ול-deploy-sa + runtime-sa יש secretAccessor.

**הוכחה תפקודית (באותו שלב):** שלב ה-Verify של ה-workflow מדפיס את ההגבלה + מספר הגרסאות
+ הבדיקות של ה-IAM, בלי לחשוף ערך. מאשרים success ב-get_workflow_run.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — סגירה: עדכון or-aios + נעילת התוכנית

**Acceptance:**
- [ ] or-aios: מצב הבקשה ב-`docs/agent-specs/youtube-search-key-request.md` מסומן כבוצע.
- [ ] התוכנית הזו עוברת ל-`status: completed` עם התוצאה המאומתת מתועדת.

**הוכחה תפקודית (באותו שלב):** הרצת ה-probe ב-or-aios (`youtube-search-capability-probe.yml`,
channel=@GoogleDevelopers) חוזרת go — הוכחה שהמפתח עובד מקצה לקצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — בניתי "מכונה" אוטומטית בפקטורי שיוצרת את המפתח, שומרת אותו בכספת ונותנת
  הרשאות — בלי שום קליק ידני שלך.
