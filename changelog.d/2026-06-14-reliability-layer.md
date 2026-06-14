## שלב 0 — דוקטרינת רובד-האמינות + מנגנון הוכחה-מענף (source_ref)

קלט-העיצוב לכל הרובד: `docs/reliability-layer.md` מגדיר את קריטריוני-הקבלה 2.x/queue-safe
(HTTP-Request לא Code/env; idempotency-aware; binary-data לא על דיסק; soft-fail), את חוזה
גשר-ה-emit (`POST /factory/<system>/emit`), שלוש שכבות-הגילוי, מגבלת ה-Error-Workflow
(כשל-טריגר נתפס ע"י ה-watchdog, לא ע"י ה-Error-Workflow), וטקסונומיית-האירועים. בנוסף,
`refresh-system-agents.yml` קיבל input אופציונלי `source_ref` — מאפשר להחיל שינוי-טמפלייט
מענף-עבודה לא-ממוזג על מערכת חיה (or-edri-4) לפני המיזוג, בעוד ה-WIF מאמת כברוקר על main
(רק מקור-הטמפלייט משתנה, לא הזהות). אפס שינוי בהתנהגות ברירת-המחדל (source_ref ריק = ההתנהגות
הקודמת בדיוק).

**Changes:** `docs/reliability-layer.md` (חדש), `.github/workflows/refresh-system-agents.yml`,
`devplans/reliability-layer.md` (חדש).
