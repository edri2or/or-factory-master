---
dev_name: הקמה נועלת main כמו הפקטורי (ruleset)
slug: provision-ruleset-protection
opened: 2026-06-02
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הקמה נועלת main כמו הפקטורי

## מטרה

שכל מערכת שה-factory מקים תיוולד עם בדיוק אותו מנעול main כמו הפקטורי עצמו —
ruleset יחיד (`protect-main`) במקום ה-classic branch-protection הישן. כך אף סוכן
(כולל הברוקר) לא יכול לדחוף ישירות ל-main, רק דרך PR ומיזוג, ובנוסף נחסמים force-push ומחיקה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | החלפת classic ב-ruleset ב-provision | in-progress | `.github/workflows/provision-system.yml`, `CLAUDE.md` |
| 2 | הוכחה על מערכת-טסט חיה + פירוק | pending | (dispatch provision + verify + decommission) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — החלפת classic ב-ruleset ב-provision

**Acceptance:**
- [ ] שלב "Branch protection on main" קורא ל-`ensure-protect-main-ruleset.sh` עם 4 ה-contexts של המערכת
- [ ] ה-classic curl (`branches/main/protection`) הוסר לגמרי
- [ ] CLAUDE.md מעודכן; CI ירוק

**הערת התקדמות אחרונה:** הטוקן בהקמה (שורה 147) לא-מ-scoped → כבר נושא administration:write, אז אין שינוי טבעת. ב-PR.

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה על מערכת-טסט חיה + פירוק

**Acceptance:**
- [ ] provision של מערכת-טסט זמנית (reuse, `factory-test-25`, 0 quota)
- [ ] `verify_github_system(<throwaway>)` → `ruleset-protect-main-active: PASS`, ואין classic protection
- [ ] פירוק המערכת הזמנית (`decommission-test-system.yml`)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- (מתמלא תוך כדי)
