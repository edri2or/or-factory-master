<!--
מסמך-תוכנית פיתוח (DEVPLAN). הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: סקיל Google Workspace מאוחד (ריפו + claude.ai)
slug: google-workspace-skill
opened: 2026-06-16
status: active
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
| 1 | הסקיל בריפו (shared command + mirror + golden) | in-progress | `.claude/commands/google-workspace-guide.md`, `templates/system/.claude/commands/google-workspace-guide.md`, `tests/golden/system/MANIFEST.sha256` |
| 2 | הסקיל ל-claude.ai (צד-Or) | pending | — (תוצר ל-Or) |

---

### שלב 1 — הסקיל בריפו

**Acceptance:**
- [ ] `.claude/commands/google-workspace-guide.md` (`audience: shared`) — מפה-לא-מדריך, מדויק לפקטורי ולמערכות (במערכת = כלי `google_workspace`, HITL).
- [ ] `sync-skills-mirror.sh` → mirror byte-identical; `check-system-golden.sh --update` → שורה אחת בזהב.
- [ ] שערים: check-skills-mirror, check-golden-sync, Changelog gates, devplan, shellcheck/yamllint, secret-scan, supply-chain — ירוקים. אין דיפלוי.

**הוכחה תפקודית (באותו שלב):** ה-CI ירוק; mirror == source; הסקיל מתאר נכון את הכלים החיים (הצלבה מול ה-tools/list). תוכן בלבד — אין התנהגות רצה.

**הוכחת E2E (artifact):** לא-התנהגותי (סקיל סטטי).

**הערת התקדמות אחרונה:** הסקיל נכתב, ה-mirror+golden עודכנו (envsubst הותקן ידנית — ה-hook נכשל בהתקנה). נשאר: changelog, קומיט, PR, CI ירוק, אישור Or למיזוג.

**שינוי תוכנית:** —

---

### שלב 2 — הסקיל ל-claude.ai (צד-Or)

**Acceptance:**
- [ ] גרסה מאותו ליבה, מותאמת לשימוש אישי של Or; נמסרת לו עם הוראות הוספה ל-claude.ai.
- [ ] Or מאשר שהסקיל בקלוד ונדלק על שאלת Google.

**הוכחה תפקודית (באותו שלב):** Or מוסיף את הסקיל ושאלת Google מדליקה אותו.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- (מתמלא תוך כדי)
