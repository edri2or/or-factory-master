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
