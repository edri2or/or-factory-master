---
dev_name: רשימת-הרשאות לפקודות טרמינל (allowlist)
slug: permission-allowlist
opened: 2026-07-18
status: completed
---

# תוכנית פיתוח — רשימת-הרשאות לפקודות טרמינל (permission-allowlist)

## מטרה
להפסיק את בקשות-האישור החוזרות ("Allow once / Deny") שקפצו על *כל* פקודת טרמינל בשלבי
פיתוח ובדיקות — כולל פקודות תמימות כמו `cd`/`echo`. הוספת `permissions.allow` ל-`.claude/settings.json`
המסונכרן-לריפו מאשרת אוטומטית פקודות בטוחות, ושומרת אישור-לפני-ביצוע לפעולות מסוכנות.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הוספת `permissions.allow` (allowlist מאוזן) | completed | `.claude/settings.json` |
| 2 | הרחבה לכיסוי *כל* פקודות הקריאה הנפוצות | completed | `.claude/settings.json` |
| 3 | PreToolUse hook לביטול חלון `cd && git` | completed | `.claude/hooks/allow-safe-bash.sh`, `.claude/settings.json` |

### שלב 1 — הוספת allowlist מאוזן

**Acceptance:**
- [x] `.claude/settings.json` מכיל `permissions.allow` עם פקודות פיתוח/בדיקה בטוחות.
- [x] ה-`hooks` הקיים נשמר; ה-JSON תקין.
- [x] פעולות מסוכנות (`git push`, `rm`, `gcloud`, `sudo`, deploy) נשארות מחוץ ל-allowlist → ממשיכות לבקש אישור.

**הוכחה תפקודית (באותו שלב):** תוכן/הגדרות בלבד — אין התנהגות-ריצה חדשה במערכת. אומת ב-`jq`:
הכלל `Bash(cd:*)` קיים ב-`.permissions.allow`, ו-`.hooks.SessionStart` עדיין קיים (המיזוג לא מחק).
בפועל, בהמשך אותה שיחה פקודות קריאה שגרתיות רצות ללא חלון-אישור, בעוד `rm` עדיין פותח אישור.

**הוכחת E2E (artifact):** לא-התנהגותי — אינו נוגע בקבצי-התנהגות של הבוט (`workflows/n8n/*.json` /
`configure-agent-router.yml`).

### שלב 2 — הרחבה לכיסוי כל פקודות הקריאה

**רקע:** Or ביקש במפורש שלפחות *כל* פעולות הקריאה ירוצו בלי אישור. שלב 1 כיסה את הנפוצות; שלב זה
משלים את השאר.

**Acceptance:**
- [x] נוספו ל-`permissions.allow` פקודות read-only נוספות (`stat`/`file`/`du`/`df`/`printenv`/`cut`/
  `tr`/`readlink`/`realpath`/`basename`/`dirname`/`od`/`xxd`/`strings`/`sha256sum`/`date`/`ps`/… +
  תת-פקודות git-קריאה `blame`/`cat-file`/`ls-tree`/`reflog`/`grep`/…).
- [x] `env` נוסף כהתאמה-מדויקת (`Bash(env)`) ולא `env:*` — למניעת `env VAR=x <cmd>` שרירותי.
- [x] קריאות-רשת (`curl`/`wget`) וכל כתיבה/מחיקה נשארו מחוץ ל-allowlist → ממשיכות לבקש אישור.
- [x] JSON תקין; `.hooks` נשמר. (allow: 110 כללים.)

**הוכחה תפקודית (באותו שלב):** תוכן/הגדרות בלבד. אומת ב-`jq`: `Bash(stat:*)` ו-`Bash(env)` קיימים,
`.hooks.SessionStart` נשמר, `jq empty` עובר.

**הוכחת E2E (artifact):** לא-התנהגותי — אינו נוגע בקבצי-התנהגות של הבוט.

### שלב 3 — PreToolUse hook לביטול חלון `cd && git`

**רקע:** חקירה מול התיעוד הרשמי גילתה שהחלון על `cd <dir> && git …` הוא כלל-בטיחות מבני קשיח
ש**אף** כלל ב-`permissions.allow` לא עוקף (git עלול להריץ hooks מהתיקייה). המנגנון היחיד שגם
מבטל אותו, גם אכיף, גם נשמר בריפו, וגם שומר על עמדה מאוזנת — `PreToolUse` hook.

**Acceptance:**
- [x] `.claude/hooks/allow-safe-bash.sh` מחזיר `allow` רק כשכל מקטע בקבוצה הבטוחה ואין תחביר-סיכון.
- [x] לעולם לא מחזיר `deny` — יכול רק להסיר פרומפט, לא להוסיף/לחסום.
- [x] מסוכן (rm/gcloud/sudo/curl/wget/git push/deploy) מחוץ לקבוצה → נופל לפרומפט.
- [x] רשום ב-`hooks.PreToolUse` (matcher `Bash`); שאר ה-hooks נשמרו.
- [x] אושר במפורש ע"י Or (הורדת פיקוח מודעת לקבוצה הבטוחה).

**הוכחה תפקודית (באותו שלב):** shellcheck נקי; 12 מקרי pipe-test — שרשראות בטוחות (`cd repo && git
status …`, `cat | grep`, `git -C … status`, `npm test`) → `allow`; מסוכן (`rm -rf`, `cd && rm`,
`git push`, `curl`, `echo > file`, `$(…)`, `gcloud`) → שותק (פרומפט). ⚠️ הפעלה חיה נכנסת לתוקף
רק בסשן חדש אחרי מיזוג (טעינת hook חדש).

**הוכחת E2E (artifact):** לא-התנהגותי — אינו נוגע בקבצי-התנהגות של הבוט.
