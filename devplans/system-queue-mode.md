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
| 1 | מתג `QUEUE_MODE` + מעטפות SM (תשתית רדומה) | pending | `provision-system.yml`, deploy template, golden |
| 2 | שירות Redis מותנה | pending | deploy template, golden |
| 3 | env ראשי מותנה + שירות worker מותנה | pending | deploy template, golden |
| 4 | תיעוד | pending | `docs/roadmap.md`, `AGENTS.md.template`, golden |
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
- [ ] `provision-system.yml`: 4 מעטפות SM נוספו ל-`RUNTIME_SHELLS` (`railway-redis-service-id`,
      `railway-redis-volume-id`, `railway-worker-service-id`, `redis-password`).
- [ ] `provision-system.yml`: `_set_var "QUEUE_MODE" "false"` נוסף לשלב משתני-הריפו.
- [ ] deploy template קורא `vars.QUEUE_MODE` ומנרמל ל-`QM` (עדיין בלי שום שירות).
- [ ] golden רוענן; שערי "Playground tests" + "Changelog gates" ירוקים.
- [ ] off-path לא השתנה (אין שינוי התנהגותי).

**הערת התקדמות אחרונה:** <ריק עד שמתחילים>

**שינוי תוכנית:** —

---

### שלב 2 — שירות Redis מותנה

**Acceptance:**
- [ ] בלוק Redis ב-deploy template, עטוף `if [ "$QM" = "true" ]`, אחרי בלוק n8n, בדפוס
      Postgres/Caddy (SM-first → find-by-name → `serviceCreate` → שמירת id ל-SM).
- [ ] `redis:7-alpine` + `REDIS_FIRST_TIME` guard; volume (`/data`, מאוגד ב-`environmentId`)
      נשמר ב-`railway-redis-volume-id`.
- [ ] `redis-password` נוצר אידמפוטנטית בצד-deploy (reuse-else-`openssl rand`+`versions add`,
      `::add-mask::`).
- [ ] startCommand `redis-server --requirepass <pw> --appendonly yes` (AOF) — דורש override.
- [ ] golden רוענן; שערים ירוקים; off-path זהה-בייט (הבלוק מדולג).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — env ראשי מותנה + שירות worker מותנה

**Acceptance:**
- [ ] env של n8n הראשי: אובייקט 15-המפתחות נשמר verbatim; מיזוג מותנה של `QUEUE_EXTRA`
      (`{}` כשכבוי) עם, כשדלוק: `EXECUTIONS_MODE=queue`, `QUEUE_BULL_REDIS_HOST`
      (`redis.railway.internal`), `QUEUE_BULL_REDIS_PORT=6379`, `QUEUE_BULL_REDIS_PASSWORD`,
      `N8N_DEFAULT_BINARY_DATA_MODE=database`, `N8N_GRACEFUL_SHUTDOWN_TIMEOUT`, ובמיין בלבד
      `N8N_DISABLE_PRODUCTION_MAIN_PROCESS=true` + `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true`.
- [ ] שירות worker מותנה (כדפוס השירות-השני של Caddy): `serviceCreate` בשם `worker`,
      אותו `$N8N_IMAGE`, startCommand `worker`, env משותף זהה (DB refs + `N8N_ENCRYPTION_KEY` +
      queue vars + `N8N_DEFAULT_BINARY_DATA_MODE=database` + `N8N_RUNNERS_ENABLED=true` +
      `N8N_GRACEFUL_SHUTDOWN_TIMEOUT`), בלי דומיין/Caddy, `WORKER_FIRST_TIME` guard, id ל-SM.
- [ ] golden רוענן; שערים ירוקים; off-path זהה-בייט (`QUEUE_EXTRA={}`, worker מדולג).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [ ] `docs/roadmap.md`: מקטע חדש — המתג, ברירת-מחדל כבוי, עלות ~$10–20, Postgres גדל מהר יותר
      (binary ב-DB), והדלקה על מערכת קיימת (re-run deploy עם `QUEUE_MODE=true`; אין back-fill).
- [ ] `templates/system/AGENTS.md.template`: הערה קצרה על אפשרות queue mode.
- [ ] golden רוענן (AGENTS תחת `templates/system/**`); שערים ירוקים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — אימות חי (Or-gated) + סגירה

**Acceptance:**
- [ ] (אישור Or לעלות) הוקמה מערכת-טסט reuse (`shared_gcp_project=factory-test-25`):
      provision → register → deploy.
- [ ] הודלק `QUEUE_MODE=true`, ה-deploy רץ מחדש; אומת חי: N הרצות במקביל בלי איבוד, ה-worker
      מושך מ-Redis, task runners עובדים על ה-worker, `N8N_DEFAULT_BINARY_DATA_MODE=database`.
- [ ] אומת שמערכת עם `QUEUE_MODE` כבוי עולה בריאה וזהה.
- [ ] קודם (merge ל-main בוצע לאורך השלבים); Teardown ledger נרשם; `status: completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

<יתמלא בסגירה: `torn-down — <תאריך/סשן>` או `left-alive by user decision — <תאריך/סשן>`>

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- <מתמלא תוך כדי>
