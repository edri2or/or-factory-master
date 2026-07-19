---
dev_name: פקודת /new-system (יכולת חוזרת להקמת מערכת אחות)
slug: new-system-command
opened: 2026-07-19
status: completed   # נמסר במלואו ב-PR אחד
---

# תוכנית פיתוח — פקודת /new-system

## מטרה

לתעש את התהליך שבו נבנתה or-agents לפקודה חוזרת `/new-system`, כדי ש-Or יוכל להקים מערכת אחות
חדשה באותה דרך בדיוק — בלי לחקור מחדש ובלי לגלות שוב את המהמורות שכבר פתרנו (בעיקר Caddy).
החלטת Or (2026-07-19): כלי-ההקמה נשאר קבוע ב-factory (לא נמחק/משוחזר בכל פעם).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | החזרת המנוע כקבוע | completed | `.github/workflows/bootstrap-system-infra.yml`, `scripts/copy-generic-secrets.sh` |
| 2 | תבנית-זהב | completed | `templates/new-system/**` |
| 3 | הפקודה + תיעוד | completed | `.claude/commands/new-system.md`, `CLAUDE.md` |

> הוכחה: הרכיבים נמסרו וה-CI ירוק. הרצה חיה של `/new-system` **לא** מבוצעת כאן (מקימה מערכת עם עלות);
> האימות התפקודי האמיתי הוא בפעם הבאה ש-Or ירצה מערכת חדשה. השלד של or-agents הוא ההוכחה שהתהליך עובד.

## יומן ל-Or (עברית)

- `/new-system` מוכן: פקודה אחת שמקימה מערכת אחות חדשה כמו or-agents, עם כל התיקונים מוטבעים.
