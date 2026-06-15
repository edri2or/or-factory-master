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

## שלב 1 — גשר ה-emit (n8n→Observability) + Error Workflow סטנדרטי

הלב של הרובד: כל workflow מקבל `settings.errorWorkflow` שמצביע על workflow יחיד חדש
(`error-handler.json`: Error Trigger → HTTP-Request) שפולט `factory.n8n.workflow_failed`
(error+action_required → Axiom+Telegram+Linear) במקום שהכשל ייבלע ב-`onError:continueRegularOutput`.
ההזרקה נעשית בנקודת-החנק היחידה `_upsert_wf` ב-`configure-agent-router.yml` (פעם אחת, לא ב-~20
אתרי-קריאה), וה-error-handler מיובא ראשון כדי שה-id שלו ידוע. הגשר עצמו: route חדש
`POST /factory/<system>/emit` בשער (`services/mcp-server/src/index.ts` + מודול טהור `emit-route.ts`)
המשתמש מחדש **בדיוק** בשרשרת-האימות של `/factory/<system>/mcp` (`isAllowedFactorySystem`→404,
`verifyBearer`→401, `systemRouteAllows`→403), גוזר `system`+`layer` מה-claim החתום (לא מהגוף),
מאמת גוף קטן (`name` ב-namespace `factory.*`, severity, body מוגבל) → 400, מגביל-קצב פר-מערכת (429),
ופולט דרך `emitEvent()` הקיים (כל הסודות בצד-השרת). n8n מאמת עם ה-credential הקיים `Factory MCP`
(`factory-mcp-bearer`). soft-degrade: בלי ה-credential — אין הזרקה, אפס רגרסיה. 10 טסטי-יחידה
(`emit-route.test.mjs`) + build נקי; golden רוענן; `error-handler.json` ב-`registry-exempt.txt`
(error-sink). הוכחה חיה על or-edri-4 (deploy-mcp-server + כשל מאולץ) אחרי אישור Or.

**Changes:** `services/mcp-server/src/index.ts`, `services/mcp-server/src/emit-route.ts` (חדש),
`services/mcp-server/test/emit-route.test.mjs` (חדש),
`templates/system/workflows/n8n/error-handler.json` (חדש),
`templates/system/.github/workflows/configure-agent-router.yml`, `monitoring/registry-exempt.txt`,
`tests/golden/system/MANIFEST.sha256`.

## שלב 4 — probe ריצה: `/healthz` → `/healthz/readiness` (+סבילות 503)

`system-runtime-audit.yml` עבר מבדיקת *liveness* (`/healthz`) לבדיקת *readiness*
(`/healthz/readiness` — DB + מיגרציות), שתופסת "חי אבל לא מגיש" — הפער ש-liveness מפספס. סבילות
מובנית: 503 (לא-מוכן, טרנזיינט בזמן ריסטארט/מיגרציה) עובר retry עד 3×10ש לפני שמוכרז `failed`, כך
שריסטארט קצר לא יוצר אזעקת-שווא; not-ready מתמשך (DB נפול) כן מתריע. universal-across-lifecycle: אם
readiness לא נתמך (404 ב-n8n ישן) — נפילה-לאחור ל-`/healthz` liveness, כך שמערכת ישנה לעולם לא
תיתן אזעקת-שווא. אומת חי: or-edri-4 מגיש `/healthz/readiness` → 200. שינוי פקטורי-בלבד (אין golden/E2E).

**Changes:** `.github/workflows/system-runtime-audit.yml`.

## שלב 3 — watchdog `n8n-workflow-cadence` (dead-man לקרונים)

