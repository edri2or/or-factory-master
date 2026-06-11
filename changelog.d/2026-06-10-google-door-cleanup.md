## העברת "הדלת של גוגל" למקום קבוע + פירוק 5 מערכות ישנות (google-door-cleanup)

follow-up #7 מ-mcp-birth-bundle. בונים דלת-consent קבועה ב-gateway שלוכדת את טוקן הרענון
המשותף (6 הרשאות) וכותבת אותו ל-control SM, מוכיחים חי בלי or-adhd-agent, ואז מפרקים את
or-adhd-agent, or-tok, tokile, or-edri-2, project-life-130 (Railway + ריפו לכל אחת).

- **שלב 1 — כתיבת-סוד ל-Secret Manager + הרשאה ממוקדת:** `gcp-client.ts` קיבל
  `addSecretVersion` + בונה-בקשה טהור `buildAddSecretVersionRequest` (REST `:addVersion`,
  base64, הוספה-בלבד — לעולם לא מחיקה, כך שהגרסה הישנה נשמרת כ-rollback). `deploy-mcp-server.yml`
  מעניק ל-runtime SA את `roles/secretmanager.secretVersionAdder` על `gmail-oauth-refresh-token`
  בלבד (ממוקד-משאב, best-effort). `render-mcp-service-yaml.sh` חושף `CONTROL_PROJECT`.
  הוכחה: בדיקת יחידה (`test/secret-version.test.mjs`, node --test) ירוקה (84/84) ב-Playground.
- **שלב 2 — קישור-ההתחברות + route ההתחלה:** `google-oauth.ts` קיבל `WORKSPACE_SCOPES`
  (6, byte-equal ל-`WORKSPACE_MCP_SCOPES`) + `workspaceConsentUrl()` (אח ל-login: ‏6 הרשאות,
  `access_type=offline`, `prompt=consent`). `index.ts` קיבל מפת `pendingConsent` (TTL) +
  ‏`GET /workspace/consent/start` (gated ב-`x-admin-secret`, ‏302 לגוגל). ה-login לא נגעתי.
  הוכחה: בדיקות `workspaceConsentUrl` + regression-guard ל-login ירוקות (87/87).
- **שלב 3 — הלוכד (callback) + שמירה ל-SM + שומרים:** `google-oauth.ts` קיבל
  `parseWorkspaceConsentResponse` (טהור: דורש `refresh_token` + **scope-equality guard**
  על בדיוק 6, order-insensitive) + `exchangeWorkspaceConsentCode`. `index.ts` קיבל
  ‏`GET /workspace/consent/callback` (ולידציית `state` חד-פעמי+TTL, ‏`?error=`, exchange,
  ואז `addSecretVersion(CONTROL_PROJECT,'gmail-oauth-refresh-token',token)`). הוכחה: בדיקות
  ‏`parseWorkspaceConsentResponse` (happy/order-insensitive/missing-token/scope-mismatch) ירוקות (91/91).
- **שלב 4 — חיווט-מחדש של workflow ההתחברות:** `request-workspace-scopes-consent.yml` נכתב
  מחדש להיות מונע-gateway: הוסרה כל לוגיקת or-adhd-agent/n8n/factory-test-7; auth כברוקר
  (WIF) → `gcloud run describe` לכתובת ה-gateway → `mcp-server-admin-secret` (ממוסך) →
  ‏`GET /workspace/consent/start` (לוכד את ה-Location ב-`-w redirect_url`) → קישור consent
  ל-Or בטלגרם. כך ההתחברות ממשיכה לעבוד גם אחרי פירוק or-adhd-agent. הוכחה: yamllint +
  shellcheck(severity=error) נקיים; ריצה חיה בשלב 5.
- **שלב 5 (תיקון, 2026-06-11) — הדלת טובעת עם ה-client המשותף:** ההוכחה החיה חשפה
  **שני** OAuth clients: ‏login (`google-oauth-client-*`, ה-gateway) ו-workspace
  (`gmail-oauth-client-*` — איתו מרעננים ה-sidecar וה-n8n של כל המערכות). הדלת טבעה את
  הטוקן עם ה-login client → ‏`unauthorized_client` ברענון ה-sidecar (אובחן ברענון ידני של
  כל גרסאות הסוד). התיקון: ‏consent door משתמש ב-`WORKSPACE_OAUTH_CLIENT_{ID,SECRET}`
  (חדש ב-`GATEWAY_SECRETS` ← ‏`gmail-oauth-client-*`) + ‏`workspaceConsentConfigured()`;
  ה-login לא שונה (regression-guard בבדיקות). שחזור: גרסת הטוקן השגויה כובתה והערך העובד
  נוסף כגרסה חדשה (כיבוי-בלבד מפיל deploy — ‏Cloud Run ‏latest→DISABLED; לקח לתפעול).
  הוכחה: 92/92 ‏node --test (כולל client-נכון-לכל-flow) + shellcheck; ‏smoke חי אחרי המיזוג.
- **שלב 5 נסגר (2026-06-11):** הדלת הקבועה הוכחה end-to-end: שחזור (גרסת הטוקן העובדת
  הוחזרה כגרסה חדשה) → ‏smoke ירוק; תיקון ‎#391 מוזג ונפרס; ‏Or רשם את 2 כתובות ה-callback
  על ה-**client המשותף** והשלים consent חי דרך הדלת → גרסה 5 נלכדה ל-control SM →
  ‏redeploy → ‏**google-mcp-smoke ירוק** (run 27318763907) — בלי or-adhd-agent בנתיב.
  ‏or-adhd-agent כבר לא מחזיקה שום תפקיד בחיי ה-consent; הפירוק (שלבים 6–7) נפתח.
- **שלב 6 — פירוק or-adhd-agent + מחיקת הצינורות המתים:** ‏`decommission-test-system.yml`
  רץ באישור ✅ ייעודי של Or ‏(run 27319026790, SUCCESS): ‏Railway נמחק, הריפו אורכב, ‏DNS
  הוסר — אומת בלתי-תלוי (`list_railway_projects` ירד ל-4; ‏`archived:true`). פרויקט ה-GCP
  ‏factory-test-7 לא נגוע (מחזיק את ה-OAuth client עד פיתוח-ההעברה). נמחקו שני workflows
  של עידן-or-adhd-agent: ‏`rotate-shared-gmail-token.yml` (משגר workflow בריפו שאורכב)
  ו-`copy-gmail-oauth-to-control.yml` (השרשרת n8n→extract→copy הוחלפה בדלת הקבועה).
