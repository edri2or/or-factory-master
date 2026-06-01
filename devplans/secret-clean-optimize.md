---
dev_name: אופטימיזציית ניקוי סודות — reuse mode
slug: secret-clean-optimize
opened: 2026-06-01
status: active
---

# תוכנית פיתוח — אופטימיזציית ניקוי סודות (reuse mode)

## מטרה

בכל הקמת מערכת-טסט (reuse mode), הסקריפט `clean-project-secrets.sh` מוחק את כל 62 הסודות מ-`factory-test-25` ואז מעתיק מחדש 40 סודות גנריים זהים — כל פעם אותם ערכים. זה מבזבז ~160 קריאות API מיותרות (≈3–5 דקות). במקום לגרד הכל, הסקריפט יוסיף מצב `--reuse` שמוחק **רק** את הסודות הספציפיים-לטסט ומשאיר את הגנריים על כנם.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | סקריפט: הוספת מצב `--reuse` + טסטים | completed | `scripts/clean-project-secrets.sh`, `scripts/tests/clean-project-secrets.bats` |
| 2 | workflow: חיבור הדגל `--reuse` ב-provision | completed | `.github/workflows/provision-system.yml` |
| 3 | אימות חי (Or-gated) | pending | — |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — סקריפט: הוספת מצב `--reuse` + טסטים

**Acceptance:**
- [x] `clean-project-secrets.sh` מקבל דגל `--reuse`; במצב זה משתמש ב-`--filter="NOT labels.copied-from-factory:true"` במקום למחוק הכל
- [x] `--adopt` ו-`--reuse` אינם תואמים זה לזה — fail אם שניהם נמסרים
- [x] כל השמירות הקיימות (control project, test-pattern) שמורות בכל המצבים
- [x] `scripts/tests/clean-project-secrets.bats` — bats tests עוברים ב-Playground CI

**הערת התקדמות אחרונה:** הסקריפט עודכן + bats tests נוצרו; ממתין לאישור CI.

**שינוי תוכנית:** —

---

### שלב 2 — workflow: חיבור הדגל `--reuse`

**Acceptance:**
- [x] `provision-system.yml` עובר מ-`clean-project-secrets.sh "$GCP_PROJECT"` ל-`clean-project-secrets.sh --reuse "$GCP_PROJECT"` בסטפ של reuse mode
- [x] CI (shellcheck + yamllint) עובר ירוק

**הערת התקדמות אחרונה:** שורה אחת שונתה + תגובה מעודכנת; shellcheck + yamllint נקיים מקומית.

**שינוי תוכנית:** —

---

### שלב 3 — אימות חי (Or-gated)

**Acceptance:**
- [ ] הקמת מערכת-טסט ב-reuse mode מסיימת את צעד הניקוי עם ~22 מחיקות (לא 62)
- [ ] לוגי `copy-generic-secrets` מציגים "already has a version — skipping" על 40 הגנריים
- [ ] הקמה מהירה בהשוואה לקודם

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הסקריפט תומך עכשיו ב-`--reuse` שמוחק רק סודות ספציפיים-לטסט, עם bats tests מלאים.
- שלב 2 הושלם — `provision-system.yml` מעביר `--reuse` לסקריפט; שינוי שורה אחת.