מימוש המאוחד של שלבים 2+3 (ראו devplan — ה-heartbeat-node פר-קרון הוחלף בקריאת-executions
מרכזית). ה-watchdog מקבל ממד **cadence**: מזהה קרון שירה פעם ואז **הפסיק לרוץ בשקט** (הריצה
האחרונה success, אבל ישנה). `scripts/run-watchdog.sh`: `_n8n_wf_last_age_h` (גיל הריצה האחרונה
מאותה קריאת `/executions?workflowId=&limit=1`, מול `$NOW` ה-pinnable) + `proof_n8n_workflow_cadence`
(לכל מערכת, לכל workflow פעיל מתוזמן עם `max_age_hours` רשום: גיל > החלון → 🚨). רשומת
`system-n8n-cadence` ב-`watchdog-registry.json` (stage 4) עם חלונות פר-קרון (DB Vacuum 192ש;
spend-track/pending-actions-cleanup/file-catalog-refresh 3ש; style-refresh/tg-proactive 30ש). משלים
את ה-`n8n-workflow-liveness` הקיים (שתופס "מעולם-לא-רץ" + "אחרון נכשל") — יחד מכסים כל מצבי-ההיעדר
**בלי לגעת באף workflow** (factory-native). 3 טסטי-bats (fresh→✅, stale→🚨, unregistered→דילוג);
51/51 עוברים, shellcheck נקי.

**Changes:** `scripts/run-watchdog.sh`, `monitoring/watchdog-registry.json`,
`scripts/tests/run-watchdog.bats`.

## שלב 5 — assertion "רץ אבל ריק" (תבנית + דוגמה)

הפער שלא נתפס: צומת עם `onError:continueRegularOutput` נכשל אך "ממשיך" עם פלט ריק → הביצוע
status=success למרות שלא עשה כלום (לא ה-Error-Workflow ולא ה-watchdog תופסים). **התבנית**
(מתועדת ב-`docs/reliability-layer.md` §8): צומת IF על אינווריאנט-פלט → צומת HTTP-Request פולט
`factory.automation.empty_result` (warning) לאותו route emit. **דוגמה מחווטת** ב-`spend-track.json`:
`Compute Delta` כבר מחשב `ok` (=false כשקריאת ה-usage מ-OpenRouter נכשלה); נוספו `Assert Spend Read`
(IF על `$json.ok === false`) → `Emit Empty Result` (warning + reason). `configure-agent-router.yml`:
ה-`_upsert_wf` קיבל substitution גלובלי ל-`@@CRED_FACTORY_MCP_ID@@`/`@@SYSTEM_NAME@@` (no-op
לקיימים; מאפשר את צומת-ה-emit בכל workflow). golden רוענן. הוכחה חיה: אילוץ ok:false על or-edri-4
→ warning יחיד.

**Changes:** `templates/system/workflows/n8n/spend-track.json`,
`templates/system/.github/workflows/configure-agent-router.yml`, `docs/reliability-layer.md`,
`tests/golden/system/MANIFEST.sha256`.

## שלבים 7+6+8 — אימות runner, סיכום-צי (Axiom), ו-retrofit runbook

**שלב 7 (verify-only):** כל צמתי-הרובד הם HTTP-Request (לא Code/env), רצים ירוק תחת ה-Task-Runner
החי של n8n 2.x על or-edri-4 (error-handler בשלב 1, assertion בשלב 5), binary ב-DB. אין שינוי deploy.
מתועד ב-`docs/reliability-layer.md §10`. **שלב 6 (fleet-rollup):** `fleet-rollup.yml` (יומי 06:30 UTC
+ manual) + `scripts/fleet-rollup.sh` שואלים את Axiom (read-only) על אירועי-האמינות בחלון חוצה-מערכות
ופולטים דייג'סט יחיד דרך `emit-event.sh` (צי-נקי=info→Axiom; אירועים=warning→Telegram). soft-fail מלא
(token בלי query-scope / תשובה לא-נפרסת → note מנוון, לעולם לא נכשל). המשלים ההיסטורי ל-watchdog
(מצב-נוכחי) ול-runtime-audit. נרשם ב-`watchdog-registry.json` (gh-run-freshness). Grafana = אופציה דחויה.
**שלב 8 (retrofit):** runbook ב-`docs §12`: מערכות חדשות נולדות עם הרובד (תבניות מקובעות ב-main);
מערכת קיימת מקבלת אותו בלי re-provision דרך `refresh-system-agents.yml` (Or-gated). or-edri-4 (היחידה
החיה כיום) כבר מותקנת (הוכחות שלבים 1+5).

**Changes:** `.github/workflows/fleet-rollup.yml` (חדש), `scripts/fleet-rollup.sh` (חדש),
`monitoring/watchdog-registry.json`, `docs/reliability-layer.md`.
