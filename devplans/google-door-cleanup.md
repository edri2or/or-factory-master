---
dev_name: העברת "הדלת של גוגל" למקום קבוע + פירוק 5 מערכות ישנות
slug: google-door-cleanup
opened: 2026-06-10
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 2 | קישור-ההתחברות + route ההתחלה | pending | `services/mcp-server/src/google-oauth.ts` (+test), `services/mcp-server/src/workspace-consent.ts` (חדש), `index.ts` |
| 3 | לוכד ה-callback + שמירה ל-SM + שומרים | pending | `services/mcp-server/src/workspace-consent.ts` (+test) |
| 4 | חיווט-מחדש של workflow ההתחברות ל-gateway | pending | `.github/workflows/request-workspace-scopes-consent.yml` |
| 5 | מיזוג → פריסה → רישום כתובת + consent חי + smoke (אבן-דרך חיה) | pending | מיזוג ל-main + קונסולת גוגל + control SM |
| 6 | פירוק or-adhd-agent + פרישת הצינורות הישנים | pending | dispatch `decommission-test-system.yml`; retire `rotate-shared-gmail-token.yml` + נתיב rotate ב-`copy-gmail-oauth-to-control.yml` |
| 7 | פירוק 4 הנותרות + סגירה | pending | dispatch `decommission-test-system.yml` ×4 |

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
- [ ] `workspaceConsentUrl()` + `exchangeWorkspaceConsentCode()` נוספו כאחים ב-`google-oauth.ts` בלי לגעת בפונקציות ה-login (`googleAuthorizeUrl`/`exchangeGoogleCode`), בשימוש-חוזר ב-`googleConfigured`/`emailAllowed`/`GOOGLE_TOKEN_URL`.
- [ ] מודול חדש `workspace-consent.ts` עם `registerWorkspaceConsent(app)` + `GET /workspace/consent/start` (גדור ב-`secretMatches` + `googleConfigured`); `index.ts` מייבא וקורא.
- [ ] Playground ירוק.

**הוכחה תפקודית (באותו שלב):** (1) בדיקת יחידה ל-`workspaceConsentUrl` מאמתת מחרוזת
מדויקת: `scope` = 6 ההרשאות בסדר של `WORKSPACE_MCP_SCOPES`, `access_type=offline`,
`prompt=consent`, `redirect_uri=.../workspace/consent/callback`. (2) בדיקת אינטגרציה
(express in-process) ל-`/workspace/consent/start`: עם admin-secret נכון → 302 ל-`accounts.google.com`; בלעדיו → 403. נצפה: ירוק ב-CI.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — לוכד ה-callback + שמירה ל-SM + שומרים

**Acceptance:**
- [ ] `GET /workspace/consent/callback` ב-`workspace-consent.ts`: ולידציית `state` מול map ייעודי `pendingConsent` (TTL, חד-פעמי, נפרד מ-`pendingAuth`); טיפול ב-`?error=`; החלפת code→refresh_token; **scope-equality guard** (לא כותב אם לא חזרו בדיוק 6); ואז `addSecretVersion('or-factory-master-control','gmail-oauth-refresh-token',token)`.
- [ ] Playground ירוק.

**הוכחה תפקודית (באותו שלב):** בדיקות אינטגרציה (mock ל-token endpoint של גוגל + mock
ל-`addSecretVersion`): ‏(a) state תקין + 6 scopes → `addSecretVersion` נקרא פעם אחת עם
`gmail-oauth-refresh-token`; ‏(b) scope-mismatch → לא נכתב + שגיאה; ‏(c) state פג/חסר → 400
בלי כתיבה; ‏(d) `?error=` → מוצג בלי כתיבה; ‏(e) חסר refresh_token → 502 בלי כתיבה. נצפה:
כל הבדיקות ירוקות ב-CI.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — חיווט-מחדש של workflow ההתחברות ל-gateway

**Acceptance:**
- [ ] `request-workspace-scopes-consent.yml` עבר חיווט: מסיר את כל לוגיקת or-adhd-agent/n8n/factory-test-7; קורא `mcp-server-admin-secret` (WIF→SM), קורא ל-`/workspace/consent/start` בצד-שרת עם `X-Admin-Secret`, ושולח ל-Or את קישור ה-consent (שה-redirect שלו ל-gateway) בטלגרם.
- [ ] shellcheck/yamllint ירוקים; אין יותר הפניה ל-or-adhd-agent בנתיב ה-consent.

