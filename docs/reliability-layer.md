# רובד ניהול-אוטומציות אמין (Reliability Layer)

מסמך זה הוא ה**דוקטרינה** של רובד-האמינות שהפקטורי מתקין בכל מערכת — קיימת וחדשה.
הוא קלט-העיצוב לכל השלבים שמממשים את הרובד (ראו `devplans/reliability-layer.md`).
המטרה היחידה של הרובד: לסגור את פער ה**כשל-השקט** — workflow שנפל, אוטומציה שהפסיקה
לרוץ, או "רץ אבל לא עשה כלום" — לא ייפול בשקט.

> **factory-native first.** הרובד מרחיב את התשתית הקיימת (`scripts/emit-event.sh`
> ↔ `services/mcp-server/src/observability-client.ts`, ה-watchdog, Better Stack,
> `system-runtime-audit.yml`) — הוא לא בונה stack חדש. כל מנגנון חדש חייב להיות בטוח תחת
> n8n 2.x (Task Runners) ומצב-תור.

---

## 1. הבעיה — כשל שקט

כל מערכת מריצה ~24 אוטומציות n8n. שלוש צורות של כשל-שקט אומתו בקוד:

1. **workflow שנפל בלי התראה.** אף אחד מ-24 ה-workflows לא מגדיר `settings.errorWorkflow`,
   וכולם נשענים על `onError: "continueRegularOutput"` ברמת-הצומת — שבולע את הכשל ומחזיר
   פלט ריק כאילו הצליח (`templates/system/workflows/n8n/db-vacuum.json`,
   `spend-track.json`, ...). קרון שנכשל נראה זהה לקרון שהצליח.
2. **אוטומציה שהפסיקה לרוץ.** אין אות "אני חי" פר-אוטומציה ואין זיהוי-היעדר על קצב-ההרצה.
3. **"רץ אבל לא עשה כלום".** workflow שהצליח טכנית אך הפיק פלט ריק/שגוי — בלי assertion
   על הפלט, זה נראה כהצלחה מלאה.

---

## 2. קריטריוני-קבלה — 2.x / queue-safe (מחייב כל מנגנון ברובד)

כל צומת/מנגנון שמתווסף לרובד חייב לעמוד בכל אלה:

1. **HTTP-Request node, לא Code/`$env`.** ב-n8n 2.x ה-Code רץ ב-Task Runner מבודד; אסור
   להסתמך על `process.env`/גישת-סביבה בתוך Code. כל פליטת-אירוע/heartbeat נעשית דרך צומת
   **HTTP Request** רגיל (עם credential), לא דרך Code שניגש לסביבה.
2. **idempotency-aware.** ping/emit חוזר לא יוצר רעש: heartbeat הוא `severity:info`
   (Axiom בלבד), ו-Linear מבצע dedup ל-24ש. אין הסתמכות על "בדיוק פעם אחת".
3. **binary-data לא על ה-filesystem.** מצב-תור דורש `N8N_DEFAULT_BINARY_DATA_MODE=database`
   (כבר מוגדר ב-`deploy-railway-cloudflare.yml`). צמתי-הרובד לא כותבים קבצים זמניים ולא
   נשענים על binary על דיסק.
4. **soft-fail.** כשל בצומת-הרובד עצמו (ה-HTTP emit) לעולם לא מפיל את ה-workflow העסקי —
   הצומת מוגדר `onError: "continueRegularOutput"`.

---

## 3. גשר ה-emit מ-n8n → Observability

אין כיום מסלול שדרכו workflow ב-n8n פולט אירוע (ה-`emit-event.sh` הוא סקריפט-CI, לא נגיש
מתוך n8n; ה-routes הקיימים `/factory/<sys>/mcp` ו-`/n8n/<sys>/mcp` לא חושפים emit). הרובד
בונה **route דק** בשער (gateway) שמשתמש מחדש ב-`emitEvent()` הקיים:

**`POST /factory/<system>/emit`** (ב-`services/mcp-server/`):
- **אימות:** זהה בדיוק ל-`/factory/<system>/mcp` הקיים — bearer מסוג `factory-runtime`
  הקשור לאותה מערכת (או bearer מפעיל). הזהות (`system`, `layer:"system"`) נגזרת מה-claim
  החתום **בצד-השרת**, לא מגוף-הבקשה.
- **גוף:** `{ name, severity, body, action_required }` בלבד — מוגבל ומאומת.
- **סינקים:** קורא ל-`emitEvent()` בצד-השרת → Axiom (תמיד) + Telegram (warning+) + Linear
  (error+ / action_required). כל הסודות נשארים בצד-השרת; n8n לא מחזיק אף מפתח-סינק.
- **הקשחה:** rate-limit פר-מערכת (429) כמפסק-זרם, kill-switch `FACTORY_EMIT_ALLOWED_SYSTEMS`.

