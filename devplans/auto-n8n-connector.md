---
dev_name: חיבור Claude↔n8n אוטומטי לכל מערכת חדשה
slug: auto-n8n-connector
opened: 2026-06-06
status: completed
---

# תוכנית פיתוח — חיבור Claude↔n8n אוטומטי לכל מערכת חדשה

## מטרה

שכל מערכת חדשה שנבנית מהפקטורי תקבל לבד את החיבור של Claude ל-n8n שלה דרך השער המרכזי
(`factory-master-actions-mcp`) — בלי שנעשה את זה ידנית כל פעם. השער כבר משרת כל מערכת
אוטומטית; הפער היחיד הוא שאף אחד לא מודיע לאור את כתובת החיבור. לכן בסוף ה-deploy של כל
מערכת, היא שולחת לאור בטלגרם את כתובת ה-connector שלה (URL + "Login with Google", בלי טוקן).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | צעד הודעת connector ב-deploy + תיעוד + רענון גולדן | completed | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`, `templates/system/AGENTS.md.template`, `tests/golden/system/` |
| 2 | אימות על מערכת-בדיקה חיה (live-test loop) | in-progress | (הרצת workflows — בעלות, אושר ע"י אור) |
| 3 | תיקון refresh-system-agents — הרשאת workflows לסנכרון קבצי-workflow | completed | `.github/workflows/refresh-system-agents.yml` |
| 4 | תיקון refresh-system-agents — מיזוג בניסיון-חוזר (בלי checks:read) | in-progress | `.github/workflows/refresh-system-agents.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — צעד הודעת connector ב-deploy + תיעוד + רענון גולדן

**Acceptance:**
- [x] צעד `Telegram connector nudge (success)` נוסף בסוף ה-deploy (אחרי `Emit deploy completed`),
      `if: success()` + `continue-on-error: true`, קורא `telegram-bot-token`/`telegram-chat-id`
      מ-SM של המערכת עצמה, ממסך כל סוד, מדלג אם חסר, ושולח URL `${GATEWAY_BASE}/n8n/${SYSTEM_NAME}/mcp`.
- [x] בולט תיעוד "Claude n8n connector" נוסף ל-`AGENTS.md.template` תחת "What was provisioned".
- [x] הגולדן רוענן (`check-system-golden.sh --update`); שערי `check-system-golden.sh` +
      `check-golden-sync.sh` ירוקים; ה-YAML עובר yamllint.

**הערת התקדמות אחרונה:** הושלם ואומת מקומית מול כל השערים הסטטיים. כתובת השער היא ה-Region URL
היציב, מקודד-קשיח (מבוסס ערכים קבועים: מספר פרויקט בקרה + אזור).

**שינוי תוכנית:** —

---

### שלב 2 — אימות על מערכת-בדיקה חיה (live-test loop)

**Acceptance:**
- [ ] מערכת-בדיקה זמנית מוקמת במצב reuse (`shared_gcp_project=factory-test-25`, 0 מכסה) — **בעלות, דורש אישור אור**.
- [ ] ה-deploy רץ בהצלחה; הצעד החדש מדפיס `[connector-nudge] telegram='ok'`; אור מקבל בטלגרם
      הודעה עם הכתובת `…/n8n/<test-system>/mcp`.
- [ ] (אופציונלי) הוספת connector ב-Claude.ai + Login with Google + קריאת כלי מול ה-n8n של מערכת הבדיקה.

**הערת התקדמות אחרונה:** הוקמה מערכת-בדיקה `tok-conn-test` (reuse, 0 מכסה). ה-PR מוזג ל-main.
ניסיון להחיל את ה-deploy workflow המעודכן על מערכת הבדיקה דרך `refresh-system-agents` נכשל
כי הכלי לא החזיק הרשאת `workflows` (ראה שלב 3). אחרי תיקון שלב 3 → re-run refresh → deploy אמיתי → אימות הנאדג' בטלגרם.

**שינוי תוכנית:** האימות החי קורה אחרי המיזוג (לא לפניו), כי הדרך "לפני מיזוג" (`prove-on-test-system`)
דורשת לחיצות התקנה ידניות של אור — מנוגד לעיקרון "אור לא נוגע בכלום".

---

### שלב 3 — תיקון refresh-system-agents (הרשאת workflows)

**Acceptance:**
- [ ] טוקן ה-broker ב-`refresh-system-agents.yml` מנפיק גם `workflows:write`, כדי שהכלי יוכל
      לסנכרן קבצים תחת `.github/workflows/` (לא רק n8n JSON/Caddyfile).
- [ ] PR ירוק ומוזג; re-run של refresh על `tok-conn-test` עם ה-deploy workflow מצליח לדחוף.

**הערת התקדמות אחרונה:** הושלם ומוזג (PR #322). אחרי התיקון ה-refresh הצליח לדחוף את ה-deploy
workflow ולפתוח PR במערכת הבדיקה — אבל נחשף חסם נוסף (שלב 4).

**שינוי תוכנית:** —

---

### שלב 4 — תיקון refresh-system-agents (מיזוג בניסיון-חוזר)

**Acceptance:**
- [ ] לוגיקת המיזוג ב-`refresh-system-agents.yml` לא תלויה ב-`checks:read` (שאין ל-broker):
      במקום `gh pr checks --watch`, לולאת `gh pr merge` בניסיון-חוזר (GitHub חוסם עד CI ירוק).
- [ ] PR ירוק ומוזג; re-run של refresh על `tok-conn-test` ממזג את ה-PR ומדליק deploy.
- [ ] ה-deploy מסתיים ב-success; הנאדג' מדפיס `[connector-nudge] telegram='ok'`; אור מקבל את ההודעה.

**הערת התקדמות אחרונה:** התיקון מחקה את הדפוס המוכח של `prove-on-test-system` (מיזוג בניסיון-חוזר).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — מעכשיו כל מערכת חדשה תשלח לך בטלגרם, ברגע שהיא מוכנה, את הכתובת לחבר את Claude אליה (עם התחברות Google, בלי שום מפתח).
