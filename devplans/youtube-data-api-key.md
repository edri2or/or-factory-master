<!--
DEVPLAN — youtube-data-api-key
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: מפתח YouTube Data API v3 למערכת or-aios
slug: youtube-data-api-key
opened: 2026-06-30
status: completed   # GO מאומת: smoke-test חי החזיר HTTP 200 (run 28420141323)
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
| 2 | מיזוג ל-main + הרצה חיה + אימות הסוד וההרשאות | completed | (הרצת workflow) |
| 3 | סגירה: נעילת התוכנית + מסירה ל-youtube-search dev | completed | (devplan) |

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
- [x] ה-PR ירוק וממוזג ל-main (#558 + תיקון #559).
- [x] הרצת `provision-youtube-data-api-key.yml` על main מסתיימת ב-success (run 28418465097).
- [x] אימות: הסוד `youtube-data-api-key` קיים ב-factory-test-8 עם גרסה enabled, המפתח מוגבל
      ל-YouTube Data API v3, ול-deploy-sa + runtime-sa יש secretAccessor.

**הוכחה תפקודית (באותו שלב):** ✅ run 28418465097 = success. שלב ה-Verify (האחרון) מכשיל ב-`exit 1`
אם חסרה גרסת-סוד enabled או binding ל-SA — לכן ריצה ירוקה היא ההוכחה: הסוד קיים עם גרסה enabled,
המפתח מוגבל ל-YouTube Data API v3 (בלי הגבלת-application), ול-deploy-sa + runtime-sa יש secretAccessor.
בלי לחשוף ערך.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ההרצה הראשונה (run 28418140768) נכשלה ב-`api-keys create` עם
`SERVICE_DISABLED` — לא באג הרשאות אלא **פרויקט-מכסה**: gcloud חייב את קריאת ה-API
לפרויקט-הבית של ה-broker (or-factory-master-control / 140345952904) במקום ל-factory-test-8,
שם ה-API Keys API לא מופעל. תיקון: `--billing-project=factory-test-8` על כל קריאות
`api-keys.*` (list/create/get-key-string/describe), כך שהמכסה והמפתח שניהם ב-factory-test-8.
PR חדש (ה-PR הראשון כבר מוזג).

**שינוי תוכנית:** נוסף `--billing-project` — תיקון פרויקט-המכסה. אין שינוי באבטחה: עדיין
לא נוגעים בפרויקט הבקרה; המכסה והמפתח ב-factory-test-8 בלבד.

---

### שלב 3 — סגירה: נעילת התוכנית + מסירה ל-youtube-search dev

**Acceptance:**
- [x] התוכנית הזו עוברת ל-`status: completed` עם התוצאה המאומתת מתועדת.
- [x] המסירה ל-youtube-search dev: המפתח בכספת — הריצה-מחדש של ה-probe + סימון קובץ-הבקשה
      שייכים לפיתוח `youtube-search-api` (ענף `claude/youtube-search-api-8nudqb`), לא לפיתוח הזה.

**הוכחה תפקודית (באותו שלב):** תיעוד-סגירה בלבד. ההוכחה מקצה-לקצה (probe → go) היא הצעד הראשון
של פיתוח ה-youtube-search, שעכשיו חסום-לשעבר משוחרר כי המפתח בכספת.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ נסגר. הגבול: פיתוח זה סיפק את המפתח (לבנת-תשתית). ה-probe וקובץ-הבקשה
נשארים בידי פיתוח ה-youtube-search — לא נגעתי בענף שלהם כדי לא להתנגש.

**שינוי תוכנית:** הוסר "עדכון קובץ-הבקשה ב-or-aios" מתנאי-הקבלה — הקובץ חי בענף של פיתוח אחר;
עריכתו משם הייתה חוצה גבול-פיתוח. במקום זה: מסירה מפורשת בדוח ל-Or.

---

### שלב 4 — הוכחת המפתח חי (smoke-test עצמאי)

**רקע:** ההרצות של ה-probe ב-or-aios main חזרו "API key not valid" — אבל מהלוג התברר שה-probe
על **main** קורא את הסוד הישן `google-api-key` (לא `youtube-data-api-key`). ה-probe המעודכן שקורא
את הסוד החדש קיים רק בענף `claude/youtube-search-api-8nudqb` (פיתוח אחר, לא מוזג). כלומר ה-probe
מעולם לא בדק את המפתח החדש — בדק את הישן (שהוא בדיוק הלא-תקין).

**Acceptance:**
- [x] נוסף שלב smoke-test ל-`provision-youtube-data-api-key.yml`: קורא את `youtube-data-api-key`
      (ממוסך), קורא live ל-`i18nLanguages` של YouTube Data API v3 בכותרת `X-goog-api-key`, מאשר 200.
- [x] הרצה מחדש של ה-provision (idempotent — ממחזר את המפתח) חוזרת GO (HTTP 200) — run 28420141323 success.

**הוכחה תפקודית (באותו שלב):** שלב ה-smoke-test מכשיל ב-`exit 1` אם הקריאה ל-YouTube לא 200 →
ריצה ירוקה = המפתח תקף, ה-API מופעל, וההגבלה מאפשרת את הקריאה. הערך לעולם לא מודפס (header + mask).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ GO. run 28420141323 הסתיים success — שלב ה-smoke-test (שמכשיל ב-`exit 1`
אם לא 200) עבר, כלומר YouTube Data API v3 קיבל את המפתח החדש חי. הוכחה מקצה-לקצה הושלמה. הפיתוח נסגר.

**שינוי תוכנית:** ה-probe ב-or-aios לא היה כלי אימות תקף למפתח (קרא סוד ישן). הוכחת ה-GO עוברת
ל-smoke-test עצמאי בתוך workflow ה-provision — בשליטתי, בלי לגעת בענף של פיתוח אחר.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — בניתי "מכונה" אוטומטית בפקטורי שיוצרת את המפתח, שומרת אותו בכספת ונותנת
  הרשאות — בלי שום קליק ידני שלך.
- שלב 2 הושלם — המכונה רצה ✅. המפתח ל-YouTube נכנס לכספת של המערכת, מוגבל ל-YouTube בלבד,
  והמערכת מורשית לקרוא אותו. (הריצה הראשונה נכשלה על פרט טכני קטן בגוגל — תיקנתי והרצתי שוב.)
- שלב 3 הושלם — סגרתי את הפיתוח. עכשיו חיפוש-היוטיוב שהיה חסום יכול להמשיך להיבנות.
- שלב 4 הושלם — הוכחתי שהמפתח עובד **באמת**: עשיתי קריאה חיה ל-YouTube עם המפתח החדש והיא
  התקבלה (200). התברר שהבדיקה הקודמת נכשלה כי היא בדקה בטעות את המפתח הישן — לא את החדש.
