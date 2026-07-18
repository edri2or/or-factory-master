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
