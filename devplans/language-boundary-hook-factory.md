---
dev_name: הפצת ה-hook של גבול-השפה לתבנית-הפקטורי
slug: language-boundary-hook-factory
opened: 2026-07-03
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 2 | בדיקת-לידה חיה על מערכת-בדיקה זמנית | pending | (dispatch בלבד — provision + פתיחת סשן) |

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
- [ ] אחרי ש-CI של הענף ירוק, להקים מערכת-בדיקה זמנית במצב reuse
      (`shared_gcp_project=factory-test-25`, 0 מכסה) מהענף — באישור-עלות מפורש של Or.
- [ ] לפתוח סשן Claude Code על ריפו המערכת החדשה ולוודא ששורות `[language-boundary]`
      נדלקות ב-SessionStart ושהמסמך `docs/language-boundary.md` נשלח.
- [ ] לפרק את מערכת-הבדיקה (`decommission-test-system.yml`, בבקשת Or מפורשת) ולמזג ל-main.

**הוכחה תפקודית (באותו שלב):** הופעת שורות `[language-boundary]` בתחילת סשן על המערכת
הטרייה = הוכחת Day-0 birth. `refresh-system-agents.yml` לא יכול לגבות זאת (הוא מעתיק רק
JSON של n8n, לא את עץ `.claude` או `scripts/`), לכן נדרשת provision טרייה מהענף.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ממתין ל-CI ירוק על הענף ולאישור-עלות מ-Or.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כל מערכת חדשה שנקים מעכשיו תיוולד עם התזכורת שהמערכת עובדת באנגלית בפנים
  ומדברת אליך עברית, כבר מהשנייה הראשונה של הסשן.
