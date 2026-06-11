## איחוד "הארנק של גוגל" לארנק אחד בפרויקט-הבקרה (google-wallet-unify)

follow-up מ-google-door-cleanup. מאחדים את שני ה-OAuth clients של גוגל ("ארנקים") לאחד שיושב
ב-`or-factory-master-control` (במקום ב-factory-test-7 הנטוש), מוכיחים חי ש-`google-mcp-smoke` ירוק,
ומשאירים צרור-מפתחות אחד נקי. Option A' (אפס שינוי TypeScript ב-gateway), `/dev-stage` רגיל.

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