**איך n8n ניגש:** צומת HTTP-Request עם ה-credential הקיים `Factory MCP` (httpBearerAuth
שכבר נטבע ב-provision, נושא `factory-mcp-bearer`), אל `@@GATEWAY_EMIT_URL@@`.

> זהו משטח-כתיבה מרכזי חדש. הוא נפרס דרך `deploy-mcp-server.yml` (לא נוגע ב-golden),
> ומשתמש מחדש בשרשרת-האימות המוכחת של ה-route הקיים — ראו שלב 1 ב-`devplans/reliability-layer.md`.

---

## 4. שלוש שכבות גילוי

| שכבה | מה | מנגנון | עלות |
|---|---|---|---|
| (i) אות חיובי "רץ והצליח" | heartbeat בסוף כל קרון קריטי | HTTP-Request → emit `factory.automation.heartbeat` (`info` → Axiom) | חינם, ללא תקרה |
| (ii) זיהוי-היעדר "הפסיק לרוץ" | בדיקת-קצב פר-workflow ב-watchdog | `n8n-workflow-cadence` (גיל הריצה האחרונה מול קצב-צפוי) | חינם, fan-out |
| (iii) heartbeat חיצוני | dead-man של ה-watchdog עצמו בלבד | Better Stack heartbeat קיים (יחיד) | בתוך התקרה (10) |

**Better Stack נשאר ב-0 monitors חדשים** (תקרת free = 10, `scripts/create-uptime-monitor.sh`).
האות החיובי הוא emit ל-Axiom; זיהוי-ההיעדר הוא ה-watchdog. ה-heartbeat החיצוני היחיד הוא
של ה-watchdog (מי שומר על השומר). שכבה (ii) עצמאית משכבה (i): היא מודדת גיל-ריצה ישירות,
אז היא עובדת גם אם ה-heartbeat נעדר.

---

## 5. מגבלת ה-Error Workflow (חשוב לתעד)

ה-Error Workflow של n8n נורה רק כשקיים **ביצוע שמור** של workflow שצומת בתוכו נכשל. אם
**צומת-הטריגר עצמו** נכשל (scheduleTrigger שלא ירה, webhook שכשל לפני גוף ה-workflow) —
n8n לא יוצר ביצוע ולא מפעיל את ה-Error Workflow. לכן:

- **כשל בגוף ה-workflow** → נתפס ע"י ה-Error Workflow (שלב 1).
- **כשל בטריגר / "לא ירה בכלל"** → נתפס ע"י ה-watchdog: בדיקת ה-cadence (שכבה ii) +
  בדיקת ה-liveness הקיימת שמסמנת scheduled-workflow שמעולם-לא-רץ (`(never)` ב-`run-watchdog.sh`).

השניים משלימים; אף אחד לבדו לא מספיק.

---

## 6. טקסונומיית האירועים

| אירוע | חומרה | מתי |
|---|---|---|
| `factory.n8n.workflow_failed` | error + action_required | צומת ב-workflow נכשל (דרך ה-Error Workflow) |
| `factory.automation.heartbeat` | info | קרון קריטי הגיע לסוף בהצלחה |
| `factory.automation.empty_result` | warning | assertion "רץ אבל ריק" נכשל |

אירועי `factory.runtime_audit.*` הקיימים נשארים כפי שהם.

---

## 7. הוכחה חיה לשינוי לא-ממוזג (`source_ref`)

כדי להוכיח שינוי-טמפלייט שעוד לא מוזג, על מערכת חיה (`or-edri-4`), לפני המיזוג:
`refresh-system-agents.yml` קיבל input אופציונלי **`source_ref`** — מעתיק את הטמפלייטים
מענף-העבודה במקום מ-main, בעוד ה-WIF עדיין מאמת כברוקר על main (רק מקור-הטמפלייט משתנה,
לא הזהות). זהו צעד-ה"החלה" של לולאת ההוכחה-החיה של `/dev-stage-factory`. ה-proof לשער-ה-E2E
של הפקטורי מופק **בנפרד** ע"י `e2e-verify.yml` (`system_name=or-edri-4`, `target_ref=<branch>`),
שמריץ הודעה אמיתית דרך מסלול ה-inbound ומחתים `e2e-proofs/<slug>.json` על הענף.

הבלוק-הפנימי של `refresh-system-agents.yml` שמפיק הוכחת-E2E ב-repo של המערכת (כדי למזג את
ה-refresh PR במערכת ש-אוכפת שער-E2E) נשאר ללא שינוי — הוא הצורך-הלגיטימי של *המערכת*,
מנותק מ-proof-הפקטורי לעיל.

---

## 8. תבנית "רץ אבל ריק" (assertion)

