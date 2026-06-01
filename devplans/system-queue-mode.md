---
dev_name: queue mode אופציונלי למערכות (scale-by-workers)
slug: system-queue-mode
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — queue mode אופציונלי למערכות

## מטרה

לתת לכל מערכת שה-factory מקים יכולת **אופציונלית** לגדול בעומס: להוסיף תהליכי n8n נפרדים
(workers) שמריצים אוטומציות במקביל דרך תור (Redis + Bull). נדלק פר-מערכת דרך משתנה-ריפו
`QUEUE_MODE` (ברירת-מחדל **כבוי**). מערכת עם המתג כבוי נשארת **זהה-בייט למצב היום** (אפס
רגרסיה, אפס עלות); מערכת דלוקה עולה ~$10–20/חודש (Redis+worker) ומריצה N אוטומציות במקביל
בלי איבוד הרצות. שינוי תהליך-הקמה → מוכח על מערכת-טסט חיה לפני קידום.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מתג `QUEUE_MODE` + מעטפות SM (תשתית רדומה) | completed | `provision-system.yml`, deploy template, golden |
| 2 | שירות Redis מותנה | completed | deploy template, golden |
| 3 | env ראשי מותנה + שירות worker מותנה | completed | deploy template, golden |
| 4 | תיעוד | completed | `docs/roadmap.md`, `AGENTS.md.template`, golden |
| 4b | מתג דרך dispatch input (override) | completed | deploy template, docs, golden |
| 5 | אימות חי (Or-gated) + סגירה | pending | מערכת-טסט reuse |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

**אינווריאנט מרכזי — "זהה-בייט כשכבוי":** כל בלוק queue עטוף ב-`if [ "$QUEUE_MODE" = "true" ]`.
כבוי → לא נוצר Redis, לא נוצר worker, ובלוק ה-env של n8n הראשי שולח **בדיוק אותו אובייקט
15-מפתחות** של היום (מימוש: `BASE15 + QUEUE_EXTRA` כש-`QUEUE_EXTRA='{}'` → בייטים זהים).
קובץ-התבנית עצמו משתנה (מוסיפים bash מותנה) → ה-golden מתרענן בכל שלב; זה נפרד מזהות-הריצה.

**שערי CI בכל PR:** changelog fragment + עדכון התוכנית הזו באותו diff + רענון golden
(`bash scripts/check-system-golden.sh --update`) כשנגעו ב-`templates/system/**`.

**מהלכים בעלות (Or-gated):** הקמת/פריסת מערכת-הטסט וכל teardown — רק באישור מפורש של Or.

---

### שלב 1 — מתג `QUEUE_MODE` + מעטפות SM (תשתית רדומה)

**Acceptance:**
- [x] `provision-system.yml`: 4 מעטפות SM נוספו ל-`RUNTIME_SHELLS` (`railway-redis-service-id`,
      `railway-redis-volume-id`, `railway-worker-service-id`, `redis-password`).
- [x] `provision-system.yml`: `_set_var "QUEUE_MODE" "false"` נוסף לשלב משתני-הריפו.
- [x] deploy template קורא `vars.QUEUE_MODE` ומנרמל ל-`QM` (עדיין בלי שום שירות).
- [x] golden רוענן; שערי "Playground tests" + "Changelog gates" ירוקים.
- [x] off-path לא השתנה (אין שינוי התנהגותי).

**הערת התקדמות אחרונה:** הושלם. 4 מעטפות SM + `QUEUE_MODE=false` נוספו ל-`provision-system.yml`;
ה-deploy template קורא `vars.QUEUE_MODE` ומנרמל ל-`QM` (בלי שירות עדיין). golden רוענן (שורת
hash אחת ל-deploy template); yamllint נקי; compare מקומי PASS. ממתין ל-CI ירוק על PR #276.

**שינוי תוכנית:** —

---

### שלב 2 — שירות Redis מותנה

**Acceptance:**
- [x] בלוק Redis ב-deploy template, עטוף `if [ "$QM" = "true" ]`, אחרי בלוק n8n, בדפוס
      Postgres/Caddy (SM-first → find-by-name → `serviceCreate` → שמירת id ל-SM).
- [x] `redis:7-alpine` + `REDIS_FIRST_TIME` guard; volume (`/data`, מאוגד ב-`environmentId`)
      נשמר ב-`railway-redis-volume-id`.
- [x] `redis-password` נוצר אידמפוטנטית בצד-deploy (reuse-else-`openssl rand`+`versions add`,
      `::add-mask::`).
- [x] startCommand `redis-server --requirepass <pw> --appendonly yes` (AOF) — דרך `serviceInstanceUpdate`.
- [x] golden רוענן; שערים ירוקים; off-path זהה-בייט (הבלוק מדולג).

