<!--
מסמך-תוכנית פיתוח (DEVPLAN). הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: סקיל Google Workspace מאוחד (ריפו + claude.ai)
slug: google-workspace-skill
opened: 2026-06-16
status: completed   # נסגר 2026-06-16 — הסקיל בריפו+מערכות+claude.ai, כולל תיקון ניואנס הזהות
---

# תוכנית פיתוח — סקיל Google Workspace מאוחד

## מטרה

סקיל אחד שהוא **מקור-האמת** לכלי Google המאוחדים (12 השירותים על `edri2or@gmail.com`): מה קיים,
איך מגיעים אליהם בכל הקשר, כללי הבטיחות, ומה לא אפשרי. "מפה, לא מדריך" — מפנה ל-`tools/list`
החי, לא מקבע שמות. יושב בריפו כפקודת `shared` (נשלחת גם לכל מערכת חדשה) + גרסה ל-claude.ai של Or.

> שינוי תהליך-הקמה (פקודת `shared` נוגעת ב-`templates/system/**`), אבל **סקיל סטטי** (אין התנהגות
> רצה) — ההוכחה היא שער הזהב (template-integrity), לא ריצה חיה על or-edri-4. capability-first: דולג
> (אין verb חדש).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הסקיל בריפו (shared command + mirror + golden) | completed | `.claude/commands/google-workspace-guide.md`, `templates/system/.claude/commands/google-workspace-guide.md`, `tests/golden/system/MANIFEST.sha256` |
| 2 | הסקיל ל-claude.ai (צד-Or) | completed | — (תוצר ל-Or) |
| 3 | תיקון ניואנס הזהות (user_google_email = edriorp38) | completed | `.claude/commands/google-workspace-guide.md` + mirror + golden |

---

### שלב 1 — הסקיל בריפו

**Acceptance:**
- [ ] `.claude/commands/google-workspace-guide.md` (`audience: shared`) — מפה-לא-מדריך, מדויק לפקטורי ולמערכות (במערכת = כלי `google_workspace`, HITL).
- [ ] `sync-skills-mirror.sh` → mirror byte-identical; `check-system-golden.sh --update` → שורה אחת בזהב.
- [ ] שערים: check-skills-mirror, check-golden-sync, Changelog gates, devplan, shellcheck/yamllint, secret-scan, supply-chain — ירוקים. אין דיפלוי.

**הוכחה תפקודית (באותו שלב):** ה-CI ירוק; mirror == source; הסקיל מתאר נכון את הכלים החיים (הצלבה מול ה-tools/list). תוכן בלבד — אין התנהגות רצה.

**הוכחת E2E (artifact):** לא-התנהגותי (סקיל סטטי).

**הערת התקדמות אחרונה:** ✅ הושלם ומוזג (PR #489). ה-mirror+golden עודכנו (envsubst הותקן ידנית — ה-hook נכשל בהתקנה).

**שינוי תוכנית:** —

---

### שלב 2 — הסקיל ל-claude.ai (צד-Or)

**Acceptance:**
- [ ] גרסה מאותו ליבה, מותאמת לשימוש אישי של Or; נמסרת לו עם הוראות הוספה ל-claude.ai.
- [ ] Or מאשר שהסקיל בקלוד ונדלק על שאלת Google.

**הוכחה תפקודית (באותו שלב):** Or מוסיף את הסקיל ושאלת Google מדליקה אותו.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם — נמסר ל-Or קובץ סקיל ל-claude.ai והוא הוסיף אותו; Or מקפל את אותו תוכן גם לתוך סקיל `google-workspace-ops` הקיים שלו (אופציה 2, עם פיוס סתירת-הזהות שסיפקתי).

**שינוי תוכנית:** —

---

### שלב 3 — תיקון ניואנס הזהות

claude.ai (בבדיקת הסקיל מול ops הקיים) תפס שהסקיל נקב בחשבון-המידע (edri2or) אך השמיט שאת הפרמטר `user_google_email` מעבירים כ-label `edriorp38`. נוסף קטע "שני שמות, לא לבלבל" לפי `google-identities.md`.

**Acceptance:**
- [ ] קטע זהות בסקיל: data=edri2or; param `user_google_email`=edriorp38 (edri2or נכשל). mirror+golden מעודכנים; שערים ירוקים.

**הוכחה תפקודית (באותו שלב):** check-skills-mirror + golden PASS; הסקיל תואם ל-`google-identities.md`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** העריכה בוצעה; mirror+golden ירוקים. נשאר: PR, CI, מיזוג.

**שינוי תוכנית:** נוסף שלב 3 בעקבות הדיוק ש-claude.ai תפס — הסקיל לא היה שגוי (data=edri2or נכון), רק חסר את ניואנס הפרמטר.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — הסקיל `/google-workspace-guide` נכנס לריפו ולתבנית המערכות (מוזג).
- שלב 2 הושלם — מסרתי לך גרסת claude.ai של הסקיל, והוספת אותה (מתקפלת גם ל-ops הקיים שלך).
- שלב 3 הושלם — תיקנו דיוק קטן שה-Claude שלך תפס: איזה שם מעבירים כפרמטר (edriorp38) מול חשבון-המידע (edri2or).
