---
dev_name: כלי MCP למצב מכסת פרויקטים
slug: mcp-project-quota
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — כלי MCP למצב מכסת פרויקטים (GCP project-quota)

## מטרה

כפתור קריאה-בלבד חדש בשרת ה-MCP שעונה אוטונומית על "כמה פרויקטים פנויים יש לנו, ומתי
יתפנו פרויקטים שנמחקו?" — כמה פעילים, כמה מחוקים-ועדיין-נספרים, ולכל מחוק תאריך שחרור משוער
("מתפנה בעוד X ימים"). הסוכן מפעיל אותו לבד, בלי שום קליק של Or. רץ בזהות הברוקר הקיימת —
אין צורך בהרשאה חדשה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | קוד הליבה + טסט | completed | `services/mcp-server/src/gcp-client.ts`, `services/mcp-server/test/project-quota.test.mjs` |
| 2 | חיווט הכלי | pending | `services/mcp-server/src/tools.ts` |
| 3 | פריסה + אימות חי | pending | `deploy-mcp-server.yml` (dispatch בלבד, ללא שינוי) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — קוד הליבה + טסט

**Acceptance:**
- [x] `getProjectQuotaStatus()` + `listSoftDeletedProjects()` + `computeFreeUpDate()` ב-`gcp-client.ts`.
- [x] שימוש חוזר ב-`gcpFetch` הפנימי ו-`listAllProjects` הקיים; v3 `projects:search` ל-deleteTime.
- [x] טסט יחידה על `computeFreeUpDate` (טהור, ללא רשת); `npm test` ירוק מקומית (31/31).

**הערת התקדמות אחרונה:** הושלם. הפונקציות נכתבו, הטסט עובר מקומית (5 חדשות, 31 בסך הכל).

**שינוי תוכנית:** —

---

### שלב 2 — חיווט הכלי

**Acceptance:**
- [ ] כלי `gcp_project_quota_status` רשום ב-`tools.ts` בתבנית `list_gcp_projects`.
- [ ] `tsc` נקי; 4 שערי ה-CI של הריפו ירוקים על ה-PR.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — פריסה + אימות חי

**Acceptance:**
- [ ] אישור מפורש של Or למיזוג+פריסה (גבול עלות/פעולה).
- [ ] `deploy-mcp-server.yml` הגיע ל-success (poll לפי הפרוטוקול).
- [ ] קריאה חיה ל-`gcp_project_quota_status` מחזירה מספרים אמיתיים; דיווח ל-Or בעברית.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — נכתב הקוד שמושך כמה פרויקטים פעילים, כמה מחוקים, ומתי כל מחוק מתפנה. הבדיקות עוברות.
