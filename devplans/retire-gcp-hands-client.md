---
dev_name: הוצאה משימוש של סקיל gcp-hands-client המת מתבנית המערכת
slug: retire-gcp-hands-client
opened: 2026-06-17
status: completed   # נסגר 2026-06-17 — כל השלבים הושלמו ואומתו סטטית; ראו הערת סגירה
---

# תוכנית פיתוח — הוצאה משימוש של סקיל gcp-hands-client המת

## מטרה

הריפו `edri2or/gcp-hands` כבר לא קיים (אוחד לתוך or-factory-master ב-6–10 ביוני ונמחק; בדיקת
API חיה מחזירה 404). אבל סקיל לקוח מת — `templates/system/.claude/skills/gcp-hands-client/` —
עדיין מתאר אותו כיעד dispatch חי (repository_dispatch + תגובות-issue), נשלח לכל מערכת חדשה,
מנותב אליו משני סקילים אחרים, ו-`provision-system.yml` *דורש* אותו בכוח. סוכן מחקר שקרא את
התבנית נתפס עליו כתקדים-ייצור חי — זה מה שהדליק את הפיתוח. מסירים את הסקיל המת, מתקנים את כל
ההפניות לאמת הנוכחית (למערכת אין נתיב GCP ישיר; היא *מבקשת* מהברוקר), ומוודאים שכל שערי ה-CI
נשארים ירוקים.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מחיקת הסקיל המת + תיקון 3 ההפניות שמנתבות אליו | completed | `templates/system/.claude/skills/gcp-hands-client/*` (נמחק), `operate-this-system/SKILL.md`, `github-app-operations/SKILL.md`, `AGENTS.md.template` |
| 2 | הסרת הדרישה הקשיחה ב-provision + רענון golden | completed | `.github/workflows/provision-system.yml`, `tests/golden/system/**` |
| 3 | אימות סטטי (greps + golden gate + CI) | completed | — |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הערת סגירה (2026-06-17):** כל השינויים שבתוך ה-PR הושלמו ואומתו סטטית (golden עובר נקי;
> שלוש בדיקות grep מחזירות אפס הפניות חיות). שני follow-ups אופציונליים, **נעולי-Or** (עלות/מגע
> במערכות חיות), נשארים מחוץ ל-PR הזה: (א) אימות Day-0 חי דרך provision חד-פעמי של מערכת-טסט
> זמנית, (ב) back-fill של מערכות קיימות (refresh מעתיק, לא מוחק — פער ידוע).

---

### שלב 1 — מחיקת הסקיל המת + תיקון ההפניות

**Acceptance:**
- [x] `templates/system/.claude/skills/gcp-hands-client/` נמחק (SKILL.md + README.md).
- [x] `AGENTS.md.template` כבר לא מזכיר `gcp-hands-client` ברשימת חבילת ה-`.claude/`.
- [x] `operate-this-system/SKILL.md` — האינווריאנט "אין נתיב GCP ישיר" מחליף את "dispatch לברוקר", והבולט של gcp-hands-client הוסר מרשימת הסקילים.
- [x] `github-app-operations/SKILL.md` — מודל-האבטחה משמר את הכלל (לעולם לא לשלוף מפתח פרטי מחוץ ל-Actions) אבל מסיר את הנימוק המת (נתיב תגובת-ה-issue של gcp-hands).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — `rg "gcp-hands-client" templates/` ו-`rg
"edri2or/gcp-hands|repository_dispatch|gcp-hands-broker-app" templates/` מחזירים אפס. ✅

**הוכחת E2E (artifact):** לא-התנהגותי (קבצי `.claude/skills/`, `AGENTS.md.template` — לא קבצי-התנהגות של הבוט).

**הערת התקדמות אחרונה:** הושלם. הסקיל נמחק, 3 ההפניות תוקנו לאמת הנוכחית.

**שינוי תוכנית:** —

---

### שלב 2 — הסרת הדרישה הקשיחה + רענון golden

**Acceptance:**
- [x] `provision-system.yml` כבר לא מפיל את עצמו אם הסקיל חסר (הדרישה הקשיחה הוסרה); ההערה ושורת-הסיכום עודכנו.
- [x] `bash scripts/check-system-golden.sh --update` הורץ; ה-golden כולל 143 קבצים בלי שני קבצי gcp-hands-client.
- [x] `bash scripts/check-system-golden.sh` עובר נקי (golden תואם לתבנית).

**הוכחה תפקודית (באותו שלב):** `check-system-golden.sh` → "PASS: system golden matches the templates/system render." ✅; `rg "gcp-hands-client" tests/golden/` ו-`.../provision-system.yml` → אפס. ✅

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. golden רוענן ועובר; provision כבר לא תלוי בסקיל.

**שינוי תוכנית:** —

---

### שלב 3 — אימות סטטי

**Acceptance:**
- [x] שלוש בדיקות ה-grep מהתוכנית מחזירות אפס הפניות חיות.
- [x] שער ה-golden עובר נקי מקומית.
- [ ] כל ארבעת ה-jobs של ה-CI ירוקים על ה-PR (Changelog gates / Playground tests / shellcheck+yamllint / secret-scan+supply-chain) — נבדק אחרי push.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — האימות הוא הרצת השערים עצמם; ה-CI על ה-PR הוא ההוכחה הסופית.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** אימות מקומי עבר; ממתין ל-CI ירוק על ה-PR.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — מחקנו את כרטיס-ההוראות המת (gcp-hands) מהתבנית, ותיקנו את 3 המקומות ששלחו אליו.
- שלב 2 הושלם — פס-הייצור (provision) כבר לא נעצר בגלל הכרטיס המת, וטביעת-האצבע (golden) עודכנה.
- שלב 3 הושלם (אימות מקומי) — אפס שאריות מתות; נשאר רק לראות ש-CI ירוק על ה-PR.
