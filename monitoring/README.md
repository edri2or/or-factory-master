# שומר-העל — Meta-Monitoring Watchdog

אוטומציה אחת **מעל כל האוטומציות**. כל בוקר היא עוברת על כל תהליך אוטומטי רשום, מוכיחה
שהוא באמת רץ ועבד, ושולחת ל-Or דוח טלגרם עם **קישור ישיר** להוכחה לכל שורה. ירוק = הכול
עובד; אם בוקר אחד הדוח לא הגיע — זה עצמו הסימן (dead-man's-switch חיצוני ב-Better Stack).

מבוסס על סטנדרט תעשייה: synthetic monitoring (Google SRE), dead-man's-switch, ו-
policy-as-code catalog. משכפל תבניות קיימות בפקטורי (`scripts/emit-event.sh`,
`.github/workflows/factory-health-audit.yml`, `scripts/check-devplan-updated.sh`).

## הקבצים

| קובץ | תפקיד |
|---|---|
| `monitoring/watchdog-registry.json` | **מקור האמת היחיד** — כל תהליך אוטומטי + איך מוכיחים שעבד. |
| `monitoring/registry-exempt.txt` | רשימת היתר: surfaces שבמכוון לא נרשמים (one-shots/כלים ידניים). |
| `scripts/run-watchdog.sh` | קורא את הפנקס, מבצע הוכחה לכל רשומה, בונה דוח טלגרם בעברית. |
| `.github/workflows/meta-monitoring-watchdog.yml` | מריץ את השומר כל בוקר (05:00 UTC) + dispatch ידני. |
| `scripts/check-watchdog-registry-updated.sh` | שער CI: חוסם הוספת/מחיקת אוטומציה בלי לעדכן את הפנקס. |
| `scripts/create-watchdog-heartbeat.sh` | הקמה חד-פעמית של ה-heartbeat ב-Better Stack. |

## סכמת הפנקס (`watchdog-registry.json`)

```jsonc
{
  "id": "factory-health-audit",          // מפתח יציב, kebab-case, לעולם לא ממוחזר
  "name_he": "בדיקת בריאות Factory",      // השם בעברית לשורת הטלגרם
  "type": "cron-workflow",                // cron-workflow | ci-gate | event-workflow | hook | n8n-workflow
  "layer": "factory",                     // factory | system  (מוזן ל-emit-event --layer)
  "proof_method": "gh-run-freshness",     // gh-run-freshness | gh-branch-protection | static-integrity | n8n-execution
  "cadence": { "cron": "0 */6 * * *", "tolerance_hours": 9 },  // חלון הטריות לבדיקת freshness
  "evidence": { "repo": "edri2or/or-factory-master", "workflow_file": "factory-health-audit.yml" },
  "stage": 1,                             // באיזה שלב פיתוח הרשומה נכנסת לכיסוי
  "enabled": true                         // false = רשומה-אך-לא-נבדקת-עדיין (השער מכריח רישום מוקדם)
}
```

### שיטות הוכחה (`proof_method`)

- **`gh-run-freshness`** (cron + event workflows): שואל את GitHub על הריצות האחרונות ב-main.
  ריצה מוצלחת אחרונה חייבת להיות בתוך `tolerance_hours` (≈ מרווח × 1.5). הסלמה לפי כלל
  **"2 כשלים רצופים"**: כשל אחרון בודד = ⚠️ "עוקב"; שניים רצופים = 🚨. הראיה = `html_url` של הריצה.
- **`gh-branch-protection`** (שערי CI; שלב 2): ה-context עדיין נדרש ב-branch-protection + הריצה
  האחרונה על main ירוקה.
- **`static-integrity`** (hooks; שלב 3): הקובץ קיים, ניתן-להרצה, ועדיין מחווט בנקודת הרישום שלו.
- **`n8n-execution`** (מערכות; שלב 4): ביצוע n8n אחרון מוצלח per-system דרך ה-REST API.

## החוזה: כל אוטומציה חדשה — נרשמת, אחרת ה-CI חוסם

שער ה-CI `scripts/check-watchdog-registry-updated.sh` (תאום `check-devplan-updated.sh`,
מחווט ל-job "Changelog gates") חוסם כל PR שמוסיף/מוחק **surface ניתן-לניטור** —
`.github/workflows/*.yml`, `templates/system/workflows/n8n/*.json`, או hook script — בלי
לעדכן את `watchdog-registry.json` באותו diff. כך השומר לעולם לא "שוכח" אוטומציה.

surface שבמכוון אין לו הוכחה יומית (one-shot, כלי ידני) — מוסיפים אותו ל-`registry-exempt.txt`
במקום לפנקס; זו החלטה מודעת ונבדקת ב-review, לא השמטה שקטה.

## ה-dead-man's-switch (מי שומר על השומר)

השומר עצמו הוא אוטומציה. אם **הוא** ימות בשקט, יפסיק להגיע דוח — ו"אין דוח" יכול להתפרש בטעות
כ"הכול בסדר". לכן השומר מבצע **ping** ל-heartbeat חיצוני ב-Better Stack בכל ריצה. אם ה-ping
מפסיק להגיע (השומר מת/בוטל/ה-cron עצר), Better Stack מתריע **בערוץ חיצוני נפרד** — לא דרך
הפקטורי. הרישום-העצמי בפנקס תופס "השומר רץ אבל נכשל"; ה-heartbeat החיצוני תופס "השומר בכלל לא רץ".

הקמה חד-פעמית: `meta-monitoring-watchdog.yml` עם הקלט `setup_heartbeat=true` (מריץ
`create-watchdog-heartbeat.sh`, יוצר את ה-heartbeat ושומר את כתובתו ב-SM כ-`watchdog-heartbeat-url`).

### בדיקה רבעונית (חובה)

> **dead-man's-switch שלא נבדק גרוע מאין-בכלל.** פעם ברבעון: השבת את ה-ping למחזור אחד, ודא
> ש-Better Stack מתריע, ואז החזר. רשום את הבדיקה ביומן. (הבדיקה הראשונה בוצעה בסוף שלב 1.)
