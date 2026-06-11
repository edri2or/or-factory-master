## איחוד "הארנק של גוגל" לארנק אחד בפרויקט-הבקרה (google-wallet-unify)

follow-up מ-google-door-cleanup. מאחדים את שני ה-OAuth clients של גוגל ("ארנקים") לאחד שיושב
ב-`or-factory-master-control` (במקום ב-factory-test-7 הנטוש), מוכיחים חי ש-`google-mcp-smoke` ירוק,
ומשאירים צרור-מפתחות אחד נקי. Option A' (`/dev-stage` רגיל; שינוי-TS מינימלי רק לתיקון ה-scopes בשלב 4).

- **תיעוד זהויות-גוגל (`docs/google-identities.md` + `CLAUDE.md`):** מופו, עם ראיות IAM + קוד, שלושת
  חשבונות-גוגל ותפקיד כל אחד — `edriorp38@or-infra.com` (מפעיל/אדמין: `owner` של פרויקט-הבקרה,
  `owner`+`oauthconfig.editor` של factory-test-7; חשבון-הקונסולה ב-`authuser=1`), `shared-google@or-infra.com`
  (תיבת-ה-data שהסוכנים משתמשים בה; זהות `gmail-oauth-refresh-token`), `edri2or@gmail.com` (האישי: billing,
  יוצר-הארגון, ה-`OAUTH_ALLOWED_EMAILS` הנוכחי — וה*מטרה* הסופית שהסוכנים נועדו לשרת). מסגרת ה-WHY של Or:
  `or-infra.com`=תשתית (אמצעי), `edri2or@gmail.com`=החיים האמיתיים (מטרה). כדי שאף סשן לא יחזור לברירת-המחדל
  השגויה `edri2or` לעבודת קונסולה/OAuth.
- **שלב 2 — הרחבת זריעת-הסודות ב-`deploy-mcp-server.yml`:** ה-repo-secret `GOOGLE_OAUTH_CLIENT_{ID,SECRET}`
  נזרע עכשיו לא רק ל-`google-oauth-client-*` (login) אלא גם ל-`gmail-oauth-client-*` (workspace) — אותו
  id/secret לכל ארבע המגירות, כך ש-repo-secret אחד מחבר את כל הזהויות לאותו ארנק מאוחד. ה-helper `seed()`
  (idempotent, ממוסך, "מוסיף-גרסה-רק-אם-שונה") + לולאת ה-placeholder הורחבו לכלול את שני שמות-ה-gmail. הוכחה:
  yamllint + shellcheck ירוקים; השינוי **אינרטי** עד המיזוג בשלב 4 (החיבור החי = הלבנה האחרונה).
- **שלב 4 — ההחלפה החיה + תיקון scopes:** מוזג ל-main → `deploy-mcp-server.yml` הזריע את הארנק המאוחד
  (`140345952904-csqtb1…`) לכל 4 מגירות-ה-SM, ‏Or עשה consent, פריסה-מחדש — אך ה-smoke חשף **פער-scopes**:
  ה-sidecar (`--tools calendar gmail drive docs`) דורש 17 הרשאות, והדלת ביקשה רק 6; הארנק הישן הסתיר זאת (צבר
  את ה-17 לאורך זמן), הארנק החדש "הנקי" קיבל רק 6 → "Authentication Needed" (אובחן מלוגי ה-sidecar ב-Cloud Run).
  התיקון: `WORKSPACE_SCOPES` (`services/mcp-server/src/google-oauth.ts`) + `WORKSPACE_MCP_SCOPES`
  (`scripts/render-mcp-service-yaml.sh`) + ברירת-המחדל ב-`services/workspace-mcp/entrypoint.sh` הורחבו ל-17
  (byte-equal: gmail read/compose/modify/send/labels/settings.basic + calendar(×3) + drive(×3) + docs(×2) +
  openid/userinfo.email/userinfo.profile), והבדיקות עודכנו (92/92 ירוק מקומית). תבנית-המערכת
  (`templates/system/.github/workflows/bootstrap-gmail-oauth.yml`) **לא** נגעה (אין מערכות חיות; שומר על
  `/dev-stage` ללא golden) — נרשם כ-follow-up. הוכחה סופית: `google-mcp-smoke` ירוק אחרי consent-מחדש + פריסה.
