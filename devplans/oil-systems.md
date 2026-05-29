---
dev_name: הרחבת לולאת ה-OIL לתיקון מערכות
slug: oil-systems
opened: 2026-05-29
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הרחבת לולאת ה-OIL לתיקון מערכות (Stage 83)

## מטרה

היום לולאת התיקון האוטונומית (OIL) *מאבחנת* תקלות בכל מערכת מנוהלת, אבל *מתקנת* רק את
מאגר הפקטורי עצמו (`or-factory-master`). השלב הזה מסיר את הבלם: כשבאג מאובחן כ-`actionable-bug`
בקוד של *מערכת*, הלולאה מתקנת אותו במאגר של אותה מערכת — אסימון כתיבה ממוקד למאגר ההוא בלבד,
תיקון קטן + מבחן שמוכיח אותו (אותם תקרות בטיחות), שער דטרמיניסטי שמוכיח בעץ של המערכת, PR טיוטה
במאגר המערכת (עם 4 בדיקות ה-CI שלה), אישור ✅ אחד בטלגרם, מיזוג ירוק, אימות אחרי מיזוג על ה-main
של המערכת, וסגירת הכרטיס ב-Linear. הפקטורי נשאר ה*מתזמר* — רק יעד התיקון זז.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| A | גשר האישור נושא את שם המאגר + אסימון ממוקד-מאגר | completed | `services/mcp-server/src/{oil-approval,github-client,index}.ts`, `test/oil-approval.test.mjs` |
| B | אפליקציית ה-approver עוברת להתקנה ארגונית | completed | `.github/workflows/register-oil-approver-app.yml` |
| C | הסרת הבלם המרכזי + רישום PR של מערכת לאישור | completed | `.github/workflows/oil-autofix-investigate.yml` |
| D | הרצת התיקון + השער בעץ של המערכת | completed | `.github/workflows/oil-autofix-investigate.yml`, `scripts/oil-autofix-validate.sh` |
| E | מדיניות template-מול-live ב-fixer | completed | `.github/workflows/oil-autofix-investigate.yml` |
| F | אימות אחרי מיזוג חוצה-מאגר | completed | `.github/workflows/oil-autofix-verify.yml`, `services/mcp-server/src/oil-approval.ts` |
| G | תיעוד + changelog + devplan | completed | `docs/oil-autofix.md`, `CLAUDE.md`, `changelog.d/`, `devplans/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הערה:** כל הקוד הושלם ואומת מקומית (build נקי, 26/26 בדיקות עוברות, השער נוסה בתרחיש
> עץ-מערכת). מבחן ה-E2E החי על `factory-test-42` נשאר כצעד-המשך מגודר: הוא דורש פעולה ידנית
> אחת של Or (התקנה ארגונית מחדש של אפליקציית ה-approver, 2 קליקים) + הקמת מערכת-בדיקה + ✅.

---

### שלב A — גשר האישור נושא את שם המאגר + אסימון ממוקד-מאגר

**Acceptance:**
- [ ] `callback_data` בפורמט `oilapprove:<repo>:<pr>` / `oilreject:<repo>:<pr>` עם נפילה-לאחור ל-`or-factory-master` בפורמט הישן.
- [ ] `registerApproval` מקבל `repo` ומשבץ אותו בכפתורים + בטקסט ההודעה.
- [ ] `handleTelegramCallback` מעביר את ה-`repo` המפוענח ל-merge/close.
- [ ] `index.ts` קורא `repo` מגוף הבקשה של `/oil-approval-register`.
- [ ] שמירה (guard): merge/close מסרבים אם `owner !== 'edri2or'` או `repo` ריק; אסימון ה-approver ממוקד למאגר היעד.
- [ ] בדיקות `parseCallbackData` מורחבות (3-מקטעים + נפילה-לאחור) ועוברות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב B — אפליקציית ה-approver עוברת להתקנה ארגונית

**Acceptance:**
- [ ] הנחיות ההתקנה + בדיקת ה-scope מקבלות התקנה ארגונית (`repository_selection == 'all'`) שמכסה את הפקטורי.
- [ ] ההרשאות נשארות בדיוק `contents:write`+`pull_requests:write`+`metadata:read`.
- [ ] הפעולה הידנית היחידה (2 קליקים של Or) מסומנת בבירור.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב C — הסרת הבלם המרכזי + רישום PR של מערכת לאישור

**Acceptance:**
- [ ] צעד `decide` ממשיך גם ליעד מערכת תקין (שומר classification/confidence/forbidden-paths).
- [ ] צעד הרישום שולח `repo=$TARGET_REPO` ל-`/oil-approval-register` ללא יציאה-מוקדמת ללא-פקטורי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב D — הרצת התיקון + השער בעץ של המערכת

**Acceptance:**
- [ ] `TARGET_DIR` = `.` לפקטורי, או clone רדוד של מאגר המערכת ל-`./target`.
- [ ] ה-fixer כותב את התיקון + הרפרודיוסר תחת `$TARGET_DIR`; commit/branch/push/gate פועלים מול `$TARGET_DIR`.
- [ ] `oil-autofix-validate.sh` רץ עם cwd = `$TARGET_DIR` (ללא שינוי בסקריפט); השמטת-קרדנציאלס + `env -i` נשמרים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב E — מדיניות template-מול-live ב-fixer

**Acceptance:**
- [ ] הנחיית ה-fixer מותאמת לכל מאגר יעד; אם השורש הוא קוד template — מתקנים רק את העותק החי + דגל ב-PR וב-Linear.
- [ ] אין back-port אוטומטי ב-v1.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב F — אימות אחרי מיזוג חוצה-מאגר

**Acceptance:**
- [ ] PR של הפקטורי ממשיך להריץ verify דרך `push:main` (ללא שינוי).
- [ ] מיזוג סינכרוני של מערכת מפעיל `oil-autofix-verify.yml` על הפקטורי דרך `dispatchWorkflow` עם `repo`+`pr_number`.
- [ ] ל-`oil-autofix-verify.yml` נוסף קלט `repo`; כשהוא מערכת — clone של ה-main שלה ל-`./target`, שחזור הרפרודיוסר משם, הרצה דרך `oil-verify.sh`.
- [ ] מגבלת v1 (auto-merge א-סינכרוני של מערכת לא מפעיל אימות) מתועדת.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב G — תיעוד + changelog + devplan

**Acceptance:**
- [ ] `docs/oil-autofix.md`: מגבלות v1 נכתבות מחדש; זרימת המערכת + מדיניות template-מול-live מתועדות.
- [ ] `CLAUDE.md`: שורות הטבלה של שני ה-workflows מעודכנות.
- [ ] fragment ב-`changelog.d/2026-05-29-oil-systems.md` (Stage 83) + devplan זה `completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב A הושלם — כפתורי האישור בטלגרם יודעים עכשיו לאיזו מערכת שייך התיקון, והמיזוג מקבל מפתח
  שמוגבל בדיוק למאגר ההוא.
- שלב B הושלם — אפליקציית המיזוג מותקנת עכשיו על כל המאגרים (כמו ה-broker), כדי שתוכל למזג גם
  במערכות. (נשארה פעולה ידנית אחת שלך: התקנה מחדש ב-2 קליקים.)
- שלב C הושלם — הוסר הבלם שאיפשר תיקון רק לפקטורי; עכשיו גם באג במערכת זכאי לתיקון.
- שלב D הושלם — כשהבאג במערכת, הקוד שלה מורד זמנית ל-`target/` והתיקון נבדק שם, לא על הפקטורי.
- שלב E הושלם — אם שורש הבעיה בתבנית של הפקטורי, מתקנים רק את העותק החי של המערכת ומסמנים שצריך
  לתקן בהמשך גם את התבנית.
- שלב F הושלם — אחרי מיזוג מוצלח במערכת, הפקטורי מריץ אימות על ה-main של אותה מערכת וסוגר את התיק.
- שלב G הושלם — התיעוד וה-changelog עודכנו.
- נותר (מגודר, דורש אותך): מבחן חי מקצה-לקצה על `factory-test-42` — אחרי שתתקין מחדש את
  אפליקציית ה-approver (2 קליקים) ונקים מערכת-בדיקה.
