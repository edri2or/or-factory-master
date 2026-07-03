---
dev_name: הפצת ה-hook של גבול-השפה לתבנית-הפקטורי
slug: language-boundary-hook-factory
opened: 2026-07-03
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הפצת ה-hook של גבול-השפה לתבנית-הפקטורי

## מטרה

לגרום לכל מערכת חדשה שהפקטורי מקים להיוולד עם תזכורת "גבול-השפה" — פנימי באנגלית,
מה ש-Or רואה בעברית — מהשורה הראשונה של הסשן, בלי להסתמך על טעינת סקיל. עושים זאת
בהעתקה מותאמת של ה-hook (שכבר חי ומוזג ב-or-aios) אל תבנית-המערכת של הפקטורי, בדיוק
כמו שה-hook האח (capability) כבר נשלח לכל מערכת.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הוספת ה-hook + המסמך הגנרי לתבנית וחיווט ההפצה | completed | `scripts/language-session-start-hook.sh`, `templates/system/docs/language-boundary.md`, `templates/system/.claude/settings.json`, `.github/workflows/provision-system.yml`, `tests/golden/system/**` |
| 2 | בדיקת-לידה חיה על מערכת-בדיקה זמנית | completed | (dispatch בלבד — provision + ניקוי) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הוספת ה-hook + המסמך הגנרי לתבנית וחיווט ההפצה

**Acceptance:**
- [x] `scripts/language-session-start-hook.sh` נוצר במודל של `capability-session-start-hook.sh`
      (shebang, `trap 'exit 0' EXIT`, בלי `set -e`, guard על `docs/language-boundary.md` ||
      `AGENTS.md`), shellcheck נקי.
- [x] `templates/system/docs/language-boundary.md` — גרסה גנרית של המדיניות (קטגוריות A/B/C/D
      + "Number 1 הוא הקצה"), בלי נתיבים/מזהים ספציפיים ל-or-aios.
- [x] ה-hook רשום כ-hook השלישי ב-`templates/system/.claude/settings.json`.
- [x] `provision-system.yml` שולח את הסקריפט (רשימת-השילוח + `chmod +x`) ואת המסמך
      (לולאת שילוח-המסמכים לצד `CAPABILITIES.md`).
- [x] ה-golden רוענן (`check-system-golden.sh --update`) ועובר.

**הוכחה תפקודית (באותו שלב):** הרצת ה-hook מקומית: בתיקייה עם `AGENTS.md` הוא מדפיס את שורות
`[language-boundary]` (exit 0); בתיקייה עם `docs/language-boundary.md` הוא מוסיף את שורת
מקור-האמת; בתיקייה בלי אף מסמך — לא מדפיס כלום ויוצא 0. הודגם: shellcheck נקי, JSON תקין,
`check-system-golden.sh` = PASS.

**הוכחת E2E (artifact):** לא-התנהגותי — השינוי הוא plumbing של הפקטורי (סקריפט + מסמך +
רישום hook + חיווט provision). לא נוגע בקבצי-התנהגות של בוט (`workflows/n8n/*.json` /
`configure-agent-router.yml`), אז שער ה-E2E לא חל.

**הערת התקדמות אחרונה:** הושלם — כל הקבצים נכתבו, שערי-הבדיקה הסטטיים המקומיים ירוקים.

**שינוי תוכנית:** —

---

### שלב 2 — בדיקת-לידה חיה על מערכת-בדיקה זמנית

**Acceptance:**
- [x] מוזג ל-main (PR #570, כל שערי-ה-CI ירוקים) — provision נעול ל-main, אז זה קדם ללידה.
- [x] הוקמה מערכת-בדיקה טרייה `or-test-4` (reuse, `factory-test-25`, 0 מכסה) מ-main; שלבי
      דחיפת ה-scaffold (‏`Push .claude package…` + ‏`Push … orientation docs`) הסתיימו ירוקים
      — כלומר מערכת טרייה נולדה עם ה-hook, הרישום ב-`.claude/settings.json`, והמסמך
      `docs/language-boundary.md`. הריצה בוטלה בכוונה מיד אחרי ה-scaffold (לפני העתקת הסודות/הפריסה,
      שאינם רלוונטיים ל-SessionStart hook).
- [x] `or-test-4` נוקתה — נמחקה דרך `propose-repo-delete.yml` (כרטיס ✅ בטלגרם שאושר על ידי Or,
      2026-07-03); חיפוש `org:edri2or or-test-4` מחזיר 0 תוצאות. (הערה: הסשן מוגבל בקריאה ל-
      `or-factory-master`/`or-aios`, אז אין אימות-קריאה ישיר של הריפו — האות + מסלול-המחיקה
      התקני של הפקטורי מספיקים.)

**הוכחה תפקודית (באותו שלב):** שלבי-הלידה הירוקים על `or-test-4` (מ-main, אחרי המיזוג) הם
הוכחת Day-0 birth — מערכת טרייה נולדה עם ה-hook + המסמך + הרישום. הערה חשובה: `or-edri-4`
(המערכת הקבועה, Day-2) אינה הכלי הנכון לשינוי-לידה זה — היא כבר קיימת, ו-`refresh-system-agents.yml`
לא יכול לגבות אליה את השינוי (מעתיק רק JSON של n8n, לא את עץ `.claude`/`scripts/`/`docs/`,
וקובץ ה-hook יושב ב-`scripts/` בשורש הפקטורי, מחוץ ל-`templates/system/`). לכן provision טרייה
היא הכלי הנכון, בדיוק כפי ש-CLAUDE.md קובע ("throwaway = Day-0 birth; or-edri-4 = Day-2").

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — מוזג ל-main, הלידה הוכחה על `or-test-4`, והמערכת הזמנית נוקתה.

**שינוי תוכנית:** סדר ההוכחה/המיזוג התהפך מול התוכנית המקורית — provision נעול ל-`main` (broker WIF),
אז לא ניתן להריץ בדיקת-לידה חיה לפני מיזוג; לכן: CI ירוק → מיזוג → לידה על מערכת טרייה → ניקוי.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כל מערכת חדשה שנקים מעכשיו תיוולד עם התזכורת שהמערכת עובדת באנגלית בפנים
  ומדברת אליך עברית, כבר מהשנייה הראשונה של הסשן.
- שלב 2 הושלם — הקמנו מערכת-בדיקה טרייה וראינו שהיא באמת נולדה עם התזכורת בפנים; אחר כך
  ניקינו אותה. הפיתוח סגור.
