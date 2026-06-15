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
