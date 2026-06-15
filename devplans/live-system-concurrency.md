---
dev_name: תור-מקביליות על מערכת חיה (or-edri-4)
slug: live-system-concurrency
opened: 2026-06-15
status: active
---

# תוכנית פיתוח — תור-מקביליות על מערכת חיה (or-edri-4)

## מטרה

ארבעה workflows של הפקטורי נוגעים במערכת-הוכחה חיה (בעיקר or-edri-4) בלי שום סנכרון, אז
שני פיתוחים מקבילים יכולים לרוץ זה על זה באמצע הוכחה ולדרוס את המצב החי. מוסיפים לכל
הארבעה בלוק `concurrency` עם קבוצה אחידה לפי שם-המערכת (`live-system-<system>`) ו-`queue: max`,
כך שכל הפעולות על אותה מערכת מסתדרות בתור FIFO במקום להידרס. תואם את נעילת ה-proof
ל-or-edri-4.

זה **לא** שינוי בתהליך-ההקמה (התבניות תחת `templates/system/**` לא נגעו — התאומים שם
נשארים על המיפוי הישן, backfill עתידי). לכן: שערים סטטיים בלבד למיזוג; אימות-התור החי
נעשה **אחרי המיזוג** כי שלושת מתוך ארבעת ה-workflows נעולים ל-`main` (רצים רק מ-main).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מיפוי `live-system-<system>` + `queue: max` על ארבעת ה-workflows | completed | `.github/workflows/{prove-on-test-system,refresh-system-agents,e2e-verify,deploy-verify}.yml` |
| 2 | אימות-תור חי על or-edri-4 (post-merge) | pending | — (דיספאצ' חי, ללא קוד) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — מיפוי `live-system-<system>` + `queue: max` על ארבעת ה-workflows

**Acceptance:**
- [x] `prove-on-test-system.yml` ו-`refresh-system-agents.yml`: **הוספת** בלוק `concurrency` (syntax `inputs.system_name`).
- [x] `e2e-verify.yml` ו-`deploy-verify.yml`: **מיפוי** הבלוק הקיים מ-`*-verify-${target_ref}` ל-`live-system-${github.event.inputs.system_name}` + הוספת `queue: max` (syntax `github.event.inputs.system_name`).
- [x] כל הארבעה עם `cancel-in-progress: false` (חובה ל-`queue: max`, אחרת שגיאת אימות).
- [x] התאומים תחת `templates/system/.github/workflows/` **לא** נגעו (golden לא מושפע; backfill עתידי).
- [x] שערים סטטיים ירוקים (yamllint על `.github/workflows/` + `templates/system/.github/workflows/`, Changelog gates, golden-sync no-op).

**הוכחה תפקודית (באותו שלב):** `yamllint` נקי על ארבעת הקבצים ועל כל ספריות ה-CI (אומת מקומית).
תחביר `queue: max` אומת מול תיעוד GitHub (GA 2026-05-07): מפתח-אח תחת `concurrency`, FIFO עד 100
ריצות, **דורש** `cancel-in-progress: false`. ארבעת הקבצים כבר עם `cancel-in-progress: false`,
כך שאין שגיאת-אימות. ה-4 לא מופיעים כ-trigger_paths באף surface ב-`e2e-surfaces.json` → אין
דרישת E2E proof. (האימות שה-`queue: max` באמת מסדר בתור הוא שלב 2, חי.)

**הוכחת E2E (artifact):** לא-התנהגותי (factory workflows, לא `templates/system/**` ולא קבצי-בוט).

**הערת התקדמות אחרונה:** הקוד הושלם. ארבעת הבלוקים הוחלו (הוספה ב-prove/refresh, מיפוי ב-e2e/deploy), `yamllint` נקי, golden-sync no-op. נשאר שלב 2 (אימות-תור חי) שרץ אחרי המיזוג.

**שינוי תוכנית:** —

---

### שלב 2 — אימות-תור חי על or-edri-4 (post-merge)

**Acceptance:**
- [ ] אחרי המיזוג ל-`main`: שני (עד שלושה) דיספאצ'ים בזה-אחר-זה של `refresh-system-agents.yml` על or-edri-4 (`run_configure=false`, `paths` ברירת-מחדל → אין diff בתבנית → אין push → אפס שינוי חי).
- [ ] לאמת שריצה #2 נכנסת ל-`queued`/`pending` בזמן ש-#1 `in_progress`, ומתחילה רק אחרי ש-#1 הסתיימה (FIFO).
- [ ] לתעד את מזהי-הריצות כהוכחת התור.

**הוכחה תפקודית (באותו שלב):** מזהי-הריצות + סטטוסים מ-`list_workflow_runs`/`get_workflow_run`
שמראים סריאליזציה (#2 ממתין ל-#1). דיספאצ' no-op (אפס שינוי על or-edri-4). **or-edri-4 קבועה —
לא מפרקים.** השלב הזה רץ אחרי המיזוג כי שלושה מהארבעה נעולים ל-`main`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כל ארבעת ה-workflows שנוגעים במערכת חיה קיבלו "תור" אחיד לפי שם-המערכת, כך ששתי פעולות על or-edri-4 מסתדרות בתור במקום לרוץ זו על זו. נשאר רק לאמת את התור חי אחרי המיזוג.
