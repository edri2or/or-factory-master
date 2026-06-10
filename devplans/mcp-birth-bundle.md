<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא המצפן של הסוכן, לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית.
תוכנית הנדסית מלאה (קבצים+שורות+החלטות): נכתבה בסשן התכנון; עיקריה משוקעים כאן.
-->
---
dev_name: לידה מחוברת — חיבורי MCP מובנים לכל מערכת
slug: mcp-birth-bundle
opened: 2026-06-09
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — לידה מחוברת (mcp-birth-bundle)

## מטרה

כל מערכת שהפקטורי בונה נולדת כשהסוכן שלה כבר מחובר דרך ה-gateway המרכזי: (1) כלי תצפית
של הפקטורי על עצמה (קריאה-בלבד, נעול למערכת); (2) Google מורחב גם ל-Drive/Docs; (3) סשני
קלוד על ריפו המערכת מחוברים מלידה (.mcp.json); (4) ה-n8n של המערכת חושף כלים החוצה
(MCP Server Trigger). שום סוד לא עוזב את הכספת המרכזית — רק טוקנים סקופיים פר-מערכת.
הרחבה ישירה של הדפוס שהוכח ב-google-mcp-systems. מערכות קיימות לא מקבלות רטרואקטיבית.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | Gateway: מסלול `/factory/:system/mcp` נעול-דייר + bearer חדש + smoke | completed | `services/mcp-server/src/{bearer,index,factory-scope}.ts`, `scripts/render-mcp-service-yaml.sh`, `.github/workflows/{deploy-mcp-server,factory-mcp-smoke}.yml`, `scripts/factory-mcp-smoke.py`, `monitoring/registry-exempt.txt` |
| 2 | תבנית: `factory_tools` על ops-agent + הקמת מערכת-טסט חיה | completed | `.github/workflows/provision-system.yml`, `templates/system/.github/workflows/configure-agent-router.yml`, `templates/system/workflows/n8n/ops-agent.json`, `tests/golden/system/` |
| 3 | `.mcp.json.template` — סשני קלוד נולדים מחוברים | completed | `templates/system/.mcp.json.template`, `templates/system/AGENTS.md.template`, `.github/workflows/provision-system.yml`, `tests/golden/system/` |
| 4 | Google sidecar: Drive+Docs (קליק consent אחד של Or) | pending | `services/workspace-mcp/entrypoint.sh`, `scripts/render-mcp-service-yaml.sh`, `.github/workflows/{copy-gmail-oauth-to-control,request-workspace-scopes-consent}.yml`, `scripts/google-mcp-smoke.py`, `templates/system/.github/workflows/bootstrap-gmail-oauth.yml`, `templates/system/workflows/n8n/ops-agent.json`, `tests/golden/system/` |
| 5 | n8n כשרת MCP: וורקפלו mcpTrigger מובנה (ניתן לחיתוך) | pending | `templates/system/workflows/n8n/mcp-server.json`, `.github/workflows/provision-system.yml`, `templates/system/.github/workflows/configure-agent-router.yml`, `monitoring/registry-exempt.txt`, `tests/golden/system/` |
| 6 | סגירה: תיעוד, Teardown ledger, status completed | pending | `devplans/mcp-birth-bundle.md`, `CLAUDE.md`, `changelog.d/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 1 — Gateway: מסלול `/factory/:system/mcp` נעול-דייר + bearer חדש + smoke

סוג bearer חדש `factory-runtime` (שנה, עם claim של system) + `POST /factory/:system/token`
(בשער X-Admin-Secret, כמו workspace) + מסלול `ALL /factory/:system/mcp` שמרים McpServer
פר-בקשה ורושם **רק** תת-סט מוקשח דרך facade על `registerTools()` (פרמטר המערכת נמחק
מהסכמה ומוזרק מה-claim החתום; guard-ים ל-Railway/probe). 8 כלים ב-v1:
`list_n8n_workflows`, `inspect_n8n_execution`, `inspect_railway_service`,
`list_railway_deployments`, `tail_railway_deployment_logs`, `probe_endpoint` (host =
`n8n-<system>.or-infra.com` בלבד), `list_workflow_runs`, `get_run_jobs` (repo של המערכת).
בלי org-read-tools, בלי dispatch, בלי GCP/Cloudflare. ENV kill-switch
`FACTORY_TOOLS_ALLOWED_SYSTEMS`. אחרי המיזוג — פריסת gateway (`deploy-mcp-server.yml`;
אם אין paths-trigger — dispatch מהמסלול המאושר) והרצת smoke חדש.

**Acceptance:**
- [x] `factory-mcp-smoke.yml` ירוק 7/7 מול or-adhd-agent: mint → initialize → tools/list
      בדיוק 8 שמות → קריאת `list_n8n_workflows` אמיתית → probe למערכת אחרת = `tenant_blocked`
      → טוקן על path של מערכת אחרת = 403 → בלי טוקן = 401.
- [x] רגרסיה: `n8n-mcp-smoke.yml` + `google-mcp-smoke.yml` ירוקים אחרי הפריסה.

**הוכחה תפקודית (באותו שלב):** ריצת ה-smoke מול מערכת חיה אמיתית (or-adhd-agent) —
הפלט: רשימת הוורקפלואים האמיתית שלה דרך המסלול החדש + שתי חסימות-דייר נצפות בלוג הריצה.

**הערת התקדמות אחרונה:** ✅ הושלם והוכח חי (2026-06-09). PR ‎#355 מוזג (squash
`db14fd2`) → ‎deploy-mcp-server רץ אוטומטית מה-paths-trigger (run 27239782270,
ירוק, 2.5 דק') → `factory-mcp-smoke` run 27239960406 — **PASS 7/7**: bearer
סקופי ל-or-adhd-agent → initialize (`factory-telemetry-mcp`) → בדיוק 8 כלים →
`list_n8n_workflows` החזיר **45 וורקפלואים אמיתיים** (הזהות הוזרקה מה-claim) →
probe ל-`n8n-other-system-smoke.or-infra.com` = `tenant_blocked` → הטוקן על
`/factory/other-system-smoke/mcp` = 403 → בלי טוקן = 401. רגרסיות:
n8n-mcp-smoke (run 27240027072) + google-mcp-smoke (run 27240028167) ירוקים —
הידוק `systemRouteAllows` לא שבר את המסלולים הקיימים. בונוס אבטחה שנכנס באותו
PR: סגירת דליפה צולבת בין שלושת המסלולים הסקופיים (טוקן workspace-runtime כבר
לא יכול להניע את /n8n).

**שינוי תוכנית:** —

---

### שלב 2 — תבנית: `factory_tools` על ops-agent + הקמת מערכת-טסט חיה

שיקוף מדויק של שרשרת google_workspace: provision טובע `factory-mcp-bearer` ל-SM של
המערכת (WARN-soft, באותו בלוק mint קיים); configure-agent-router יוצר credential
"Factory MCP" + sed של `@@CRED_FACTORY_MCP_ID@@` + strip כשה-credential ריק; נוד
mcpClientTool חדש `factory_tools` על Ops Agent (endpoint `/factory/@@SYSTEM_NAME@@/mcp`,
httpStreamable, bearerAuth) + פסקת systemMessage (קריאה-בלבד, כבר ממוקד-מערכת, עדיף
לטלמטריה עמוקה). רענון golden באותו PR. **כאן קמה מערכת-הטסט** (reuse mode, 0 מכסה,
באישור Or) והאיטרציה טרום-מיזוג רצה דרך `prove-on-test-system.yml` מהענף.

**Acceptance:**
- [x] שערים סטטיים ירוקים (golden + changelog + devplan + shellcheck/yamllint).
- [x] סבב חי: שאלה לסוכן שרק `factory_tools` עונה עליה (היסטוריית 5 דיפלויים אחרונים
      ב-Railway — ל-railway_readonly אין op כזה) חוזרת עם נתונים אמיתיים.
- [x] בדיקת שלילה חיה: בקשת probe למערכת אחרת משתקפת כ-`tenant_blocked`.

**הוכחה תפקודית (באותו שלב):** POST אמיתי ל-`/webhook/agent-router` של מערכת-הטסט
(דרך probe_endpoint) + אימות בלתי-תלוי ב-`inspect_n8n_execution` שהריצה הצליחה והנתונים
חזרו מהכלי החדש. ה-mint הפרוביז'ני המלא מוכח ב-re-provision שאחרי המיזוג.

**הערת התקדמות אחרונה:** ✅ הושלם והוכח חי (2026-06-10). PR ‎#358 מוזג (squash
`1449d5f`, ‏CI ‏5/5) → מערכת-הטסט **factory-test-046** הוקמה מ-main במצב reuse
(‏0 מכסה): provision run 27266410876 — ובלוג: `PASS: minted + stored
factory-mcp-bearer for factory-test-046` (**ה-mint הפרוביז'ני הוכח כבר עכשיו**,
מוקדם מהתכנון) → deploy run 27266849603 (3 דק' — מערכות factory-test מדלגות על
Caddy בתכנון) → configure run 27267173228: `Factory MCP credential
id=e8KTbIO3hy0TfepS` — הנוד לא נחתך. **סבב חי:** שאלת היסטוריית-פריסות ל-router
→ ops-agent (exec 11, success) החזיר את **שתי** הפריסות האמיתיות כולל REMOVED —
מזהים/סטטוסים/זמנים זהים-בייט ל-`list_railway_deployments` האמיתי (נתון שאין
לאף כלי אחר במערכת). **שלילה חיה:** בקשת probe ל-or-adhd-agent → הסוכן ציטט
`tenant_blocked` והסביר שהכלי מוגבל ל-host שלו. תצפית אגב (לא בסקופ, follow-up
לשלב 6): ניסוח גבולי ראשון סווג unknown ו-unknown-agent החזיר reply **ריק**
(exec 8/9) — איכות ראוטר/unknown קיימת-מראש, לא קשורה לשינוי.

**שינוי תוכנית:** סדר ההוכחה התהפך ביחס לניסוח המקורי: ה-mint יושב ב-provision-system.yml,
ש**יכול לרוץ רק מ-main** (ה-WIF CEL של הברוקר מצמיד ל-refs/heads/main), ולכן אי-אפשר
"לזרוע" את ה-bearer במערכת-טסט קיימת מהענף בלי לעקוף את מודל האבטחה. במקום זה: מיזוג
אחרי שערים סטטיים → provision טרי של מערכת-הטסט מ-main מוכיח את כל השרשרת (כולל ה-mint
הפרוביז'ני — חזק מהתכנון המקורי שדחה אותו ל-re-provision); `prove-on-test-system.yml`
נשאר הלולאה לאיטרציות תיקון בקבצי תבנית אם יידרשו. זה בדיוק המסלול שהוכח ב-google_workspace
(factory-test-045).

---

### שלב 3 — `.mcp.json.template` — סשני קלוד נולדים מחוברים

קובץ `templates/system/.mcp.json.template` חדש: שרת `factory` → `/mcp` של ה-gateway,
שרת `n8n-live` → `/n8n/${SYSTEM_NAME}/mcp` (שניהם http, אפס סודות — האימות הוא OAuth 2.1
+ Google login הקיימים של ה-gateway). משתמש רק ב-`${SYSTEM_NAME}` → **בלי** שינוי
ב-allow-list של envsubst. `/factory/...` בכוונה לא נכלל (מסלול factory-runtime בלבד).
פסקה קצרה ב-CLAUDE.md.template. רענון golden.

**Acceptance:**
- [x] `validate-templates.sh` + golden ירוקים; אין placeholder שיורי בקובץ המרונדר.
- [x] `.mcp.json` קיים בריפו של מערכת-הטסט אחרי re-provision והתוכן זהה-בייט לצפוי.

**הוכחה תפקודית (באותו שלב):** re-provision (reuse) של מערכת-הטסט באישור Or — prove-on-
test-system מעתיק כמו-שהוא ולא מרנדר `.template`, ולכן ההוכחה הנאמנה היא provision; קריאת
הקובץ דרך `get_file_contents` והשוואה; `probe_endpoint` על `/mcp` בלי אימות = 401 (חוזה
ה-discovery חי). הוכחה אנושית אופציונלית: Or פותח סשן קלוד אחד על ריפו הטסט.

**הערת התקדמות אחרונה:** ✅ הושלם והוכח חי (2026-06-10). PR ‎#360 מוזג (squash
`8a1aa2d`, ‏CI ‏5/5) → provision של **factory-test-047** מ-main (run 27270732242,
ירוק, reuse, ‏0 מכסה) → `.mcp.json` קיים בשורש הריפו החדש ו**זהה-בייט** לרינדור
הצפוי (sha256 `850ec441…` משני הצדדים; ה-URL של n8n-live נושא את שם המערכת
המרונדר) → `probe_endpoint` על `/mcp` בלי אימות = **401** `unauthorized` (חוזה
ה-discovery חי). ‏047 הוקמה ללא deploy (לא נדרש לשלב הזה) — תיפרס בתחילת שלב 4.

**שינוי תוכנית:** שני דיוקים: (1) הפסקה התיעודית נכנסה ל-**AGENTS.md.template** ולא
ל-CLAUDE.md.template — כי CLAUDE.md הוא בסך הכל `@AGENTS.md` import (כך באמת מגיעים
לסשני קלוד). (2) "re-provision של מערכת-הטסט" בפועל = **מערכת-טסט יורשת** (factory-test-047):
ה-preflight של provision מסרב לריפו קיים בכל מצב, ולכן מקימים שם חדש על אותו פרויקט משותף —
וניקוי-הסודות של reuse הופך את 046 ללא-ניתנת-לניהול (by design, מתועד ב-ledger); ‏047 תהיה
מערכת-הטסט של שלבים 4–5 ו-046 תפורק באישור Or.

---

### שלב 4 — Google sidecar: Drive+Docs (קליק consent אחד של Or)

צעד-קדם חינמי: חילוץ מחרוזות ה-scope המדויקות שקבוצות `drive`+`docs` של
workspace-mcp==1.21.1 דורשות (צפוי `auth/drive` + `auth/documents`; הדיוק קריטי —
חוסר-התאמה מפיל refresh עם "Scope has changed"). **PR-A** (בלי פריסת gateway):
input חדש `rotate` ל-copy-gmail-oauth-to-control.yml (כיום מדלג כשקיים); workflow חד-פעמי
`request-workspace-scopes-consent.yml` — מתחבר ל-n8n של or-adhd-agent (ה-redirect URI
היחיד הרשום אצל גוגל), מעדכן את ה-scope ל-6, ושולח ל-Or את קישור ה-consent בטלגרם —
**הקליק היחיד**; עדכון SCOPE ב-bootstrap-gmail-oauth.yml של התבנית (+golden).
**בין ה-PRs (בשער Or):** קליק → extract-gmail-refresh-token (or-adhd-agent) → copy עם
rotate=true → גרסה v2 ב-control SM. **PR-B** (מפיל פריסת gateway): scopes דרך env חדש
`WORKSPACE_MCP_SCOPES`; `WORKSPACE_MCP_TOOLS="calendar gmail drive docs"`; הרחבת
google-mcp-smoke (Drive+Docs); שורת systemMessage (קריאות חופשי, כתיבות דרך
request_write_action) +golden. למזג PR-B מיד אחרי הסבב כדי לצמצם את חלון אי-ההתאמה.
**תיאום:** shared-gmail-token שלב 3 נוגע באותו bootstrap — להנחית אותו קודם, או לקפל את
ניקוי-ההודעה לתוך PR-A ולסגור את השלב שלו באותו diff.

**Acceptance:**
- [ ] google-mcp-smoke מורחב ירוק: רגרסיית gmail+calendar + כלי Drive וכלי Docs ברשימה
      + קריאת `search_drive_files` אמיתית (לא הודעת auth).
- [ ] הסוכן במערכת-הטסט עונה על שאלת Drive אמיתית.

**הוכחה תפקודית (באותו שלב):** ריצת ה-smoke המורחב מול החשבון המשותף האמיתי + סבב סוכן
חי. rollback מתועד: גרסת הטוקן הישנה נשמרת ב-SM (החזרה כ-latest) + revert ל-PR-B.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — n8n כשרת MCP: וורקפלו mcpTrigger מובנה (ניתן לחיתוך)

וורקפלו תבנית חדש "factory-master: mcp-server": נוד `mcpTrigger` (typeVersion 2, מאומת על
1.121; path `system-tools`, bearerAuth, credential חדש `@@CRED_N8N_MCP_SERVER_ID@@`) +
שלושת כלי הקריאה הקיימים כ-toolWorkflow (`postgres_named_query`, `github_readonly`,
`railway_readonly`) מחוברים לטריגר. **request_write_action מחוץ** — משטח קריאה-בלבד.
provision טובע `n8n-mcp-server-token` (mint-if-empty); configure-agent-router יוצר את
ה-credential, sed של המזהים, strip לכלים ריקים, מפעיל (activate=yes) ומריץ **אימות-עצמי
מובנה**: initialize+tools/list עם ה-bearer ו-401 בלעדיו — רץ על כל מערכת עתידית. בלי שינוי
Caddy (ה-fallback מפרוקסה `/mcp/*`; אם הסטרים נתקע — `flush_interval -1`, שורה אחת).
ה-endpoint מתועד ב-CLAUDE.md.template, בכוונה לא ב-.mcp.json (היה דורש סוד בריפו).
דחיית ה-MCP המובנה (instance-level, beta, דורש UI ידני) מתועדת כאן; טריגר לבחינה מחודשת:
כשהפיצ'ר GA או ניתן להפעלה headless.

**Acceptance:**
- [ ] שערים סטטיים ירוקים (כולל registry-exempt + golden).
- [ ] אימות-עצמי של configure במערכת-הטסט: handshake תקין, בדיוק 3 כלים, קריאת
      `github_readonly` אמיתית מחזירה נתוני CI, ו-401 בלי bearer.

**הוכחה תפקודית (באותו שלב):** טרום-מיזוג — זריעת `n8n-mcp-server-token` חד-פעמית במערכת-
הטסט + `prove-on-test-system.yml` מהענף עם post_apply=configure; שורות ה-PASS של האימות-
העצמי בלוג הן ההוכחה. ה-mint הפרוביז'ני מוכח ב-re-provision שאחרי המיזוג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — סגירה: תיעוד, Teardown ledger, status completed

עדכון CLAUDE.md של הפקטורי (מסלולי gateway + הכלים החדשים), fragment changelog מסכם,
רישום follow-ups (MCP מובנה של n8n כשיבשיל; get_railway_build_logs/verify_* כ-v2 של סט
הכלים; טוקן גוגל בסקופ קריאה-בלבד כשער-כתיבה קשיח), עדכון ה-ledger למטה, והפיכת
status ל-completed. פירוק מערכת-הטסט — רק בהוראת Or (`decommission-test-system.yml`).

**Acceptance:**
- [ ] כל השלבים completed; ledger מעודכן; CLAUDE.md + changelog ממוזגים.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

- **factory-test-047** — חיה, מערכת-הטסט הנוכחית (הוקמה 2026-06-10 בשלב 3, reuse mode על
  `factory-test-25`, ‏0 מכסה). רכיבים: ריפו `edri2or/factory-test-047` (עם `.mcp.json` מולד);
  **טרם נפרסה** (אין Railway/DNS עדיין — deploy בתחילת שלב 4). סודות ב-SM של `factory-test-25`
  (הסבב הנוכחי). תשמש את שלבים 4–5. פירוק: `decommission-test-system.yml` — רק בהוראת Or.
- **factory-test-046** — בדימוס (הוחלפה ע"י 047 בשלב 3): ניקוי-הסודות של פרוביז'ן 047 הפך
  אותה ללא-ניתנת-לניהול (by design של מצב reuse). שרידים לפירוק: פרויקט Railway
  `d4ba2820-a7cc-462a-a2dc-83a86a3cb24a` (postgres+n8n רצים!), ‏DNS
  ‏`n8n-factory-test-046.or-infra.com`, ריפו `edri2or/factory-test-046`. **ממתינה לאישור Or
  לפירוק** (`decommission-test-system.yml` עם `shared_gcp_project=factory-test-25`).

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- **שלב 1 (2026-06-09):** המרכזיה קיבלה דלת חדשה לכל מערכת — כל מערכת תוכל לראות
  את עצמה (ולעולם לא את אחותה): נבדק חי מול or-adhd-agent — קיבלה את 45
  הוורקפלואים שלה, ושני ניסיונות "להציץ לשכנה" נחסמו. בונוס: נסגר חור קטן שבו
  מפתח של דלת אחת יכל לפתוח דלת אחרת.
- **שלב 2 (2026-06-10):** מהיום כל מערכת חדשה *נולדת* עם הכלי הזה ביד של הסוכן
  שלה. הקמנו מערכת-ניסיון אמיתית (factory-test-046) ושאלנו את הסוכן שלה שאלה
  שרק הכלי החדש יודע לענות עליה — הוא החזיר את היסטוריית הפריסות האמיתית שלה,
  אחד-לאחד מול המציאות. וכשביקשנו ממנו להציץ למערכת אחרת — הוא סירב והסביר למה.
- **שלב 3 (2026-06-10):** מהיום, מי שפותח סשן קלוד על ריפו של מערכת חדשה — מוצא
  אותו כבר מחובר למרכזיה ול-n8n החי של המערכת, בלי שום הגדרה ובלי שום סוד בריפו
  (ההזדהות היא התחברות גוגל בדפדפן). הוכח על מערכת-ניסיון חדשה (factory-test-047):
  הקובץ נולד בריפו בדיוק כמתוכנן, ומי שמנסה לגשת בלי להזדהות — נחסם.
