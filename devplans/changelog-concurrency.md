---
dev_name: CHANGELOG חסין-מרוץ — פתקים per-PR + אכיפה
slug: changelog-concurrency
opened: 2026-05-29
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — CHANGELOG חסין-מרוץ (פתקים per-PR + אכיפה)

## מטרה

לסגור סופית את מרוץ ה-`Stage N`: היום PR רגיל בוחר מספר Stage ידני בראש `CHANGELOG.md`, וכששני
פיתוחים רצים במקביל המספרים מתנגשים (קרה לנו: 129→133→135). הפיתוח `parallel-dev-stage` כבר הניח
את התשתית (תיקיית `changelog.d/` + שער שמקבל פתקים + `dev-stage` רב-מקבילי), אבל הפתקים משמשים שם
רק כ"מוצא חירום" לפיתוחי dev-stage מקבילים — PR רגיל עדיין ממספר ידנית. כאן **משלימים**: מנוע-איחוד
חד-נתיבי שמקפל פתקים ל-CHANGELOG ממוספר אוטומטית + ארכוב, הופכים פתק לברירת-מחדל לכל PR (אז שום PR
לא בוחר מספר ידנית → אפס התנגשות), מפיצים לתבנית המערכות, ומפעילים הגנת-strict על main של הפקטורי.