**הוכחה תפקודית (באותו שלב):** ה-workflow רץ רק מ-main (`if: refs/heads/main`), אז ההוכחה
ה*חיה* היא הלבנה האחרונה — שלב 5, אחרי המיזוג. בשלב הזה: הוכחת-בנייה סטטית — shellcheck +
grep מאמת שמחרוזת ה-URL הנבנית היא `${GATEWAY}/workspace/consent/start` ושאין יותר
`SYSTEM_NAME: or-adhd-agent` בנתיב. (חיבור-חיצוני = לבנה אחרונה, מותר.)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — מיזוג → פריסה → רישום כתובת + consent חי + smoke (אבן-דרך חיה)

הלבנה החיה האחרונה של הדלת. דורש ✅ של Or: מיזוג (פריסת השירות המרכזי) + הקליק הידני
בקונסולת גוגל + קליק ה-consent.

**Acceptance:**
- [ ] PR-הדלת מוזג ל-main → `deploy-mcp-server.yml` פרס את ה-gateway החדש (אומת SUCCESS).
- [ ] הכתובת `https://factory-master-actions-mcp-140345952904.me-west1.run.app/workspace/consent/callback` נוספה ל-Authorized redirect URIs של ה-client המשותף (קליק ידני של Or — הוראה מדויקת).
- [ ] consent חי הושלם (Or לחץ) → גרסה חדשה של `gmail-oauth-refresh-token` ב-control SM (הישנה נשמרה כ-rollback).
- [ ] `google-mcp-smoke` ירוק עם הטוקן החדש (Gmail+Calendar+Drive+Docs + `search_drive_files` אמיתי, בלי "Scope has changed"); or-adhd-agent לא בנתיב.
- [ ] ה-workflow המחובר-מחדש (שלב 4) רץ חי ושולח קישור שה-redirect שלו ל-gateway.

**הוכחה תפקודית (באותו שלב):** `probe_endpoint` ל-`/workspace/consent/start` → 302 עם 6
ה-scopes; `list_secret_metadata gmail-oauth-refresh-token` מראה גרסה חדשה בתאריך 2026-06-10;
‏`google-mcp-smoke` workflow ירוק. קלט: consent אמיתי של Or. **ירוק כאן פותח את הפירוק.**

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — פירוק or-adhd-agent + פרישת הצינורות הישנים

**Acceptance:**
- [ ] `decommission-test-system.yml` רץ ל-`or-adhd-agent` (`shared_gcp_project=factory-test-7`); Railway `fa36eab4-…` נמחק, `edri2or/or-adhd-agent` מאורכב, DNS `n8n-or-adhd-agent` הוסר.
- [ ] `rotate-shared-gmail-token.yml` + נתיב ה-rotate ב-`copy-gmail-oauth-to-control.yml` פורשו (מצביעים לריפו מת).

**הוכחה תפקודית (באותו שלב):** `list_railway_projects` כבר לא מציג or-adhd-agent;
`get_repo or-adhd-agent` → `archived:true`; `list_dns_records` — ה-CNAME נעלם. קלט: dispatch
+ ✅ של Or. נצפה: שלושתם מאומתים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — פירוק 4 הנותרות + סגירה

**Acceptance:**
- [ ] `decommission-test-system.yml` רץ ל-`or-tok` (factory-test-25), `tokile` (factory-test-18), `or-edri-2` (factory-test-25), `project-life-130` — כל אחת עם ✅ נפרד; כל Railway נמחק + ריפו מאורכב.
- [ ] לכל מערכת אומת ש-`GCP_PROJECT_ID` של הריפו == הפרויקט-הטסט המשותף (שער ה-reuse); אם project-life-130/or-edri-2 לא תואמות — מסלול ישיר ל-Railway+ריפו.
- [ ] התוכנית נסגרה (`status: completed`).

**הוכחה תפקודית (באותו שלב):** לכל מערכת — `list_railway_projects` לא מציג אותה +
`get_repo` `archived:true`. קלט: 4 dispatches עם ✅ נפרד. נצפה: 4 פירוקים מאומתים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- הפיתוח נפתח (2026-06-10): בונים דלת קבועה ב-gateway, מוכיחים חי, ואז מפרקים 5 מערכות ישנות — הכל בשערי ✅.
- שלב 1 הושלם — נתתי ל-gateway יכולת בטוחה לשמור את הטוקן החדש (הוספה בלבד, אף פעם לא מחיקה). בדיקה אוטומטית ירוקה.