**הערת התקדמות אחרונה:** הושלם. בלוק Redis מותנה נוסף (image+volume/AOF+password+start-command),
bash -n על כל הסקריפט המוטמע עבר, yamllint נקי, golden רוענן (שורת hash אחת). מנגנון ה-startCommand
ל-Redis ול-worker ייבחן חי בשלב 5 (אם הפניית `$REDIS_PASSWORD` ב-start command לא נתפסת ע"י Railway —
נחליף לערך מילולי ממוסך). ממתין ל-CI ירוק.

**שינוי תוכנית:** —

---

### שלב 3 — env ראשי מותנה + שירות worker מותנה

**Acceptance:**
- [x] env של n8n הראשי: אובייקט הבסיס נשמר verbatim; מיזוג מותנה של `QUEUE_EXTRA`
      (`{}` כשכבוי) עם, כשדלוק: `EXECUTIONS_MODE=queue`, `QUEUE_BULL_REDIS_HOST`
      (`redis.railway.internal`), `QUEUE_BULL_REDIS_PORT=6379`, `QUEUE_BULL_REDIS_PASSWORD`,
      `N8N_DEFAULT_BINARY_DATA_MODE=database`, `N8N_GRACEFUL_SHUTDOWN_TIMEOUT`, ובמיין בלבד
      `N8N_DISABLE_PRODUCTION_MAIN_PROCESS=true` + `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true`.
- [x] שירות worker מותנה (כדפוס השירות-השני של Caddy): `serviceCreate` בשם `worker`,
      אותו `$N8N_IMAGE`, startCommand `n8n worker`, env משותף (DB refs + `N8N_ENCRYPTION_KEY` +
      queue vars + `N8N_DEFAULT_BINARY_DATA_MODE=database` + `N8N_RUNNERS_ENABLED=true` +
      `N8N_GRACEFUL_SHUTDOWN_TIMEOUT`), בלי דומיין/Caddy, `WORKER_FIRST_TIME` guard, id ל-SM.
- [x] golden רוענן; שערים ירוקים; off-path זהה-בייט (`QUEUE_EXTRA={}`, worker מדולג).

**הערת התקדמות אחרונה:** הושלם. זהות-בייט במצב כבוי הוכחה דטרמיניסטית (OLD `{...16...}` == NEW
`{...16...}+{}`); במצב דלוק נוספים 8 מפתחות ללא התנגשות (16+8=24). bash -n עבר, yamllint נקי,
golden רוענן. נקודות לאימות חי (שלב 5): שפקודת `n8n worker` עולה תקין ב-Railway, ושהפניית
`$REDIS_PASSWORD` בפקודת-ההפעלה של Redis נתפסת (אחרת ערך מילולי ממוסך). ממתין ל-CI ירוק.

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [x] `docs/roadmap.md`: מקטע "Phase J" חדש — המתג, ברירת-מחדל כבוי, עלות ~$10–20, Postgres גדל
      מהר יותר (binary ב-DB), והדלקה על מערכת קיימת (re-run deploy עם `QUEUE_MODE=true`; אין back-fill).
- [x] `templates/system/AGENTS.md.template`: מקטע "Queue mode (scaling)" + 4 מעטפות חדשות + bullet.
- [x] golden רוענן (AGENTS תחת `templates/system/**`); שערים ירוקים.

**הערת התקדמות אחרונה:** הושלם. roadmap (Phase J) + AGENTS template עודכנו; golden רוענן (hash של
AGENTS.md + rendered/AGENTS.md). נשאר רק שלב 5 — אימות חי על מערכת-טסט, באישור עלות מ-Or.

**שינוי תוכנית:** —

---

### שלב 4b — מתג דרך dispatch input (override)

**Acceptance:**
- [x] `deploy-railway-cloudflare.yml` מקבל input אופציונלי `queue_mode` ל-`workflow_dispatch`
      שגובר על `vars.QUEUE_MODE` (input לא-ריק מנצח; אחרת נופלים למשתנה; ברירת-מחדל off).
- [x] נרמול `QM` עודכן + אומת בטבלת-אמת (5 מקרים); off-path נשאר זהה-בייט.
- [x] תועד ב-roadmap (Phase J) + AGENTS template; golden רוענן.

**הערת התקדמות אחרונה:** הושלם. פותר את פער ההפעלה — עכשיו הסוכן יכול להדליק queue mode hands-off
דרך dispatch input, בלי כלי להגדרת משתנה-ריפו. גם מאפשר את האימות החי (שלב 5) בלי לגעת במשתנה.

**שינוי תוכנית:** שלב חדש שנוסף תוך כדי. נחשף ש-`QUEUE_MODE` כמשתנה-ריפו בלבד אינו ניתן-להפעלה
hands-off (אין כלי MCP להגדרת משתנה; Or לא נוגע ב-UI). הפתרון: dispatch input שגובר על המשתנה.

### שלב 5 — אימות חי (Or-gated) + סגירה

**Acceptance:**
- [ ] (אישור Or לעלות) הוקמה מערכת-טסט reuse (`shared_gcp_project=factory-test-25`):
      provision → register → deploy.
