---
dev_name: הקשחת main של מערכות (protect-system-main)
slug: protect-system-main
opened: 2026-06-02
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הקשחת main של מערכות

## מטרה

לסגור פרצה: ל-main של ריפו-מערכת (כמו `or-adhd-agent`) לא הותקנה הגנת branch
(ruleset), אז אפשר היה לדחוף ישירות בלי PR — כולל הברוקר של הפקטורי. בונים workflow
מוכלל שמחיל את אותו `protect-main` ruleset על כל ריפו-מערכת, וגם מסמן `.bootstrap-complete`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הכללת protect-main ל-system repos | completed | `.github/workflows/protect-system-main.yml`, `scripts/ensure-protect-main-ruleset.sh` |
| 2 | כתיבת `.bootstrap-complete` דרך PR | completed | `.github/workflows/protect-system-main.yml` |
| 3 | הרצה ואימות על or-adhd-agent | completed | — (dispatch + verify_github_system) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הכללת protect-main ל-system repos

**Acceptance:**
- [x] workflow חדש `protect-system-main.yml` (workflow_dispatch, input של שם ריפו)
- [x] `ensure-protect-main-ruleset.sh` פרמטרי דרך `TARGET_REPO` / `REQUIRED_CONTEXTS_JSON` עם ברירות מחדל תואמות-לאחור

**הערת התקדמות אחרונה:** הושלם ומוזג (PR #296). אומת על or-adhd-agent: `ruleset-protect-main-active: PASS`.

**שינוי תוכנית:** —

---

### שלב 2 — כתיבת `.bootstrap-complete` דרך PR

**Acceptance:**
- [ ] שלב ה-marker פותח PR וממזג עם retry במקום push ישיר (הברוקר אינו bypass actor)
- [ ] CI ירוק על הפקטורי

**הערת התקדמות אחרונה:** push ישיר נכשל ב-409 כי הברוקר אינו admin על ריפו-מערכת. עברנו לתבנית branch→PR→retry-merge (כמו prove-on-test-system.yml). ב-PR #300.

**שינוי תוכנית:** התיקון המקורי (marker לפני ruleset) לא הספיק כי main מוגן ממילא — הדרך היחידה היא PR.

---

### שלב 3 — הרצה ואימות על or-adhd-agent

**Acceptance:**
- [x] dispatch של `protect-system-main.yml` עם `system_repo=or-adhd-agent`
- [x] `verify_github_system(or-adhd-agent)` → גם `bootstrap-complete-marker` וגם `ruleset-protect-main-active` הם PASS

**הערת התקדמות אחרונה:** הושלם (run 26820384617). marker מוזג ל-or-adhd-agent דרך PR #7 (factory-master-broker[bot]); שתי הבדיקות PASS.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — בנינו "מנעול" אחיד שאפשר להתקין על main של כל מערכת, והתקנו אותו על or-adhd-agent.
- שלב 2 הושלם — סימון סיום-ההקמה נכתב דרך PR (גם הברוקר עובר דרך PR, בלי עקיפה).
- שלב 3 הושלם — אומת חי על or-adhd-agent: גם המנעול וגם סימון ההקמה תקינים (PASS). הפיתוח נסגר.
