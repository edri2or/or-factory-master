# פנקס-האוטומציות — watchdog-registry

קטלוג יחיד של כל אוטומציה בריפו, ושער-CI שמכריח לשמור אותו מעודכן. כשמוסיפים או מוחקים
**surface ניתן-לניטור** (workflow עם cron/schedule, workflow מונע-אירוע, או hook script) —
שער-ה-CI חוסם את ה-PR אם לא עודכן `watchdog-registry.json` (או `registry-exempt.txt`) באותו diff.
כך הקטלוג לעולם לא "שוכח" אוטומציה.

> **הערת-אמת (קיפול or-aios, 2026-07-18).** בעבר היה כאן גם **מנוע יומי** ("שומר-על"/watchdog) שרץ כל
> בוקר, הריץ הוכחה לכל רשומה בפנקס, שלח דוח טלגרם, ופינג ל-dead-man's-switch ב-Better Stack. **המנוע
> הזה פורק** בקיפול: `meta-monitoring-watchdog.yml` (אצווה 1), `scripts/run-watchdog.sh` +
> `scripts/create-watchdog-heartbeat.sh` + ה-heartbeat (אצווה 5א + מחיקת הסוד `watchdog-heartbeat-url`),
> וכן מנגנון "מניעת סחיפת-תיעוד" הנפרד (`check-doc-facts`/`check-doc-binding` + `docs/doc-drift-prevention.md`,
> אצווה 7). **מה ששרד: הפנקס עצמו + רשימת-ההיתר + שער-ה-CI.** כלומר הפנקס הוא היום **קטלוג שהשער שומר
> מעודכן — אך איש לא מריץ את ההוכחות היומיות שלו** (שדה `proof_method` נשאר ברשומות כשריד לא-פעיל).

## הקבצים (מה שחי)

| קובץ | תפקיד |
|---|---|
| `monitoring/watchdog-registry.json` | הקטלוג — כל אוטומציה רשומה, kebab-case id יציב. |
| `monitoring/registry-exempt.txt` | רשימת-היתר: surfaces שבמכוון לא נרשמים (one-shots/כלים ידניים/tombstones). |
| `scripts/check-watchdog-registry-updated.sh` | שער-ה-CI — מחווט ל-`changelog-check.yml` (job "Changelog gates"). |

## החוזה: כל אוטומציה חדשה — נרשמת, אחרת ה-CI חוסם

שער ה-CI `scripts/check-watchdog-registry-updated.sh` (תאום `check-devplan-updated.sh`) חוסם כל PR
שמוסיף/מוחק **surface ניתן-לניטור** — `.github/workflows/*.yml`, `templates/system/workflows/n8n/*.json`,
או hook script — בלי לעדכן את `watchdog-registry.json` באותו diff.

surface שבמכוון אין לו רישום (one-shot, כלי ידני, או workflow שנמחק ומושאר כ-tombstone) — מוסיפים
אותו ל-`registry-exempt.txt` במקום לפנקס; זו החלטה מודעת ונבדקת ב-review, לא השמטה שקטה.

## סכמת רשומת-פנקס (`watchdog-registry.json`)

מי שמוסיף workflow חדש חייב להוסיף רשומה כזו (או להוסיף את הקובץ ל-`registry-exempt.txt`):

```jsonc
{
  "id": "factory-health-audit",          // מפתח יציב, kebab-case, לעולם לא ממוחזר
  "name_he": "בדיקת בריאות Factory",      // שם בעברית
  "type": "cron-workflow",                // cron-workflow | ci-gate | event-workflow | hook | n8n-workflow
  "layer": "factory",                     // factory | system
  "proof_method": "gh-run-freshness",     // שריד לא-פעיל (המנוע שהריץ אותו פורק) — נשמר לתאימות סכמה
  "cadence": { "cron": "0 */6 * * *", "tolerance_hours": 9 },
  "evidence": { "repo": "edri2or/or-factory-master", "workflow_file": "factory-health-audit.yml" },
  "stage": 1,
  "enabled": true
}
```

> `proof_method`/`cadence`/`evidence` תוארו במקור בשביל המנוע היומי שהריץ הוכחות. מאחר שהמנוע פורק,
> השדות האלה כיום תיעודיים בלבד — אך נשמרים כדי שהשער והסכמה יישארו יציבים אם אי-פעם יוחזר מנוע.
