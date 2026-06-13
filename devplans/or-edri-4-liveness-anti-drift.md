---
dev_name: נעילת or-edri-4 (אמת מול טענה) + מנגנון אנטי-דריפט
slug: or-edri-4-liveness-anti-drift
opened: 2026-06-13
status: active
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
| 1 | הוכחת שליחת מייל (send_gmail_message) + תיקון ברירת-מחדל ל-or-edri-4 | in-progress | `scripts/google-mcp-smoke.py`, `.github/workflows/google-mcp-smoke.yml` |
| 2 | תיקון+הוכחה של הפערים: DB Vacuum, style-refresh, ותיעוד google_workspace ב-AGENTS.md | pending | `or-edri-4/AGENTS.md`, הרצות חיות |
| 3 | נעילת or-edri-4: מעבר liveness מלא על כל אוטומציה (ריצה מוצלחת טרייה + כלים מחוברים) | pending | טבלת ראיות |
| 4 | מנגנון אנטי-דריפט (skill + הרחבת e2e-surfaces/system-runtime-audit) — מחקר מקטעי + אינטרנט | pending | `e2e-surfaces.json`, `system-runtime-audit.yml`, skill חדש |

> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח על קלט אמיתי — לא "CI ירוק" בלבד.
> שלב 1 נסגר כשמייל אמיתי נחת ב-edri2or@gmail.com (הרצת smoke עם send_test_to).