Stage 1 (Error Workflow) תופס כשל **לא-נתפס** (צומת שזרק). אבל הדפוס הנפוץ בקרונים הוא
`onError: "continueRegularOutput"` — הצומת נכשל אך "ממשיך" עם פלט ריק, ולכן הביצוע
**status=success** למרות שלא עשה כלום. את הפער הזה לא תופס לא ה-Error-Workflow (אין כשל) ולא
ה-watchdog (הריצה האחרונה "הצליחה"). **התבנית:** מיד אחרי העבודה, צומת **IF** בודק
**אינווריאנט-פלט** ("האם באמת קרה משהו?"); על הפרה — צומת **HTTP-Request** פולט
`factory.automation.empty_result` (`severity:warning`) לאותו route emit, עם
`onError:continueRegularOutput` (לעולם לא מפיל את הקרון). על ריצה בריאה — שקט.

**דוגמה מחווטת (`spend-track.json`):** הצומת `Compute Delta` כבר מחשב `ok` (=`false` כשקריאת
ה-usage מ-OpenRouter נכשלה). צומת `Assert Spend Read` (IF על `$json.ok === false`) → צומת
`Emit Empty Result` (warning עם `reason`). כך "spend-track רץ אבל לא הצליח לקרוא את ההוצאה"
מתריע — במקום להיבלע. כל קרון יכול לאמץ את אותה תבנית עם האינווריאנט שלו.

---

## 9. השלבים והסדר

ראו `devplans/reliability-layer.md`. סדר-התלות:
`0 → (1,4) → (2,5) → 3 → 7 → 6 → 8 → 9`.

---

## 10. אימות queue / Task-Runner (שלב 7)

כל הצמתים שהרובד הוסיף הם **HTTP-Request** (לא Code/`$env`) — בטוחים תחת ה-Task Runner של n8n 2.x
(`N8N_RUNNERS_ENABLED=true`, sandbox שמסיר גישת-סביבה) ותחת מצב-תור. אומת חי על or-edri-4:
ה-error-handler (Error Trigger→HTTP) רץ בהצלחה (ביצוע 552, שלב 1), וצמתי ה-assertion ב-spend-track
יובאו ורצו דרך ה-configure (שלב 5) — תחת אותו runtime חי. binary-data לא נוגע ב-filesystem
(`N8N_DEFAULT_BINARY_DATA_MODE=database`, כבר מ-`n8n-2x-upgrade`). אין שינוי deploy.

## 11. סיכום-צי אמינות (שלב 6)

`fleet-rollup.yml` (יומי 06:30 UTC + manual) שואל את Axiom (read-only) על אירועי-האמינות בחלון
(`factory.n8n.workflow_failed`/`automation.empty_result`/`runtime_audit.failed`) חוצה-מערכות, ופולט
דייג'סט אחד דרך `emit-event.sh`: צי-נקי = `info` (Axiom בלבד); אירועים בחלון = `warning` → Telegram.
soft-fail מלא (token בלי query-scope / תשובה לא-נפרסת → note מנוון, לעולם לא נכשל). זה ה**משלים
ההיסטורי** ל-watchdog (שמסכם מצב-נוכחי יומי) ול-runtime-audit (בריאות פר-מערכת). **Grafana** = אופציה
דחויה מסומנת (דשבורד עשיר על אותו dataset של Axiom) — לא נדרשת ל-v1.

> **Follow-up (תיעוד כן):** ההרצה החיה הראשונה הראתה שה-workflow + ה-soft-fail עובדים (Axiom החזיר
> HTTP 400, ה-run **הצליח**, נפלט `factory.fleet_rollup.degraded`, שום דבר לא נשבר). 400 (לא 403) =
> ה-token התקבל אך גוף-הבקשה זקוק לכיוונון: ככל הנראה `startTime`/`endTime` בגוף + פירוס תשובת
> `tabular` (ערכים ב-columns, לא כ-objects). זהו follow-up ממוקד שדורש גישת-Axiom חיה לכיוונון-אחד —
> לא בוצע בעיוורון. בינתיים ה-watchdog (מצב-נוכחי) + runtime-audit מספקים את תצוגת-הצי.

## 12. Retrofit למערכות קיימות (שלב 8)

מערכות **חדשות** נולדות עם כל הרובד (התבניות מקובעות ב-`main`: error-handler + הזרקת errorWorkflow +
substitution גלובלי + assertion + readiness; וה-watchdog factory-side מכסה כל מערכת). מערכת **קיימת**
שכבר פרוסה מקבלת את הרובד **בלי re-provision** דרך:
`refresh-system-agents.yml system_name=<sys> paths=workflows/n8n,.github/workflows/configure-agent-router.yml post_merge_workflow=configure-agent-router.yml`
(מ-main, אחרי מיזוג) — מייבא error-handler + מזריק errorWorkflow + ה-assertion ל-n8n החי. כל הרצה
חיה **באישור Or**. שדרוג ה-readiness (שלב 4, factory-side) מכסה כבר את כולן. כיום or-edri-4 היא המערכת
החיה היחידה — וכבר מותקנת (הוכחות שלבים 1+5); ה-runbook הוא למערכות עתידיות.
