---
dev_name: נעילת or-edri-4 (אמת מול טענה) + מנגנון אנטי-דריפט
slug: or-edri-4-liveness-anti-drift
opened: 2026-06-13
status: completed
---

# תוכנית פיתוח — נעילת or-edri-4 ומנגנון אנטי-דריפט

## מטרה

לוודא שכל מה ש"אמור לעבוד" ב-or-edri-4 (המערכת שהולכת יד ביד עם הפקטורי) באמת
עובד — ולתקן/להוכיח כל פער. ואז לבנות מנגנון/skill שגורם למערכת (ולסוכן) להיות
תמיד מודעים לפער בין מה שנטען לעובד לבין מה שבאמת רץ — בלי שאור יצטרך לבקש חקירה.

## רקע (הפערים שנמצאו באודיט 2026-06-13)

- שליחת מייל דרך google_workspace קיימת ומחוברת ל-ops-agent, אבל **מעולם לא הוכחה**
  (ה-smoke בודק רק קריאה). העבודה הכבדה ההיסטורית הייתה על or-adhd-agent (פורקה 11/6).
- **DB Vacuum** — מעולם לא רץ מאז ההקמה (לא מוכח).
- **style-refresh** — נפל היום (באג SQL כפול-stringify), תוקן; צריך אימות יציבות.
- google_workspace **לא מתועד** ב-AGENTS.md של or-edri-4 (לכן הרגיש "לא קיים").
- ה-smoke של workspace ברירת-המחדל הצביעה על or-adhd-agent המתה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הוכחת שליחת מייל (send_gmail_message) + תיקון ברירת-מחדל ל-or-edri-4 | completed | `scripts/google-mcp-smoke.py`, `.github/workflows/google-mcp-smoke.yml` |
| 2 | הוכחת DB Vacuum (exec 427) + style-refresh (exec 428) חיים דרך trigger-system-workflow.yml | completed | הרצות חיות |
| 3 | תיעוד google_workspace + תיקון הערת HITL ישנה ב-AGENTS template + golden | completed | `templates/system/AGENTS.md.template`, `or-edri-4/AGENTS.md`, `tests/golden/system/` |
| 4a | skill `/system-liveness` — דוח-אמת per-workflow על דרישה (מה באמת עובד?) | completed | `.claude/commands/system-liveness.md` |
| 4b | שדרוג שומר-העל ל-per-workflow liveness (תופס "מעולם לא רץ"/"נפל" אוטומטית) | completed | `scripts/run-watchdog.sh`, `monitoring/watchdog-registry.json`, `scripts/tests/run-watchdog.bats` |

> **נסגר 2026-06-13.** כל 4 השלבים הוכחו חי: מייל נחת (smoke 7/7), DB Vacuum (exec 427) + style-refresh (exec 428), google_workspace מתועד (2 PR מוזגו), `/system-liveness` הוכח חי, ושומר-העל per-workflow הוכח בריצה אמיתית (ok=18/red=0) + 48/48 bats.

> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח על קלט אמיתי — לא "CI ירוק" בלבד.
> שלב 1 נסגר כשמייל אמיתי נחת ב-edri2or@gmail.com (הרצת smoke עם send_test_to).
