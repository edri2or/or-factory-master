<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: תיקון ההרצה של file-catalog (אותו דפוס-n8n-2.x כמו db-setup)
slug: file-catalog-run-fix
opened: 2026-06-11
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — תיקון ההרצה של file-catalog

## מטרה

המשך ישיר של `bot-trace-observability` (PR #382). בהקמת מערכת, ה-seed הראשון של טבלת הקבצים
(`file_catalog`) רץ עם אותו body שבור של n8n-2.x — `{"destinationNode":{"nodeName":"Upsert Catalog"}}` —
שמריץ רק את הטריגר `Hourly` ועוצר, כך שהטבלה לא מתמלאת באמת אבל `/run` מחזיר 200 ("PASS" שקרי).
מתקנים בדיוק כמו שתיקנו ב-`db-setup`: body מלא (`workflowData`+`triggerToStartFrom`) + אימות
אמיתי ש-`Upsert Catalog` רץ. הבאג מתון — ה-cron השעתי ממלא את הטבלה לבד תוך שעה — אז זה רק
עיכוב ≤שעה ביום-0, לא כשל קבוע.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיקון ההרצה (מירור db-setup) + golden + תיעוד | completed | `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/MANIFEST.sha256`, `changelog.d/2026-06-11-file-catalog-run-fix.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת. כאן (מסלול קל, בבחירת Or): ההוכחה היא
> השערים הסטטיים הירוקים + שזו העתקה מדויקת של דפוס שכבר הוכח חי (`db-setup` על factory-test-061);
> הוכחה-חיה על מערכת-טסט מוּוֶתֶרֶת ע״י Or (כמו #389) ונדחית למערכת הבאה שתוקם.

---

### שלב 1 — תיקון ההרצה (מירור db-setup) + golden + תיעוד

**Acceptance:**
- [x] בלוק ה-file-catalog ב-`configure-agent-router.yml` שולח body מלא
  (`{workflowData,runData,triggerToStartFrom:{name:"Hourly"}}`) במקום `{destinationNode}` בלבד
- [x] אימות אמיתי דרך helper `_fcat_ok` שבודק `lastNodeExecuted == "Upsert Catalog"` (לא HTTP 200 לבד)
- [x] golden רוענן (`bash scripts/check-system-golden.sh --update`) באותו PR
- [x] כל השערים הסטטיים ירוקים (golden / golden-sync / changelog / devplan / yamllint / shellcheck)

**הוכחה תפקודית (באותו שלב):** מירור מדויק של בלוק ה-`db-setup` שכבר הוכח חי (factory-test-061).
התיקון נשען על שני עובדות מאומתות מ-`file-catalog-refresh.json`: השרשרת לינארית
`Hourly → … → Upsert Catalog`, ו-`Upsert Catalog` הוא הצומת הסופי — כך ש-`triggerToStartFrom:{name:"Hourly"}`
מריץ את כל השרשרת והרצה מוצלחת מסתיימת ב-`lastNodeExecuted == "Upsert Catalog"`.
הוכחה-חיה (נדחית, לא חוסמת מיזוג): על המערכת הבאה שתוקם, `inspect_n8n_execution` על
file-catalog-refresh יראה `lastNode == "Upsert Catalog"` (לא `Hourly`), והבוט יחזיר רשימת
קבצים אמיתית מ-`file_catalog` מיד.

**הערת התקדמות אחרונה:** הושלם. הבלוק תוקן (helper `_fcat_ok` + לולאת body מוכחת עם poll של עד
~24ש' להתאמה לשרשרת הארוכה יותר שקוראת ל-GitHub API), ה-golden רוענן, fragment + devplan נוספו.
מסלול קל — בלי מערכת-טסט.

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

לא הוקמה מערכת-טסט — הוכחה-חיה מוּוֶתֶרֶת ע״י Or (מסלול קל), בדיוק כמו #389. אין מה לפרק.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- הפיתוח נפתח (2026-06-11): תיקון קטן — המילוי הראשון של רשימת הקבצים לא רץ באמת בהקמה (אותו באג
  שכבר תיקנו במקום אחר). ה-cron השעתי ממילא ממלא תוך שעה, אז ההשפעה היא רק עיכוב קטן ביום הראשון.
- שלב 1 הושלם — תיקנתי שההרצה הראשונה תרוץ עד הסוף ותתמלא מיד, עם בדיקת-אמת שזה באמת קרה (לא רק "200 OK").
