<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא המצפן של הסוכן, לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית.
תוכנית הנדסית מלאה (מחקר+קבצים+שורות): נכתבה בסשן התכנון (plan 2026-06-10); עיקריה כאן.
-->
---
dev_name: שדרוג גרסת n8n לכל המערכות (1.121.0 → 2.25.7)
slug: n8n-2x-upgrade
opened: 2026-06-10
status: active
---

# תוכנית פיתוח — שדרוג גרסת n8n לכל המערכות

## מטרה

להעלות את גרסת מנוע-האוטומציות (n8n) שכל מערכת מקבלת מ-1.121.0 (נובמבר 2025) ל-2.25.7
(ה-stable הרשמי), לבנות מנגנון שדרוג-במקום שלא קיים היום (ריצה חוזרת של הדיפלוי לא
מעדכנת גרסה), ולשדרג גם את המערכות האמיתיות הקיימות. השדרוג מדליק אוטומטית את "השקע
החיצוני" (mcpTrigger) שנבנה וחומש ב-mcp-birth-bundle שלב 5 — האימות-העצמי של configure
כבר בנוי ויוכיח זאת. Follow-up ‎#1 של mcp-birth-bundle.

## החלטות יסוד (Or, 2026-06-10)

- **גרסת יעד 2.25.7** — אומת ישירות מול Docker Hub (digest של `stable`=`latest`=2.25.7);
  ‏2.26.x הוא beta; ‏1.123.x ענף תחזוקה גוסס שלא מדליק את שלב 5.
- **היקף מלא**: תבנית + מנגנון שדרוג-במקום + שדרוג המערכות הקיימות (באישור פר-מערכת).
- מיפוי השינויים השוברים של 2.0 מול המערכות שלנו (מקור: n8n-docs רשמי) — בסשן התכנון:
  ✅ task runners (כבר דלוקים, internal), ‏$env/Python/Start/ExecuteCommand (לא בשימוש),
  ‏MySQL (אנחנו Postgres). ⚠️ `N8N_DEFAULT_BINARY_DATA_MODE: "default"` הוסר → `"database"`.
  ⚠️ Publish מחליף Activate — סיכון מרכזי להוכחה חיה. ⚠️ מיגרציית DB חד-כיוונית — לעולם
  לא להוריד pin מתחת לגרסה שכבר נפרסה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | ענף התבנית: הצמדה 2.25.7 + מנגנון image-upsert + תיקוני 2.x + שערים סטטיים | completed | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`, `templates/system/Dockerfile.worker`, `templates/system/.github/workflows/configure-agent-router.yml`, `templates/system/AGENTS.md.template`, `tests/golden/system/`, `changelog.d/` |
| 2 | הוכחה חיה Day-2: שדרוג-במקום 1.121→2.25.7 על מערכת-טסט + הדלקת mcpTrigger | in-progress | מערכת-טסט חיה (reuse mode), `prove-on-test-system.yml` |
| 3 | מיזוג + הוכחת לידה Day-0: provision טרי על 2.25.7 | pending | מערכת-טסט שנייה (reuse mode) |
| 4 | שדרוג המערכות האמיתיות (פר-מערכת, באישור Or) | pending | `refresh-system-agents.yml`, ריפו + Railway של כל מערכת אמיתית |
| 5 | תיעוד וסגירה | pending | `CLAUDE.md`, `docs/roadmap.md`, `devplans/n8n-2x-upgrade.md`, `changelog.d/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 1 — ענף התבנית: הצמדה 2.25.7 + מנגנון image-upsert + תיקוני 2.x

כל שינויי הקוד, בלי שום מהלך חי. עיקרי המימוש (המפרט המלא בסשן התכנון):

1. **הצמדה:** `N8N_IMAGE: n8nio/n8n:2.25.7` (deploy ‏~42, הערת רציונל חדשה: mcpTrigger
   נרשם, אזהרת מיגרציה חד-כיוונית, סנכרון worker); `Dockerfile.worker` ‏FROM ‏2.25.7.