- [ ] הודלק `QUEUE_MODE=true`, ה-deploy רץ מחדש; אומת חי: N הרצות במקביל בלי איבוד, ה-worker
      מושך מ-Redis, task runners עובדים על ה-worker, `N8N_DEFAULT_BINARY_DATA_MODE=database`.
- [ ] אומת שמערכת עם `QUEUE_MODE` כבוי עולה בריאה וזהה.
- [ ] קודם (merge ל-main בוצע לאורך השלבים); Teardown ledger נרשם; `status: completed`.

**הערת התקדמות אחרונה:** בעיצומו (סבב תיקון #2). אומתו חי על `factory-test-qmode2`: Redis עם
סיסמה+AOF, binary mode=default — אבל Or זיהה שלא הגיעה הודעת "n8n מוכן" בטלגרם. החקירה גילתה
**קריסת-סדר**: ה-n8n הראשי קיבל הגדרות תור והתחבר ל-Redis לפני שה-Redis התייצב; ה-redeploy של
ה-Redis הפיל אותו (`Exiting process due to Redis connection error`), וה-webhook של ה-notifier
חזר 404. **תוקן:** בלוק ה-Redis (כולל המתנה ל-`SUCCESS`) הוקדם אל לפני ה-env של ה-main; הוסר
`N8N_DISABLE_PRODUCTION_MAIN_PROCESS`. off-path זהה-בייט, golden+roadmap עודכנו, bash/yamllint
ירוקים. **נותר:** הקמת `factory-test-qmode3` טרייה (התבנית המתוקנת) → deploy queue_mode=true →
לאמת אין `Queue errored`/קריסה וההודעה נשלחת → לפרק qmode2+qmode3 → לסגור.

**שינוי תוכנית:** האימות החי ירוץ ב**גישת "מזג→הוכח"** (החלטת Or), ולא "הוכח לפני מיזוג". הסיבה:
מצב "דלוק" דורש את 4 מעטפות ה-SM ואת המשתנה `QUEUE_MODE` שרק `provision-system.yml` (נעול ל-main)
יוצר; ה-prover מהענף (`prove-on-test-system.yml`) מביא רק את תבנית ה-deploy, לא את אלה. מצב "כבוי"
כבר מוכח זהה-בייט + ירוק, ואף מערכת קיימת לא מושפעת (opt-in), אז מיזוג-תחילה הוא נתיב הסיכון-הנמוך —
וזו גם הדרך שבה הפקטורי הוכיח את Caddy/Telegram. הרצף: מזג PR #276 → הקם מערכת-טסט reuse →
QUEUE_MODE=true → אמת Redis+worker חי → תקן-קדימה אם צריך → פרק.

---

## מצב מערכת-הטסט (Teardown ledger)

- `factory-test-qmode` — **torn-down — 2026-06-01** (decommission-test-system, בקשת Or; באג ה-binary/Redis התגלה עליה, הוחלפה ב-qmode2).
- `factory-test-qmode2` — alive (סבב התיקון; תפורק יחד עם qmode3 בסגירה).
- `factory-test-qmode3` — תיווצר לאימות סבב #2; תפורק בסגירה.

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הוספנו כפתור `QUEUE_MODE` (כבוי כברירת-מחדל) ו-4 "מגירות" ריקות ב-Secret Manager. שינוי רדום לגמרי; מערכת כבויה נשארת בדיוק כמו היום.
- שלב 2 הושלם — הוספנו את שירות ה-Redis (התור), אבל הוא קם **רק** כשהכפתור דלוק. עדיין קוד בלבד, אפס עלות. מערכת כבויה לא רואה שום שינוי.
- שלב 3 הושלם — חיברנו את n8n לתור והוספנו את העובד (worker), שניהם רק כשהכפתור דלוק. הוכחנו במתמטיקה שמערכת כבויה מקבלת בדיוק אותם משתנים כמו היום, אות-באות. עדיין קוד בלבד, אפס עלות.
- שלב 4 הושלם — תיעדנו את הכל (ב-roadmap ובמסמך שכל מערכת מקבלת): מה הכפתור עושה, כמה זה עולה, ואיך מדליקים על מערכת קיימת. נשאר רק האימות החי.
- שלב 4b הושלם — גילינו שלכפתור לא הייתה דרך הדלקה אוטומטית (אני לא יכול לשנות משתנה, ואתה לא נוגע במסכים), אז הוספנו דרך שנייה: אני יכול להדליק/לכבות בלחיצת-הרצה אחת בלי לגעת בכפתור הקבוע. זה גם פותח את האימות החי.
- שלב 5 בעיצומו — הקמנו מערכת-טסט חיה והדלקנו queue mode. האימות תפס 3 באגים אמיתיים (שאף בדיקה יבשה לא תופסת): ערך אחסון שגוי, Redis בלי סיסמה, ובעיקר — הסדר היה הפוך וה-n8n קרס באמצע (אתה זיהית את זה כשלא הגיעה הודעת טלגרם). כולם תוקנו; נשאר אימות אחרון על מערכת טרייה.