> **כבר נעשה במקביל (לא בונים מחדש):** `changelog.d/` קיימת; `scripts/check-changelog-updated.sh`
> מקבל פתק `changelog.d/<date>-<slug>.md` או `CHANGELOG.md`; `check-devplan-updated.sh` אוכף את כל
> הפיתוחים הפעילים (לכן הפיתוח הזה לא צריך "הערת צד" ל-OIL — די לגעת ב-devplan שלו עצמו).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מנוע-איחוד (compile) + ארכוב-אוטומטי + README | completed | `scripts/compile-changelog.sh`, `.github/workflows/compile-changelog.yml`, `changelog.d/README.md` |
| 2 | פתק כברירת-מחדל לכל PR (קונבנציה) | completed | `.claude/commands/dev-stage.md` (+mirror `templates/system/.claude/commands/dev-stage.md`), `CLAUDE.md` |
| 3 | הפצה לתבנית המערכות | completed | `templates/system/changelog.d/`, `.github/workflows/provision-system.yml` |
| 4 | הגנת-strict על main של הפקטורי + תיעוד וסגירה | pending | branch protection (or-factory-master), `CLAUDE.md`, `docs/bootstrap-record.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — מנוע-איחוד (compile) + ארכוב-אוטומטי + README

**Acceptance:**
- [x] `scripts/compile-changelog.sh`: קורא את כל `changelog.d/*.md`, מחשב את ה-Stage הבא (max על `CHANGELOG.md` + `docs/changelog-archive/` ועוד 1), בונה סעיף `## Stage N` עם טבלת `| PR | Type | Summary |`, ומוחק את הפתקים שאוחדו. אידמפוטנטי; חד-נתיבי (אין מקביליות בזמן ריצה → אין התנגשות מספרים).
- [x] ארכוב-אוטומטי: אם `CHANGELOG.md` יחצה ~20KB אחרי האיחוד, מעביר רשומות ישנות ל-`docs/changelog-archive/CHANGELOG-<date>.md` — נשאר מתחת לתקרת `check-changelog-size.sh`.
- [x] `.github/workflows/compile-changelog.yml`: `workflow_dispatch` ידני, מריץ את הסקריפט (broker App) ופותח PR עם התוצאה (לא דוחף ל-main ישירות).
- [x] `changelog.d/README.md`: מתעד את פורמט הפתק הקנוני + מתי/איך מאחדים.
- [x] `shellcheck --severity=error` + `yamllint` נקי; הרצה-יבשה מקומית אימתה איחוד + ארכוב + אידמפוטנטיות.

**הערת התקדמות אחרונה:** הושלם ונבדק מקצה-לקצה בעותק זמני — איחוד 2 פתקים → Stage 138/139, ארכוב 2 הישנים (newest-first), ריצה חוזרת = no-op אידמפוטנטי; כל הבדיקות הסטטיות ירוקות. PR פתוח על הענף `claude/eloquent-maxwell-V8dWH`; ממתין ל-CI ירוק + מיזוג ואישורך לשלב 2.

**שינוי תוכנית:** השלב המקורי "1 — מנגנון הפתקים + שער תואם-אחורה" כבר נבנה במקביל ע"י הפיתוח `parallel-dev-stage` (Stages 136-137), אז הוא ירד; שלב 1 כאן הוא מה שהיה "שלב 2" (מנוע-האיחוד) — החלק שאותו פיתוח השאיר כ"אופציונלי".

---

### שלב 2 — פתק כברירת-מחדל לכל PR (קונבנציה)

**Acceptance:**
- [x] `.claude/commands/dev-stage.md` (+ mirror זהה ב-`templates/system/`) מנחה לכתוב פתק `changelog.d/` כברירת-מחדל לכל PR קוד — לא רק כשרצים שני פיתוחים מקביליים.
- [x] `CLAUDE.md` ("Development workflow") מתעד שזו הדרך הרגילה; CHANGELOG.md מתעדכן רק ע"י מנוע-האיחוד.
- [x] `check-skills-mirror.sh` עובר (ה-mirror זהה byte-for-byte).

**הערת התקדמות אחרונה:** הושלם — Step 3(b) ב-`dev-stage.md` (+mirror) הופך פתק `changelog.d/` לברירת-מחדל לכל PR (הוסר הפיצול single/parallel ו"הניקוי האופציונלי"); `CLAUDE.md` עודכן. `check-skills-mirror.sh` ירוק (mirror זהה). זה החלק שסוגר את המרוץ ל-PR רגיל. PR ממתין ל-CI ומיזוג ואישורך לשלב 3.

**שינוי תוכנית:** —

---

### שלב 3 — הפצה לתבנית המערכות

**Acceptance:**
- [x] `templates/system/changelog.d/README.md` נזרע (ה-README שומר על קיום התיקייה — אין צורך ב-`.gitkeep`).
- [x] `provision-system.yml` (שלב ה-scaffold-copy) מעתיק את `compile-changelog.sh` (סקריפט נייד) + זורע `changelog.d/` בכל מערכת חדשה. (ה-workflow למערכות נדחה — ראה שינוי תוכנית.)
- [x] אומת: `yamllint` + 4 שערי supply-chain ירוקים; ה-`git add` ורשימת ה-scaffold כוללים את הקבצים.

**הערת התקדמות אחרונה:** הושלם — מערכת חדשה תקבל מעכשיו את `compile-changelog.sh` (9 הסקריפטים הניידים) + זרע `changelog.d/README.md`. ה-CHANGELOG-gate הנייד כבר מקבל פתקים, ו-`/dev-stage` כבר כותב פתקים — אז מערכת חדשה יורשת את המנגנון המלא. PR ממתין ל-CI ולאישורך לשלב 4.

**שינוי תוכנית:** ה-compile **workflow** למערכות נדחה (לא נשלח לתבנית). סיבה: workflow למערכת חייב זהות-מערכת (WIF + הסוד `github-app-private-key` של המערכת) שאי-אפשר לאמת בלי provision אמיתי — ושליחת workflow לא-מאומת לכל מערכת עתידית מפֵרה את "verify each step". במקום זה נשלח הסקריפט הנייד (`compile-changelog.sh`); סוכן של המערכת מריץ אותו ישירות (`bash scripts/compile-changelog.sh`). ה-workflow של הפקטורי עצמו (שלב 1) מכסה את ריפו-הפקטורי.

---

### שלב 4 — הגנת-strict על main של הפקטורי + תיעוד וסגירה

**Acceptance:**
- [ ] אומת מצב ההגנה הנוכחי על `or-factory-master` main (reader MCP / rulesets).
- [ ] אם חסר: הוחלה הגנת branch protection הזהה למערכות (`strict: true` + 4 ההקשרים + PR-required, ללא force-push/deletion). דורש אישור Or מפורש בגבול הזה.
- [ ] merge queue מתועד כ"נדחה" (דורש מעבר ל-rulesets; הפתקים כבר מבטלים את המרוץ).
- [ ] `CLAUDE.md` + `docs/bootstrap-record.md` עודכנו; הפיתוח נסגר (`status: completed`).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם ומוזג — נבנה "מנוע האיחוד": כל פתק מתקפל ל-CHANGELOG ממוספר אוטומטית (המספר נקבע בריצה אחת חד-נתיבית → אפס התנגשות), והרשומות הישנות עוברות לארכיון לבד.
- שלב 2 הושלם — הפתק הפך לברירת-המחדל לכל PR קוד (לא רק במצב מקביל). מעכשיו שום PR לא בוחר מספר Stage ידני; ה-CHANGELOG הממוספר נבנה רק ע"י מנוע-האיחוד. זה החלק שסוגר את המרוץ ל-PR רגיל.
- שלב 3 הושלם — כל מערכת חדשה תירש את המנגנון: מקבלת את סקריפט מנוע-האיחוד + תיקיית הפתקים. (ה"כפתור" האוטומטי למערכות נדחה בינתיים — דורש חיווט-זהות שאי-אפשר לאמת בלי לבנות מערכת אמיתית; סוכן המערכת מריץ את הסקריפט ישירות.)
