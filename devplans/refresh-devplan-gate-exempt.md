---
dev_name: פטור שער-ה-devplan ל-refresh של הפקטורי
slug: refresh-devplan-gate-exempt
opened: 2026-07-03
status: completed   # תיקון חד-שלבי, הוכח — נסגר באותו PR
---

# תוכנית פיתוח — פטור שער-ה-devplan לרענון-תבניות אוטומטי של הפקטורי

## מטרה

כשהפקטורי מרענן קבצי-תבנית למערכת חיה (`refresh-system-agents.yml`) הוא פותח PR
בענף `refresh-system-<runid>` שלא נוגע בשום תוכנית-פיתוח — כי זה רענון אוטומטי,
לא שלב-פיתוח. במערכת שיש בה תוכניות-פיתוח פעילות, שער ה-devplan
(`check-devplan-updated.sh`) חסם את המיזוג לנצח. זה בדיוק מה שקרה ל-or-aios: ה-backfill
של `request-factory-resource` (PR #233) נתקע 20/20 ניסיונות מיזוג. התיקון: לפטור את ענפי
`refresh-system-*` מהשער — בדיוק כמו הפטור הקיים ל-`oil-autofix/*` (רענון אוטומטי, לא שלב).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | פטור `refresh-system-*` בשער ה-devplan (פקטורי + or-aios) | completed | `scripts/check-devplan-updated.sh` |

> הפטור זהה לפטור `oil-autofix/*` הקיים: תוספת `case` אחת. השער נשאר no-op כשאין תוכנית פעילה,
> וממשיך לאכוף לכל ענף רגיל אחר.

---

### שלב 1 — פטור `refresh-system-*` בשער ה-devplan

**Acceptance:**
- [x] `scripts/check-devplan-updated.sh` מזהה ענף `refresh-system-*` ומחזיר PASS (exit 0) לפני בדיקת התוכניות הפעילות.
- [x] אותו תיקון מוחל על העותק החי של or-aios (בענף של PR #233), כדי לשחרר את ה-backfill.
- [x] ענף רגיל (`claude/*`, `main`) ממשיך לעבור דרך האכיפה הרגילה — אין רגרסיה.

**הוכחה תפקודית (באותו שלב):** הרצת הסקריפט עם `GITHUB_HEAD_REF=refresh-system-28631688910`
מחזירה `PASS: factory template-refresh branch … devplan check skipped` ו-exit 0 (נבדק מקומית).
ה-CI של or-aios PR #233 עובר את "Changelog gates" ומתמזג. תוכן/הגיון בלבד — לא-התנהגותי.

**הוכחת E2E (artifact):** לא-התנהגותי (סקריפט CI, לא נוגע בקבצי-התנהגות של בוט).

**הערת התקדמות אחרונה:** בוצע — הפטור נוסף לשני העותקים, נבדק מקומית, ו-PR #233 שוחרר.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — כשהפקטורי מרענן מערכת אוטומטית, שער-הבקרה כבר לא חוסם את המיזוג בטעות; הבקשה שנתקעה על or-aios שוחררה.