2. **image-upsert (הלב החדש, Day-2):** ב-`Provision Railway` אחרי בלוק ה-SM-first של
   n8n (~516): קריאת ה-image הנוכחי של ה-service-instance ‏(GraphQL), השוואה ל-
   `$N8N_IMAGE`; שונה → `serviceInstanceUpdate(input:{source:{image}})` + דגל
   `N8N_IMAGE_CHANGED`; זהה → no-op מפורש. אחרי ה-env-upsert (~727): אם הדגל דלוק —
   ‏`serviceInstanceDeploy` + המתנה ל-deployment **חדש** ב-SUCCESS (cap ‏~10 דק').
   להשתמש ב-`_gql` ובדפוס Redis הקיים (~628). לאמת חי אם serviceInstanceUpdate כבר
   מרנדפלא לבד — ואז להשמיט את ה-deploy המפורש.
3. **אסרטת גרסה:** בשער המוכנות של owner-setup (~1418) — `versionCli` מ-`/rest/settings`;
   כש-`N8N_IMAGE_CHANGED=true` חובה התאמה ל-`${N8N_IMAGE#*:}` (healthz לא מבחין ישן/חדש).
4. **queue-mode:** ‏`N8N_DEFAULT_BINARY_DATA_MODE` ‏→ `"database"` בשני המקומות (~690,
   ‏~798); נתיב שדרוג worker קיים: ‏upsert של ה-var + ‏rebuild (‏serviceInstanceDeploy)
   כש-`WORKER_FIRST_TIME!=true` והדגל דלוק.
5. **הקשחת הפעלה:** רגל Public-API ‏(`POST /api/v1/workflows/:id/activate`,
   ‏X-N8N-API-KEY מ-SM) לפני fallbacks של ‎/rest — בדיפלוי (~2196) וב-`_upsert_wf` של
   configure (~488). המסלול היחיד שהוכח עובד ב-stage 5 של mcp-birth-bundle.
6. **רענוני טקסט:** הערות "1.121" ב-configure (511, 1125-8, 1406-16), ‏`runtime:` בפרומפט
   ‏unknown-agent (566), ‏AGENTS.md.template:68. ‏CLAUDE.md/roadmap — רק בשלב 5, אחרי הוכחה.

**Acceptance:**
- [ ] שערים סטטיים ירוקים על ה-PR: ‏Playground tests (golden gate) + ‏Changelog gates
      (golden-sync + fragment + devplan) + ‏shellcheck/yamllint + ‏secret-scan.
- [ ] ‏golden רוענן באותו diff (`scripts/check-system-golden.sh --update`).
- [ ] ‏grep ‏`1.121` נקי תחת `templates/system/` (למעט אזכור היסטורי מכוון בהערת הרציונל).

**הוכחה תפקודית (באותו שלב):** שערי ה-CI על ה-PR הם ההוכחה של לבנת-הקוד (שלב סטטי
בלבד — ההתנהגות החיה מוכחת בשלבים 2–3, שהם חלק מהפיתוח ולא "שלב מאוחר": ה-PR לא
ימוזג לפני שלב 2).

**הערת התקדמות אחרונה:** כל שינויי הקוד נכתבו (2026-06-10): הצמדה+הערת רציונל,
‏image-upsert עם רולאאוט-והמתנה ל-deployment חדש (כולל גילוי-עצמי אם
‏serviceInstanceUpdate כבר רינדפלא — פולינג ל-id חדש לפני deploy מפורש), אסרטת
‏versionCli בשער המוכנות, ‏binary-mode→database ‏(main+worker), נתיב rebuild ל-worker
קיים, רגל Public-API להפעלות (דיפלוי+configure), ‏runtime דינמי בפרומפט unknown-agent,
‏AGENTS.md.template. ‏golden רוענן (120). מקומית: ‏yamllint + ‏bash -n על כל בלוקי ה-run
‏+ ‏check-system-golden + ‏check-golden-sync — ‏PASS. ממתין לאישור CI על ה-PR.

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה חיה Day-2: שדרוג-במקום על מערכת-טסט + הדלקת mcpTrigger

✋ כל מהלך בעלות — באישור Or מראש.

1. הקמת מערכת-טסט מ-main הנוכחי (**עדיין 1.121**) — ‏provision → register-app (אם נדרש)
   → ‏deploy → ‏configure (reuse mode, ‏`shared_gcp_project=factory-test-25`, ‏0 מכסה) —
   הפיקסצ'ר של "מערכת קיימת" עם state אמיתי (owner, וורקפלואים, executions).
2. מהענף: ‏`prove-on-test-system.yml` עם
   ‏`paths=.github/workflows/deploy-railway-cloudflare.yml,Dockerfile.worker,.github/workflows/configure-agent-router.yml`
   ‏+ ‏`post_apply_workflow=deploy-railway-cloudflare.yml`.
3. ציפיות בלוג הדיפלוי: ‏`n8n image upgrade: …1.121.0 -> …2.25.7` → ‏deployment חדש
   ‏SUCCESS → אסרטת ‏`versionCli=2.25.7` עוברת. ריצת דיפלוי **שנייה** = ‏no-op מפורש.
4. אימות חי: ‏healthz ‏200, מסך login, ‏owner קיים נכנס, סבב router אמיתי, ריצת
   ‏configure מלאה — **אימות-עצמי של mcp-server עובר: ‏401 בלי bearer → ‏initialize →
   ‏tools/list → ‏postgres_named_query אמיתי** (= הדלקת שלב 5 של mcp-birth-bundle).
5. רגרסיה: ‏n8n-mcp-smoke מול ה-gateway (תאימות sidecar ‏czlonkowski ‏2.51.2 ל-2.25.7).
6. רגל queue-mode: דיפלוי עם ‏`queue_mode=true` ואימות worker על ‏2.25.7 + ‏`database`
   בשני הצדדים (לב: ‏SKIP_EDGE חוסם worker ב-factory-test — לתאם או להוכיח את מכניקת
   ה-upsert בנפרד; "שינוי תוכנית" אם נדרש).
7. תצפית-אגב (לא חוסם): האם ה-MCP המובנה (instance-level, beta) ניתן להפעלה headless
   ‏ב-2.25.7 — לתעד ממצא ל-follow-up.

**Acceptance:**
- [ ] שדרוג-במקום עבר על מערכת שנולדה על 1.121: לוג upgrade + ‏versionCli=2.25.7.
- [ ] ריצה חוזרת של הדיפלוי = ‏no-op (חוזה האידמפוטנטיות נשמר).
- [ ] ‏state שרד: ‏owner נכנס, הוורקפלואים פעילים, סבב router מחזיר תשובה.
- [ ] ‏`/mcp/system-tools` חי: האימות-העצמי של configure ‏PASS מלא.
- [ ] ‏n8n-mcp-smoke ירוק מול המערכת המשודרגת.

**הוכחה תפקודית (באותו שלב):** שורות ה-PASS בלוגים של deploy+configure על מערכת-הטסט
החיה + ‏probe_endpoint בלתי-תלוי על ‏`/mcp/system-tools` ‏(401 בלי bearer = רשום וחי).

**הערת התקדמות אחרונה (2026-06-10):** הפיקסצ'ר הוקם בדרך חתחתים מלמדת:
‏(א) הקמות 049/050 נפלו על ‏401 לסירוגין של GitHub בצעד `Set repo variables` —
היחיד בלי retry; תוקן ומוזג ב-hotfix נפרד ‏(PR ‎#376, ‏squash ‏854fe20) כדי לא לפתוח
את ‎#375 לפני ההוכחה; ‏051 קמה ירוקה עם החיסון (הריפוז היתומים 049/050 יאורכבו
בפירוק). ‏(ב) ‏051: ‏provision+register-App (שני קליקים של Or)+deploy+configure
ירוקים; אומת חי ‏versionCli=1.121.0 ו-404 על ‏`/mcp/system-tools` (מצב-לפני).
‏(ג) ‏prove-on-test-system מהענף עבד (sandbox, ‏PR+מיזוג בריפו הטסט) → דיפלוי
השדרוג: ‏**מנגנון ה-image-upsert עבד בפעם הראשונה חי** — ‏`upgrade:
1.121.0→2.25.7`, ‏deployment חדש ‏SUCCESS (גילוי: ‏serviceInstanceUpdate לא
מרנדפלא לבד על שינוי image — ה-fallback ל-serviceInstanceDeploy מפורש נדרש ועבד).
**ממצא חי ‎#1:** אסרטת ה-versionCli נכשלה — ‏n8n 2.x מקשיח את ‏`/rest/settings`
הלא-מאומת ומסתיר את הגרסה (אומת ב-probe מול ‏051 המשודרגת מול אותה קריאה על
1.121). תוקן: ‏fallback ל-login של ה-owner וקריאה מאומתת (login מוצלח = הוכחת
Day-2 ל-DB), ‏FAIL קשיח רק כשגרסה נקראת ושגויה, קבלה סטרוקטורלית
(deployment חדש+healthz+login) כשאין גרסה בשום מסלול. **סבב 2 (no-op):** ‏deploy שני
ירוק — ‏`image already 2.25.7 — no-op` (חוזה האידמפוטנטיות ✓), והדמו ירה חי על 2.25.7.
**ממצא חי ‎#2 (המרכזי):** האימות-העצמי של mcp-server נכשל גם על 2.25.7 — ‏404 אחרי
‏activate ‏200 וגם אחרי ריסטרט; ‏n8n מכריז "Activated" בעלייה בלי לרשום את ה-route
(webhooks רגילים כן נרשמים). שורש (קוד-מקור 2.25.7 + ‏docs + ‏n8n-mcp#551): ב-2.x
רישום production = **פרסום גרסה** — ‏cookie ‏`/rest/workflows/:id/activate` עם
‏`{versionId}`; ‏Public-API activate מחזיר 200 בלי לרשום; ‏PATCH נבלע. תוקן בשרשרת
תואמת-דורות בשלוש נקודות (mcp-server block, ‏_upsert_wf, ‏notifier+demo בדיפלוי —
האחרון קריטי ל-Day-0). ממצא-אגב (סעיף 7): ‏MCP מובנה ניתן ל-env-control
(‏mcpManagedByEnv) — ‏headless אפשרי. ממתין לסבב prove שלישי (post_apply=configure).

**שינוי תוכנית:** —

---

### שלב 3 — מיזוג + הוכחת לידה Day-0 על 2.25.7

✋ provision חדש — באישור Or.

מיזוג ה-PR (אחרי ששלב 2 ירוק) → ‏provision טרי של מערכת-טסט שנייה מ-main: לידה מלאה
על 2.25.7 — ‏`/rest/owner/setup` על DB טרי, ‏login, ‏mint מפתחות API, ‏configure מלא +
אימות-עצמי mcp-server ‏PASS מלידה, ‏webhook דמו חי. זה מוכיח את מסלול ה-Day-0 שכל
מערכת עתידית תעבור.

**Acceptance:**
- [ ] ‏provision+deploy+configure ירוקים מקצה-לקצה על מערכת טרייה.
- [ ] ‏owner-setup עבד על ‏2.25.7 (ה-URL נוחת על מסך login, לא setup).
- [ ] אימות-עצמי mcp-server ‏PASS מלידה (בלי ריסטרט).

**הוכחה תפקודית (באותו שלב):** לוגי הריצות + ‏probe_endpoint על המערכת החדשה
(‏healthz, ‏login, ‏/mcp/system-tools=401 בלי bearer).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — שדרוג המערכות האמיתיות (פר-מערכת, באישור Or)

מיפוי המערכות האמיתיות (`list_all_systems_inventory`; הידועה: ‏or-adhd-agent). לכל
מערכת, באישור Or נפרד:

1. **בטיחות פרופורציונלית:** ייצוא כל הוורקפלואים דרך ה-Public API ל-artifact לפני
   השדרוג; בדיקת ‏`QUEUE_MODE` של המערכת; תיעוד שהמיגרציה חד-כיוונית (rollback =
   שחזור וורקפלואים לאינסטנס טרי; ‏credentials לא ניתנים לייצוא — סיכון שיורי שOr
   מאשר מראש).
2. ‏`refresh-system-agents.yml` עם אותם ‏paths + ‏`post_merge_workflow=deploy-railway-cloudflare.yml`
   (push של הדיפלוי+worker החדשים לריפו המערכת → הדיפלוי מריץ את ה-image-upsert).
3. אימות פר-מערכת: ‏healthz+versionCli, סבב router, אימות-עצמי mcp-server, וב-
   ‏or-adhd-agent — סבב טלגרם אמיתי.

**Acceptance:**
- [ ] כל מערכת אמיתית על ‏2.25.7, מאומתת חי (גרסה+router+mcp).
- [ ] ‏artifact ייצוא-וורקפלואים קיים לכל מערכת לפני השדרוג שלה.
- [ ] ‏or-adhd-agent ענתה לסבב טלגרם אמיתי אחרי השדרוג.

**הוכחה תפקודית (באותו שלב):** ‏versionCli=2.25.7 מכל מערכת + סבב חי מתועד.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — תיעוד וסגירה

עדכון ‏CLAUDE.md (שורות ‏~131, ‏~231 — "lights up automatically" הופך ל"דלוק"),
‏docs/roadmap.md, הערת שחרור-חסימה ב-`devplans/research-web-search.md` (תיקון
‏Wait-בתת-וורקפלו הגיע עם 2.x), ‏fragment מסכם, ‏Teardown ledger, ‏status: completed.
‏follow-ups צפויים: בחינת ה-MCP המובנה (לפי ממצא שלב 2.7), עדכון גרסת sidecar אם נדרש.

**Acceptance:**
- [ ] כל השלבים ‏completed; ‏ledger מעודכן; ‏CLAUDE.md + ‏changelog ממוזגים.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## סיכונים פתוחים (מהמחקר; להכריע בהוכחות החיות)

- סמנטיקת ‏publish/activate ב-2.x: האם ‏`/api/v1/workflows/:id/activate` עדיין מגיש את
  גרסת ה-production? מגירה: הוספת קריאת publish ל-`_upsert_wf`.
- משטח ‎/rest הפנימי (owner/setup, ‏login, ‏api-keys, ‏run, ‏executions) — רגיש-גרסה,
  רובו ‏soft-fail; שלבים 2–3 מוכיחים כל אחד.
- ‏Railway: האם ‏serviceInstanceUpdate(image) מרנדפלא לבד (double-deploy);
  התנהגות rebuild של worker מבוסס-repo.
- חלון ‏version-skew קצר main/worker בשדרוג queue-mode; גידול Postgres ממצב ‏database.
- ‏footprint זיכרון של ‏2.x ב-Railway; ‏`/healthz` נשמר ב-2.x (ה-Caddy swap תלוי בו).

## מצב מערכת-הטסט (Teardown ledger)

- (יתמלא כשתקום מערכת-טסט בשלב 2.)

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- (טרם החל ביצוע.)
