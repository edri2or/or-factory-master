---
dev_name: הקמה נועלת main כמו הפקטורי (ruleset)
slug: provision-ruleset-protection
opened: 2026-06-02
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הקמה נועלת main כמו הפקטורי

## מטרה

שכל מערכת שה-factory מקים תיוולד עם בדיוק אותו מנעול main כמו הפקטורי עצמו —
ruleset יחיד (`protect-main`) במקום ה-classic branch-protection הישן. כך אף סוכן
(כולל הברוקר) לא יכול לדחוף ישירות ל-main, רק דרך PR ומיזוג, ובנוסף נחסמים force-push ומחיקה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | החלפת classic ב-ruleset ב-provision | completed | `.github/workflows/provision-system.yml`, `CLAUDE.md` |
| 2 | הוכחה על מערכת-טסט חיה + פירוק | completed | (dispatch provision + verify + decommission) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — החלפת classic ב-ruleset ב-provision

**Acceptance:**
- [x] שלב "Branch protection on main" קורא ל-`ensure-protect-main-ruleset.sh` עם 4 ה-contexts של המערכת
- [x] ה-classic curl (`branches/main/protection`) הוסר לגמרי
- [x] CLAUDE.md מעודכן; CI ירוק

**הערת התקדמות אחרונה:** הושלם ומוזג (PR #303). הטוקן בהקמה (שורה 147) לא-מ-scoped → כבר נושא administration:write, אז לא נדרש שינוי טבעת.

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה על מערכת-טסט חיה + פירוק

**Acceptance:**
- [x] provision של מערכת-טסט זמנית (reuse, `factory-test-25`, 0 quota) — `test-lock-check` (run 26822185745, success)
- [x] `verify_github_system(test-lock-check)` → `ruleset-protect-main-active: PASS` (נולד נעול ב-ruleset; classic הוסר מהקוד אז לא קיים)
- [x] פירוק המערכת הזמנית (`decommission-test-system.yml`, run 26823195711, success)

**הערת התקדמות אחרונה:** הוכח חי — מערכת חדשה נולדה עם ruleset פעיל, ואז פורקה נקי. הערה תפעולית: לפירוק מערכת ללא קידומת-טסט בשם, חובה להעביר `shared_gcp_project=factory-test-25` (שער הבטיחות דחה את הניסיון הראשון בלי זה — התנהגות נכונה).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — שינינו את ההקמה כך שכל מערכת חדשה תיוולד עם אותו מנעול חזק כמו הפקטורי (ruleset), במקום הישן.
- שלב 2 הושלם — הוכחנו חי על מערכת זמנית שנולדה נעולה, ואז פירקנו אותה. המשימה הושלמה.
