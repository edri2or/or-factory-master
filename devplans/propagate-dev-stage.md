---
dev_name: dev-stage עצמאי לכל מערכת חדשה
slug: propagate-dev-stage
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — dev-stage עצמאי לכל מערכת חדשה

## מטרה

היום כל מערכת חדשה מקבלת רק את **פקודות** `/dev-stage` ו-`/dev-status`, בלי המנגנון
שמחזיק אותן. הפיתוח הזה משלים את שלושת החלקים החסרים — תבנית התוכנית, שער ה-CI שחוסם
מיזוג כשפיתוח פעיל לא עודכן, וה-hook שמזכיר לסוכן איפה הפיתוח עומד — כך שכל מערכת
שתיווצר מעכשיו תוכל לנהל פיתוח עצמאי מלא בעצמה. נוגע רק במערכות חדשות (provision-only).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תבנית המערכת: hook + חיווט שער CI | completed | `templates/system/.claude/settings.json`, `templates/system/.github/workflows/changelog-check.yml` |
| 2 | provision-system.yml: שליחת הסקריפטים + תבנית ה-devplan | pending | `.github/workflows/provision-system.yml` |
| 3 | תיעוד: גילוי במערכת + עקביות בפקטורי | pending | `templates/system/AGENTS.md.template`, `CLAUDE.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — תבנית המערכת: hook + חיווט שער CI

**Acceptance:**
- [x] נוצר `templates/system/.claude/settings.json` עם SessionStart hook יחיד שמצביע על `$CLAUDE_PROJECT_DIR/scripts/devplan-session-start-hook.sh` (JSON תקין).
- [x] `templates/system/.github/workflows/changelog-check.yml` כולל צעד "Check devplan updated" באותו job "Changelog gates", מיד אחרי "Check changelog updated".
- [x] `yamllint` + `jq` עוברים על הקבצים שנגעתי בהם.

**הערת התקדמות אחרונה:** הושלם — settings.json (hook יחיד) נוצר ועבר jq; צעד "Check devplan updated" נוסף ל-job "Changelog gates" של התבנית ועבר yamllint.

**שינוי תוכנית:** —

---

### שלב 2 — provision-system.yml: שליחת הסקריפטים + תבנית ה-devplan

**Acceptance:**
- [ ] לולאת הסקריפטים מעתיקה גם `check-devplan-updated` ו-`devplan-session-start-hook`, עם `chmod +x` ל-hook.
- [ ] צעד חדש מעתיק `templates/devplan/DEVPLAN.template.md` ל-`$CLONE_DIR/templates/devplan/`.
- [ ] `git add` כולל `templates`; echo ה-PASS מעודכן.
- [ ] `shellcheck`/`bash -n` על שינויי ה-run; `yamllint` על ה-workflow עובר.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תיעוד: גילוי במערכת + עקביות בפקטורי

**Acceptance:**
- [ ] `templates/system/AGENTS.md.template` כולל סעיף קצר על `/dev-stage` + `/dev-status` (איך יוצרים `devplans/<slug>.md` וכותבים fragment ל-`changelog.d/`).
- [ ] `CLAUDE.md` בפקטורי מתוקן: המשפט "factory-internal — not propagated" כבר לא נכון, ושורת ה-Governance מזכירה את שער/הוק/תבנית ה-devplan שעוברים למערכות חדשות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הוספתי לתבנית של כל מערכת חדשה את ה"מזכיר" (hook) ואת בלם הבטיחות (שער ה-CI) של dev-stage.
