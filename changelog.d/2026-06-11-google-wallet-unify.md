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
  `/dev-stage` ללא golden) — נרשם כ-follow-up. (אך ה-smoke המשיך להיכשל גם עם 17 scopes — ראה הבא.)
- **שלב 4 (המשך) — תיקון תווית-החשבון (`shared-google` הבדוי → `edriorp38` האמיתי):** ה-smoke נכשל גם אחרי תיקון
  ה-scopes (4 פעמים סה"כ). השורש (אישר Or ישירות): `shared-google@or-infra.com` הוא **חשבון בדוי** — תווית שסשן
  קודם המציא ושתועדה בטעות כעובדה ב-`docs/google-identities.md`; החשבון האמיתי של or-infra הוא
  `edriorp38@or-infra.com`, והטוקן שייך לו. ה-workspace-mcp שנבנה-מחדש אוכף שחשבון-הטוקן תואם ל-
  `WORKSPACE_GOOGLE_ACCOUNT_LABEL` (הגרסה הישנה לא אכפה — לכן התווית הבדויה "סתם עבדה"). התיקון:
  `WORKSPACE_GOOGLE_ACCOUNT_LABEL` (`render-mcp-service-yaml.sh`) + `LABEL` (`entrypoint.sh`) +
  `GOOGLE_ACCOUNT_LABEL` (`google-mcp-smoke.py`) → `edriorp38@or-infra.com`, **בלי consent נוסף** (הטוקן כבר שלו)
  + תיקון התיעוד השגוי (`docs/google-identities.md` + `CLAUDE.md` → 2 חשבונות אמיתיים; `edriorp38` = אדמין +
  תיבת-ה-data של הסוכנים; אין `shared-google`).
- **שלב 4 (סיום) — הפעלת ה-GCP APIs + smoke ירוק:** עם החשבון תואם, ה-smoke חשף ש-Gmail/Calendar/Drive/Docs APIs
  לא מופעלים בפרויקט-הבקרה (140345952904) — היו ב-factory-test-7. ניסיון אוטונומי דרך `gcp-action` (סווג red →
  כרטיס-טלגרם → ✅ של Or → execute) נכשל ב-`AUTH_PERMISSION_DENIED`: לברוקר SA אין `serviceusage.services.enable`
  על control. Or הפעיל את 4 ה-APIs בקונסולה כ-edriorp38 (הבעלים). **הוכחה סופית: `google-mcp-smoke` ירוק 6/6
  (run 27344835076)** — bearer → init → 58 כלי → `list_gmail_labels` אמיתי (User: `edriorp38@or-infra.com`) →
  Drive+Docs → `search_drive_files` אמיתי. **הארנק המאוחד מוכח end-to-end.** (Follow-up: לתת לברוקר
  `serviceUsageAdmin` על control כדי שהפעלת-API תהיה אוטונומית.)
- **שלב 5 — ארנק אחד → צרור-מפתחות אחד (פרישת הכפילות `google-oauth-client-*`):** ה-gateway קרא עד כה את
  לקוח-הגוגל המאוחד משני זוגות-סוד שהחזיקו את *אותו* לקוח (`google-oauth-client-*` ל-login, `gmail-oauth-client-*`
  ל-workspace). מיקדנו לזוג יחיד: ב-`scripts/render-mcp-service-yaml.sh` ה-LOGIN env (`GOOGLE_OAUTH_CLIENT_*`)
  מצביע עכשיו על `gmail-oauth-client-*` (כמו ה-WORKSPACE env → שני ה-env נפתרים לזוג אחד); ב-
  `.github/workflows/deploy-mcp-server.yml` הוסרו `google-oauth-client-*` מלולאת ה-placeholder ומקריאות ה-`seed`
  (נשאר רק זוג ה-gmail, מאותו repo-secret `GOOGLE_OAUTH_CLIENT_{ID,SECRET}`). הערה לא-מדויקת ב-
  `services/mcp-server/src/google-oauth.ts` ("TWO OAuth clients exist") תוקנה למציאות המאוחדת — **הערה-בלבד,
  אפס שינוי-התנהגות**. **ערך-זהה:** שני הזוגות החזיקו את אותו לקוח, אז מיקוד ה-login שקוף (ה-login ממשיך לעבוד);
  ‏`google-oauth-client-*` הופכים ליתומים לא-מחוברים (נשארים ב-SM כ-rollback — תמיד addVersion, לעולם לא destroy;
  disable אופציונלי מאוחר יותר). אפס שינוי ב-`templates/system/**` → `/dev-stage` רגיל (בלי golden gate). הוכחה
  אחרי מיזוג+פריסה: round-trip התחברות + `google-mcp-smoke` ירוק + `list_secret_metadata` מאשר ש-
  `google-oauth-client-*` לא צבר גרסאות.
- **שלב 5 (הוכח) + שלב 6 + סגירה:** PR #402 מוזג (אחרי rebase על main עקב פיתוח מקביל `button-send-outcome-trace`
  שמוזג בו-זמנית — **אפס קונפליקט אמיתי**, קבצים נפרדים), `deploy-mcp-server.yml` פרס רוויזיה חדשה (run 27346755248).
  **הוכחה end-to-end:** ה-gateway חי (probe `/oauth/authorize` → `Missing redirect_uri`, לא `invalid_client`);
  **`google-mcp-smoke` ירוק** (run 27347132075 — workspace דרך הזוג היחיד); `list_secret_metadata` מאשר
  ש-`google-oauth-client-*` נשארו **3/3** (יתומים, לא-מחוברים) ו-`gmail-oauth-client-*` 2/2. Or בחר **להשאיר את
  היתומים מתועדים** (לא disabled — נשמרים כ-rollback, אינם מזיקים; הרוויזיה החדשה לא ממפה אותם). **שלב 6:** הארנק נולד
  בשלב 1 עם בדיוק 2 כתובות-החזרה, ושתיהן מוכחות חיות (`/oauth/callback` בשלב 1, `/workspace/consent/callback`
  בשלב 4 + ה-smoke החי) → אין מה לגזום. **הפיתוח נסגר (`status: completed`): ארנק אחד נקי ב-`or-factory-master-control`,
  מוכח חי.** גבול נפרד (באישור Or): פירוק `factory-test-7` (651677607847) + 2 הארנקים הישנים + מסך-ה-consent + ה-client
  הלא-קשור `Cloudflare Access - Nuriel`. follow-up: `inspect_cloud_run` של ה-MCP עדיין מצביע על הפרויקט הישן
  `factory-control-9piybr`; `serviceUsageAdmin` לברוקר; עדכון `templates/system/**` (scopes 6→17, label) ל-`/dev-stage-factory`.
