## הגל הראשון של ריפו-סוכנים (agent-repo-first-wave) — שלב 0

פתיחת פיתוח מדורג (`/dev-stage`) לגל הראשון של ריפו-סוכנים מעל התשתית המוכחת
(`agent-repo-product`, סגור): 3 ריפו-סוכנים אמיתיים — **נחשון** (נתב), **נתן** (מחקר/תכנון),
**ספי** (תיעוד) — מחוברים דרך ה-broker. היכולת החדשה: ה-**fan-out של נחשון** (עובד שמצהיר
על תת-עבודה הנשלחת לסוכן אחר דרך ה-broker), שתוכח לבד (capability-first) לפני בנייה.

שלב 0 הוא scaffolding-תיעוד בלבד (קבצי-md), ולכן אף שער-קוד לא מופעל מלבד שער ה-devplan
שזה הקובץ שמשחרר אותו.

- **`devplans/agent-repo-first-wave.md` (חדש, `status: active`)** — תיק-הפיתוח החי: מטרה, 6
  שלבים (0–5), Acceptance + הוכחה-תפקודית פר-שלב, יומן ל-Or. מצהיר במפורש: **יש יכולת חדשה**
  (ה-fan-out), לכן capability-first Step 0 לא מדולג — שלב 1 (spike זרוק) הוא הוכחת-הלבנה הקשה.
  גבול האבטחה: העובד קריאה-בלבד ואין לו מפתח broker — הוא **מצהיר** ובעל-הרשאה (סשן הפקטורי)
  שולח דרך ה-broker הקיים. ה-workflow האוטונומי נדחה לפיתוח נפרד.
- **`docs/capability-cards/firstwave-fanout.md` (חדש, skeleton, `verdict: pending`)** — כרטיס
  היכולת לפי תקדים `agent-broker-handoff.md`: היכולת הגולמית (נחשון מצהיר על תוכנית-פיצול →
  בעל-הרשאה שולח דרך ה-broker → איסוף → נחשון מאחד), ה-fixture המתוכנן, וקריטריוני ה-go/no-go.
  יתמלא בשלב 1 מהריצה החיה.

אין נגיעה ב-`templates/system/**` (שער הזהב לא נדרס), לא ב-`templates/agent-repo/**` (golden
לא נדרס), ולא בקבצי-התנהגות-בוט (שער ה-E2E no-op). אין שינוי קוד-מוצר ב-MVP — רוכבים על
ה-workflows הקיימים.

## הגל הראשון — שלב 1: הוכחת יכולת ה-fan-out (verdict go)

הוכחה capability-first של היכולת החדשה (ה-fan-out של נחשון) על **ריפו-בדיקה זרוק אחד**
(`zz-fanout-spike`) לפני יצירת ריפויי-אמת. ריפויי ה-`zz-` הקודמים נמחקו, אז אור אישר את
המסלול הזול: ריפו אחד שמשחק נתב+שני אחים+מאחד דרך תג-מצב מהימן `[MODE:SPLIT|WORKER|UNIFY]`.

- **`spikes/firstwave-fanout/` (חדש, זרוק)** — `README.md` (runbook) + `nachshon-router.prompt.md`
  (תיעוד ה-prompt). ה-worker-נתב עצמו חי בענף `spike/firstwave-fanout` בלבד (לא ממוזג; התבנית
  ב-main נשארת גנרית — שער הזהב לא נדרס), והוחל על ריפו-הבדיקה דרך `refresh-agent-repo.yml`.
- **`docs/capability-cards/firstwave-fanout.md`** — `verdict: go` עם ראיות מלאות: SPLIT
  (broker `27699916209`) פלט הצהרה תקינה מוגבלת ל-allow-list, fan-out לשתי תת-משימות, ו-UNIFY
  (broker `27700474510`) שמסנתז את שתי התוצאות. כל ה-run-ids מתועדים.
- **תובנת-עיצוב:** fan-out מקבילי לאותו ריפו עושה מרוץ (artifact `agent-result` משותף); בבנייה
  האמיתית האחים הם ריפויים נפרדים → אין התנגשות, והמנהל מסדר שליחות לאותו ריפו.

ללא שינוי קוד-מוצר: רוכבים על `provision-agent-repo.yml` / `refresh-agent-repo.yml` /
`agent-action.yml` הקיימים. אין נגיעה ב-`templates/agent-repo/**` ב-main (golden לא נדרס).
