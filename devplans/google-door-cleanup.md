---
dev_name: העברת "הדלת של גוגל" למקום קבוע + פירוק 5 מערכות ישנות
slug: google-door-cleanup
opened: 2026-06-10
status: completed   # נסגר 2026-06-11 — הדלת הקבועה הוכחה חי + כל 5 המערכות הישנות פורקו ואומתו
---

# תוכנית פיתוח — העברת "הדלת של גוגל" למקום קבוע + פירוק 5 מערכות ישנות

## מטרה

follow-up #7 מסגירת mcp-birth-bundle. ל-OAuth של גוגל המשותף (שנותן לכל המערכות
Gmail/יומן/Drive/Docs) "כתובת חזרה" אחת הרשומה אצל גוגל — והיא תקועה אצל or-adhd-agent
(הנטושה). בונים "דלת" קבועה ב-gateway (השירות המרכזי שלעולם לא מפרקים) שלוכדת טוקן רענון
בן 6 הרשאות וכותבת אותו ל-control SM, מוכיחים אותה חי בלי or-adhd-agent — ורק אז מפרקים את
5 המערכות (or-adhd-agent, or-tok, tokile, or-edri-2, project-life-130: Railway + ריפו לכל
אחת), כל פירוק בשער ✅ של Or.

> **מבנה מיזוג (GitOps):** ‏deploy-mcp-server.yml פורס רק על push ל-main (חסום ל-main),
> אז קוד-הדלת (שלבים 1–4) נבנה ומוכח ב-CI על PR אחד בענף, וה**מיזוג היחיד** (שלב 5) הוא
> הפריסה — אבן-הדרך שדורשת ✅ של Or (פריסת השירות המרכזי + הקליק הידני בקונסולת גוגל +
> קליק ה-consent). ההוכחות החיות והפירוקים (5–7) קורים אחרי המיזוג.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כתיבת-סוד ל-Secret Manager + הרשאה ממוקדת | completed | `services/mcp-server/src/gcp-client.ts`, `test/secret-version.test.mjs`, `.github/workflows/deploy-mcp-server.yml`, `scripts/render-mcp-service-yaml.sh` |
| 2 | קישור-ההתחברות + route ההתחלה | completed | `services/mcp-server/src/google-oauth.ts` (+test), `index.ts` |
| 3 | לוכד ה-callback + שמירה ל-SM + שומרים | completed | `index.ts` (route callback), `services/mcp-server/src/google-oauth.ts` (exchange/parse +test) |
| 4 | חיווט-מחדש של workflow ההתחברות ל-gateway | completed | `.github/workflows/request-workspace-scopes-consent.yml` |
| 5 | מיזוג → פריסה → רישום כתובת + consent חי + smoke (אבן-דרך חיה) | completed | מיזוג ל-main (‎#387 + תיקון ‎#391) + קונסולת גוגל + control SM |
| 6 | פירוק or-adhd-agent + פרישת הצינורות הישנים | completed | dispatch `decommission-test-system.yml`; נמחקו `rotate-shared-gmail-token.yml` + `copy-gmail-oauth-to-control.yml` |
| 7 | פירוק 4 הנותרות + סגירה | completed | dispatch `decommission-test-system.yml` ×3 + `decommission-railway-projects.yml` (keep-list) + `propose-repo-delete.yml` (טלגרם ✅) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלבי-קוד (1–4) מוכחים ב-CI (`npm test` = tsc + node --test, ב-job
> "Playground tests") — זו ההוכחה ה*בלתי-תלויה-ב-MCP* לְלבנת-קוד; ההתנהגות החיה היא
> הלבנה האחרונה (שלב 5, אחרי המיזוג/פריסה), בדיוק "החיבור החיצוני אחרון".

---

### שלב 1 — כתיבת-סוד ל-Secret Manager + הרשאה ממוקדת

לתת ל-gateway יכולת לכתוב גרסה חדשה של `gmail-oauth-refresh-token` ל-control SM (הוספה
בלבד — לעולם לא מחיקה, כך שהגרסה הישנה תמיד נשמרת כ-rollback), בהרשאה ממוקדת-משאב.

**Acceptance:**
- [x] `buildAddSecretVersionRequest` (טהור, מיוצא-לבדיקה כמו `computeFreeUpDate`) + `addSecretVersion` נוספו ל-`gcp-client.ts` (REST `:addVersion`, base64, דרך `gcpFetchPost`).
- [x] צעד idempotent ב-`deploy-mcp-server.yml` שמעניק ל-runtime SA את `roles/secretmanager.secretVersionAdder` על `gmail-oauth-refresh-token` בלבד (במודל צעד ה-sentry-api-key; best-effort).
- [x] `CONTROL_PROJECT="or-factory-master-control"` נוסף כ-env ב-`render-mcp-service-yaml.sh`.
- [x] בדיקת היחידה ירוקה מקומית (84/84, `node --test`); shellcheck + yamllint ירוקים. ‏Playground ב-CI לאישור.

**הוכחה תפקודית (באותו שלב):** בדיקת יחידה ב-`test/secret-version.test.mjs` (תבנית הבית —
‏ESM ב-`test/`, מייבא מ-`dist/`) שמריצה את `buildAddSecretVersionRequest` על קלט אמיתי
(`or-factory-master-control`, `gmail-oauth-refresh-token`, ערך-בדיקה) ומאמתת: ה-URL מסתיים
ב-`:addVersion` (ולא `:destroy/:disable`), ה-body הוא `{payload:{data:<base64 של הערך>}}`
ש-round-trip חוזר למקור, ו-path segments מקודדים. **הוכח מקומית ירוק (84/84).** (ההרשאה החיה
נכנסת לתוקף בפריסה של שלב 5; הכתיבה החיה בפועל מוכחת שם בלכידת-הטוקן הראשונה.)

**הערת התקדמות אחרונה:** הושלם. ‏helper הכתיבה (טהור + wrapper), צעד ההרשאה הממוקדת,
ו-env ה-`CONTROL_PROJECT` נכתבו; הבדיקה במיקום הנכון (`test/*.test.mjs`, אחרי שתוקן ניסיון
ראשון ב-`src/*.test.ts` ש-Node 22 קלט כפול). מקומית 84/84 ירוק + lint נקי. ממתין ל-Playground.

**שינוי תוכנית:** —

---

### שלב 2 — קישור-ההתחברות + route ההתחלה

**Acceptance:**
- [x] `WORKSPACE_SCOPES` (6, byte-equal ל-`WORKSPACE_MCP_SCOPES`) + `workspaceConsentUrl()` נוספו כאחים ב-`google-oauth.ts` בלי לגעת בפונקציות ה-login (`googleAuthorizeUrl`/`exchangeGoogleCode`).
- [x] `GET /workspace/consent/start` (inline ב-`index.ts`, גדור ב-`x-admin-secret`+`secretMatches`, ‏503 אם לא `googleConfigured`, ‏302 ל-Google) + מפת `pendingConsent` (TTL, מודל על `pendingAuth`).
- [x] בדיקות `workspaceConsentUrl` ירוקות מקומית (87/87) + tsc קומפל את ה-route נקי; Playground ב-CI לאישור.

**הוכחה תפקודית (באותו שלב):** בדיקת יחידה ב-`test/google-oauth.test.mjs` ל-`workspaceConsentUrl`
מאמתת מחרוזת מדויקת: `scope` = 6 ההרשאות בדיוק (byte-equal ל-`WORKSPACE_SCOPES`),
`access_type=offline`, `prompt=consent`, `redirect_uri=.../workspace/consent/callback`, `state`;
+ regression-guard ש-`googleAuthorizeUrl` (login) נשאר `openid email`/`online`. **הוכח מקומית
(87/87).** ה-302/403 של ה-route עצמו: ‏`index.ts` לא ניתן-לייבוא-בבידוד (top-level throw + listen,
כמו בכל הבדיקות הקיימות), אז התנהגותו החיה מאומתת בשלב 5 (חיבור-חיצוני = לבנה אחרונה); כאן
הוא מאומת ב-tsc-compile + סקירה.

**הערת התקדמות אחרונה:** הושלם. `WORKSPACE_SCOPES`+`workspaceConsentUrl` ב-google-oauth;
‏`pendingConsent`+route ההתחלה inline ב-index.ts. מקומית 87/87 ירוק.

**שינוי תוכנית:** עוקב אחרי קונבנציית-הבית — ה-routes מוגדרים **inline ב-`index.ts`** (כמו
`/oauth/*`), לא במודול `workspace-consent.ts` נפרד (אין דפוס `registerX(app)` בקוד הקיים).
‏`exchangeWorkspaceConsentCode` + `parseWorkspaceConsentResponse` הוזזו לשלב 3 (נצרכים ע"י
ה-callback). split נקי: שלב 2 = "שולח לגוגל", שלב 3 = "לוכד מה שחוזר".

---

### שלב 3 — לוכד ה-callback + שמירה ל-SM + שומרים

**Acceptance:**
- [x] `parseWorkspaceConsentResponse` (טהור) + `exchangeWorkspaceConsentCode` ב-`google-oauth.ts`: דורש `refresh_token`, ו-**scope-equality guard** (זורק אם לא חזרו בדיוק 6, order-insensitive).
- [x] `GET /workspace/consent/callback` inline ב-`index.ts`: ולידציית `state` מול `pendingConsent` (TTL, חד-פעמי); `?error=`; קורא `exchangeWorkspaceConsentCode` ואז `addSecretVersion(CONTROL_PROJECT,'gmail-oauth-refresh-token',token)`; דף הצלחה ל-Or.
- [x] בדיקות `parseWorkspaceConsentResponse` ירוקות מקומית (91/91) + tsc קומפל את ה-callback נקי; Playground ב-CI לאישור.

**הוכחה תפקודית (באותו שלב):** בדיקות יחידה ל-`parseWorkspaceConsentResponse` (הלוגיקה
הבטיחותית של הלכידה — טהורה, ניתנת-לבדיקה): ‏(a) 6 scopes + refresh_token → מחזיר את הטוקן;
‏(b) order-insensitive; ‏(c) scope-mismatch (גם חסר וגם עודף) → זורק (לא ייכתב); ‏(d) חסר
refresh_token → זורק. **הוכח מקומית (91/91).** ה-route ב-index.ts (state/error/write) מאומת
ב-tsc-compile + חי בשלב 5 (כמו שלב 2).

**הערת התקדמות אחרונה:** הושלם. ‏parser טהור + exchange ב-google-oauth; ‏callback inline
ב-index.ts (state-guard, scope-guard דרך ה-parser, כתיבה ל-SM, דף הצלחה). מקומית 91/91 ירוק.

**שינוי תוכנית:** —

---

### שלב 4 — חיווט-מחדש של workflow ההתחברות ל-gateway

**Acceptance:**
- [x] `request-workspace-scopes-consent.yml` נכתב מחדש: הוסרה כל לוגיקת or-adhd-agent/n8n/factory-test-7; auth כברוקר (WIF), `gcloud run describe` לכתובת ה-gateway, קריאת `mcp-server-admin-secret` (ממוסך, in-step), קריאה ל-`/workspace/consent/start` עם `X-Admin-Secret` (לוכד את ה-`Location` ב-`-w redirect_url` בלי לעקוב), ושליחת קישור ה-consent ל-Or בטלגרם.
- [x] yamllint + shellcheck(severity=error, כמו actionlint) ירוקים; אין הפניה פונקציונלית ל-or-adhd-agent/n8n בנתיב ה-consent (4 איזכורים שנותרו — כולם בהערות-הסבר בלבד).

**הוכחה תפקודית (באותו שלב):** ה-workflow רץ רק מ-main (`if: refs/heads/main`) ודורש gateway
פרוס, אז ההוכחה ה*חיה* היא הלבנה האחרונה — שלב 5, אחרי המיזוג. כאן: הוכחת-בנייה סטטית —
yamllint + shellcheck(severity=error) נקיים; grep מאמת שה-URL הנבנה הוא
`${GATEWAY_URL}/workspace/consent/start` וש-or-adhd-agent/n8n נותרו רק בהערות. (חיבור-חיצוני
= לבנה אחרונה — מותר; אומת חי בשלב 5.)

**הערת התקדמות אחרונה:** הושלם. ה-workflow מונע-gateway לגמרי: ‏broker→describe→admin-secret→
‏/workspace/consent/start→Telegram. lint נקי מקומית.

**שינוי תוכנית:** —

---

### שלב 5 — מיזוג → פריסה → רישום כתובת + consent חי + smoke (אבן-דרך חיה)

הלבנה החיה האחרונה של הדלת. דורש ✅ של Or: מיזוג (פריסת השירות המרכזי) + הקליק הידני
בקונסולת גוגל + קליק ה-consent.

**Acceptance:**
- [x] PR-הדלת מוזג ל-main (‎#387, ואחריו תיקון ‎#391) → `deploy-mcp-server.yml` פרס את ה-gateway (SUCCESS, ריצות 27314813871 + 27318423614).
- [x] 2 כתובות ה-callback של הדלת נוספו ל-Authorized redirect URIs — בסיבוב התיקון ל-**client המשותף** (`651677607847-s1f0ip…`, זה עם ה-redirect של n8n; קליקים ידניים של Or, 2026-06-11).
- [x] consent חי הושלם פעמיים (Or לחץ; הלכידה הראשונה חשפה את באג שני-ה-clients) → גרסה 5 של `gmail-oauth-refresh-token` ב-control SM (קודמות שמורות כ-rollback; גרסה 3 הפגומה כובתה).
- [x] `google-mcp-smoke` ירוק עם הטוקן שהדלת לכדה (run 27318763907, ‏2026-06-11 02:00) — or-adhd-agent לא בנתיב.
- [x] ה-workflow המחובר-מחדש (שלב 4) רץ חי פעמיים בהצלחה (27318587408 ועוד) — הקישור נשלח לטלגרם וה-redirect שלו ל-gateway.

**הוכחה תפקודית (באותו שלב):** `probe_endpoint` ל-`/workspace/consent/start` → 302 עם 6
ה-scopes; `list_secret_metadata gmail-oauth-refresh-token` מראה גרסה חדשה בתאריך 2026-06-10;
‏`google-mcp-smoke` workflow ירוק. קלט: consent אמיתי של Or. **ירוק כאן פותח את הפירוק.**

**הערת התקדמות אחרונה (2026-06-11):** האיטרציה החיה הראשונה חשפה באג אמיתי: ‏PR ‎#387
מוזג ✅, ‏gateway נפרס ✅, ‏Or הוסיף 2 redirect-URIs בקונסולה ✅, ‏consent חי נלכד ונשמר
(גרסה 3) ✅ — אבל ‏google-mcp-smoke נכשל: ה-sidecar לא הצליח לרענן את הטוקן החדש.
**אבחון (מוכח, לא ניחוש):** רענון ידני של כל 3 הגרסאות מ-Cloud Shell — גרסה 3 תקינה
(OK + בדיוק 6 scopes) עם ה-client של ה-gateway, והישנות נכשלות איתו (`unauthorized_client`)
→ **קיימים שני OAuth clients**: ‏login (`google-oauth-client-*`, ‏gateway) ו-workspace
(`gmail-oauth-client-*`, ‏sidecar+n8n; ‏`render-mcp-service-yaml.sh:183-184`). הדלת טבעה עם
ה-client הלא-נכון. **תיקון נכתב** (92/92 ירוק): ‏consent door עובר ל-`WORKSPACE_OAUTH_CLIENT_{ID,SECRET}`
‏(=`gmail-oauth-client-*`) + ‏`workspaceConsentConfigured()`; ‏login לא נגעתי. **שחזור:** גרסה 3
כובתה; כיבוי בלבד הפיל את ה-deploy (Cloud Run ‏latest→DISABLED) → המתקן: הוספת גרסה 4 = ערך
גרסה 2 העובדת (פקודת pipe אצל Or). נותר: גרסה 4 → redeploy → smoke ירוק (שחזור) → מיזוג
התיקון → Or מוסיף את 2 ה-URIs ל-client המשותף (זה עם ה-redirect של n8n-or-adhd-agent) →
consent → smoke ירוק.
**סגירה (2026-06-11 02:00):** המסלול המלא הושלם ירוק: גרסה 4 (שחזור) → redeploy → smoke
ירוק (שחזור מאומת, run 27318371764) → תיקון ‎#391 מוזג + נפרס → ‏Or הוסיף את 2 ה-URIs
ל-client המשותף → consent חי דרך הדלת המתוקנת → גרסה 5 נלכדה ונשמרה → redeploy →
**google-mcp-smoke ירוק (run 27318763907)**. הדלת הקבועה מוכחת end-to-end בלי or-adhd-agent.
שלב 5 סגור; הפירוק (6–7) נפתח.

**שינוי תוכנית:** נוסף תת-מסלול תיקון בתוך שלב 5 (שחזור→אבחון→תיקון→consent חוזר) בעקבות
ממצא שני-ה-clients. בנוסף, ‏Or החליט: אחרי שהדלת עובדת — פיתוח נפרד יעביר את ה-OAuth client
מ-`factory-test-7` ל-control (איחוד שני ה-clients לאחד; חוב היסטורי + סיכון-פירוק). הפירוק
(שלבים 6–7) ימתין לזה אם Or יבחר כך.

---

### שלב 6 — פירוק or-adhd-agent + פרישת הצינורות הישנים

**Acceptance:**
- [x] `decommission-test-system.yml` רץ ל-`or-adhd-agent` (`shared_gcp_project=factory-test-7`, ‏run 27319026790, SUCCESS ‏2026-06-11 02:07); Railway `fa36eab4-…` נמחק, `edri2or/or-adhd-agent` מאורכב, DNS הוסר.
- [x] הצינורות המתים נמחקו: `rotate-shared-gmail-token.yml` (כל תפקידו — שיגור workflow בריפו המאורכב) וגם `copy-gmail-oauth-to-control.yml` כולו (השרשרת n8n→extract→copy הוחלפה כליל בדלת שכותבת ישר ל-control SM).

**הוכחה תפקודית (באותו שלב):** אומת בלתי-תלוי אחרי הריצה: `list_railway_projects` מציג
4 פרויקטים בלבד (or-adhd-agent נעלם); `get_repo or-adhd-agent` → `archived:true`.
פרויקט ה-GCP ‏factory-test-7 והארנק לא נגעו (by design — מחזיקים את ה-OAuth client עד ההעברה).

**הערת התקדמות אחרונה (2026-06-11):** הושלם. ‏dispatch אחרי ✅ ייעודי של Or; הריצה עברה את
שערי-הקבלה (אימות `GCP_PROJECT_ID`==factory-test-7 + אימות שם-Railway) וסיימה SUCCESS;
האימות הבלתי-תלוי ירוק. הרחבה מתועדת: נמחק גם `copy-gmail-oauth-to-control.yml` כולו (לא רק
נתיב ה-rotate) — כל ייעודו היה שרשרת or-adhd-agent, והדלת החליפה אותו.

**שינוי תוכנית:** —

---

### שלב 7 — פירוק 4 הנותרות + סגירה

**Acceptance:**
- [x] שלוש התקניות פורקו ב-`decommission-test-system.yml`, כל אחת באישור ✅ ייעודי של Or ועם `GCP_PROJECT_ID` מאומת מראש: `or-tok` (factory-test-23, run 27319419791), `tokile` (factory-test-18, run 27319469115), `or-edri-2` (factory-test-22, run 27319505611) — Railway נמחק + DNS הוסר + ריפו אורכב לכל אחת.
- [x] `project-life-130` (שריד טרום-פקטורי, אין `GCP_PROJECT_ID` → שער-הפירוק סירב כצפוי) טופלה במסלול ייעודי באישור Or: ‏Railway נמחק ב-`decommission-railway-projects.yml` במצב keep-list — ‏dry-run אומת קודם (KEEP 3 / DELETE 1 בדיוק, run 27319312631) ואז ריצה אמיתית (run 27319361696); הריפו נמחק דרך `propose-repo-delete.yml` → כרטיס טלגרם → הקשת ✅ של Or → מחיקה ע"י ה-MCP.
- [x] התוכנית נסגרה (`status: completed`).

**הוכחה תפקודית (באותו שלב):** אומת בלתי-תלוי בסוף: `list_railway_projects` → **0 פרויקטים**
(כל ה-5 נעלמו); `get_repo` → ‏`archived:true` ל-or-tok/tokile/or-edri-2 (+ or-adhd-agent משלב 6);
‏`get_repo project-life-130` → ‏**404** (נמחק). קלט: 5 dispatches + הקשת-טלגרם, כולם בשערי ✅.

**הערת התקדמות אחרונה (2026-06-11):** הושלם. הסדר היה: קודם ה-Railway של project-life-130
(כשה-3 עדיין חיות כעוגני keep-list), אחר-כך 3 הפירוקים המסודרים בזה-אחר-זה, ולבסוף מחיקת
הריפו של project-life-130 בהקשת ✅. כל המחיקות אומתו.

**שינוי תוכנית:** ‏project-life-130 התבררה כשריד טרום-פקטורי (Railway מ-20.4, אין מטא-דאטה)
— הוסט למסלול keep-list + מחיקת-ריפו-בטלגרם במקום השער הרגיל, בבחירת Or ("Railway + מחיקת
הריפו"). ‏or-tok התבררה על factory-test-23 (לא 25 כהערכה מוקדמת) — אומת מהריפו עצמו לפני השיגור.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- הפיתוח נפתח (2026-06-10): בונים דלת קבועה ב-gateway, מוכיחים חי, ואז מפרקים 5 מערכות ישנות — הכל בשערי ✅.
- שלב 1 הושלם — נתתי ל-gateway יכולת בטוחה לשמור את הטוקן החדש (הוספה בלבד, אף פעם לא מחיקה). בדיקה אוטומטית ירוקה.
- שלב 2 הושלם — בניתי את "כפתור ההתחברות" לגוגל (עם 6 ההרשאות הנכונות) ואת נקודת-הכניסה שמייצרת אותו. בדיקה אוטומטית ירוקה; ההתחברות הקיימת לא נפגעה.
- שלב 3 הושלם — בניתי את ה"לוכד": הוא תופס את הטוקן החדש שחוזר מגוגל, מוודא שיש בו בדיוק 6 ההרשאות (אחרת לא שומר — בטיחות), ושומר אותו במקום הקבוע. בדיקה אוטומטית ירוקה.
- שלב 4 הושלם — חיברתי מחדש את כפתור-ההפעלה של ההתחברות אל הדלת החדשה ב-gateway (כבר לא עובר דרך המערכת הישנה or-adhd-agent). בדיקות ה-lint ירוקות.
- שלב 5 הושלם — הדלת הקבועה הוכחה חי! בדרך התגלה ותוקן באג אמיתי (היו שני "ארנקי גוגל" והדלת השתמשה בלא-נכון); אור עשה 2 קליקים בקונסולה + 2 קליקי אישור, והבדיקה הסופית ירוקה: החיבור המשותף של גוגל עובד דרך הבית הקבוע, בלי or-adhd-agent בכלל. אפשר לפרק.
- שלב 6 הושלם — or-adhd-agent פורקה באישור אור (Railway נמחק, הריפו אורכב, ה-DNS הוסר) ואומתה כנעלמה. שני צינורות ישנים שהצביעו עליה נמחקו. פרויקט הענן והארנק של גוגל לא נגעו — שמורים להעברה המסודרת.
- שלב 7 הושלם — שלוש מערכות-הטסט (or-tok, tokile, or-edri-2) פורקו באישורי אור, ו-project-life-130 (שריד ישן) נמחקה במסלול ייעודי: Railway אחרי תצוגה-מקדימה מאומתת, והריפו בהקשת ✅ בטלגרם. אומת בסוף: Railway ריק לגמרי (0 פרויקטים).
- **הפיתוח נסגר (2026-06-11):** הדלת הקבועה של גוגל חיה ומוכחת ב-gateway, וכל 5 המערכות הישנות פונו. המשך מתוכנן בנפרד: העברת "הארנק" של גוגל מהפרויקט הישן (factory-test-7) אל פרויקט-הבקרה — באישור אור, כפיתוח חדש.
