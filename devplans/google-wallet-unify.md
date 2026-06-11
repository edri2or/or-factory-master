---
dev_name: איחוד "הארנק של גוגל" לארנק אחד בפרויקט-הבקרה
slug: google-wallet-unify
opened: 2026-06-11
status: active   # active בזמן פיתוח → completed בסיום
---

# תוכנית פיתוח — איחוד "הארנק של גוגל" לארנק אחד בפרויקט-הבקרה

## מטרה

follow-up מסגירת `google-door-cleanup`. היום יש **שני** OAuth clients ("ארנקים") של
גוגל, וה-workspace שבהם יושב פיזית בפרויקט הנטוש `factory-test-7` (מספר 651677607847).
מאחדים אותם ל**ארנק אחד** שיושב בפרויקט-הבקרה `or-factory-master-control`, מוכיחים חי
ש-`google-mcp-smoke` ירוק, ומשאירים **צרור-מפתחות אחד נקי** ב-SM. בסוף `factory-test-7`
מאבד את תפקידו האחרון (פירוקו — פיתוח נפרד באישור Or).

חלון הזדמנות: ‏Railway = 0 פרויקטים → אף מערכת חיה לא צורכת את הטוקן; הצרכן החי היחיד
הוא ה-gateway עצמו, אז רדיוס-הפגיעה בזמן ההחלפה הוא כלי-הגוגל של ה-gateway + ההתחברות,
לכמה דקות. בחירת Or: **איחוד מלא + ניקיון** (עד צרור-מפתחות אחד, כולל שלב 5).

גישה: **Option A'** — להזריק את כל 4 שמות-הסוד לאותו client חדש (אפס שינוי TypeScript
ב-gateway), ואז לכוון את ה-login לקרוא את הזוג ששרד (`gmail-oauth-client-*`) ולפרוש את
`google-oauth-client-*`. לא נוגע ב-`templates/system/**` → זה `/dev-stage` רגיל (לא factory).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | סיור קריאה-בלבד: מסך-ההסכמה הקיים + בתי-ה-clients (Or מדווח) | completed | — (קונסולת גוגל, קריאה בלבד) |
| 1 | Or יוצר את ה-client המאוחד + מסך-consent ב-control | completed | — (קונסולת גוגל) |
| 2 | הרחבת זריעת-הסודות ב-deploy לכסות את שני זוגות-ה-clients | completed | `.github/workflows/deploy-mcp-server.yml` |
| 3 | Or מזריק את מפתחות ה-client החדש ל-repo secrets + תיעוד rollback | completed | — (GitHub repo secrets) |
| 4 | ההחלפה החיה (scopes 6→17 + תווית-חשבון + הפעלת APIs): smoke ירוק 6/6 | completed | deploy + control SM + `google-oauth.ts`/`render-mcp-service-yaml.sh`/`entrypoint.sh`/`google-mcp-smoke.py` + GCP APIs |
| 5 | פרישת הכפילות `google-oauth-client-*` → ארנק אחד + צרור-מפתחות אחד | in-progress | `scripts/render-mcp-service-yaml.sh`, `.github/workflows/deploy-mcp-server.yml`, `services/mcp-server/src/google-oauth.ts` (הערה) |
| 6 | ניקוי: השארת רק 2 ה-redirect URIs החיים על ה-client המאוחד | pending | — (קונסולת גוגל) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** בנייה מלמטה-למעלה — recon → יצירת ה-client → צנרת-קוד (הוכחה
> סטטית) → הזרקת מפתחות (אינרטי) → ההחלפה החיה (smoke = הלבנה האחרונה) → פרישה → ניקוי.
> ה-consent החי וה-smoke הם החיבור החיצוני האחרון, לא כלי-הבדיקה הראשון.

---

### שלב 0 — סיור קריאה-בלבד: מסך-ההסכמה הקיים + בתי-ה-clients

‏Or פותח את קונסולת גוגל (קריאה בלבד, אפס כתיבה) ומדווח 4 קריאות שמכריעות את ההמשך.

**Acceptance:**
- [x] ‏Or דיווח: **User Type = External** + **Publishing status = In production** (מסך-ההסכמה של `factory-test-7`, מסך "Google Auth Platform / Audience"). OAuth user cap 1/100.
- [x] בתי-ה-clients אומתו: ה-LOGIN client = `n8n MCP gateway` (`651677607847-cs19…`, נוצר Jun 3) **ב-factory-test-7** (מאשר ששני הארנקים ב-factory-test-7); ה-WORKSPACE client = `or-adhd-agent n8n` (`651677607847-s1f0…`, Jun 2).
- [x] נקלטו שמות 3 ה-clients (כולל גילוי שלישי לא-קשור — ראה הערה). ה-redirect URIs הספציפיים של הישנים מיותרים — ה-client החדש נבנה נקי בשלב 1.
- [x] **הכרעת ה-CRUX:** External + In production → **single-client GO** (לא צריך מסלול-גיבוי).

**הוכחה תפקודית (באותו שלב):** שלב החלטה/קריאה — ההוכחה היא הקריאות המילוליות של Or (2 צילומי-מסך),
מצולבות מול ה-SM label `copied-from: factory-test-7` (מאומת על `gmail-oauth-client-*`). הפלט: ורדיקט
**single-client GO**. בוצע 2026-06-11.

**הערת התקדמות אחרונה:** הושלם (2026-06-11). Or דיווח מהקונסולה: מסך-ההסכמה של factory-test-7 הוא
**External + In production** → ה-CRUX נפתר לטובת **client-אחד** (אותו client יכול לשרת login עם gmail
רגיל וגם workspace עם טוקן ארוך-טווח; אין fallback). שלושה clients ב-factory-test-7: `or-adhd-agent n8n`
(`…s1f0` = WORKSPACE), `n8n MCP gateway` (`…cs19`, Jun 3 = LOGIN — מאשר ששני הארנקים שם), ו-`Cloudflare
Access - Nuriel` (`…pj46`, Jun 4) — **שלישי לא-קשור** (Cloudflare Access), נרשם לפירוק factory-test-7
הנפרד. OAuth user cap 1/100 → אזהרת 'unverified app' צפויה בקליק ה-consent (כמו היום, תקין).

**שינוי תוכנית:** —

---

### שלב 1 — Or יוצר את ה-client המאוחד + מסך-consent ב-control

‏Or מבצע את הקליקים בקונסולה (לפי ההוראות המדויקות שאספק) — יוצר מסך-consent ב-control
(External, In production) ו-client אחד מסוג Web עם **בדיוק** 2 ה-redirect URIs.

**Acceptance:**
- [x] מסך-ה-consent ב-`or-factory-master-control` נוצר: User Type External. (Published/In production — לאישור Or; חובה לפני שלב 4.)
- [x] ‏client אחד מסוג "Web application" נוצר; שני ה-redirect URIs רשומים — **הוכח** (probe → 200, בלי mismatch):
      `https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app/oauth/callback`
      `https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app/workspace/consent/callback`
- [x] ‏Or העתיק את ה-Client ID (`140345952904-csqtb1…`) + Client secret (שמור אצל Or לשלב 3; לא לצ'אט).

**הוכחה תפקודית (באותו שלב):** הוכחת-נגישות נטולת-סוד (לא click-through): `probe_endpoint` ל-URL
ההרשאה של גוגל שנבנה עם ה-client_id החדש + ה-redirect של workspace + `scope=openid email` →
לאשר HTTP 200 דף-גוגל, ו**לא** `redirect_uri_mismatch`/`invalid_client`. מוכיח שה-client קיים
וה-redirect רשום — לפני שמחווטים סוד כלשהו. הפיך לגמרי (מחיקת ה-client).

**הערת התקדמות אחרונה:** הושלם + הוכח (2026-06-11). Or יצר ב-`or-factory-master-control` מסך-consent
(External) + client אחד מסוג Web. **Client ID `140345952904-csqtb1hlrbk7keuukt7al5prhn6gbnt3.apps.googleusercontent.com`**
(התחילית `140345952904` = מספר פרויקט-הבקרה → הארנק נולד ב-control ✓). **הוכחת-נגישות:** GET לדף ההרשאה
של גוגל עם ה-client_id + כל אחת מ-2 כתובות-החזרה → HTTP 200 + דף sign-in, **בלי** `redirect_uri_mismatch`/
`invalid_client` → הארנק קיים ושתי הכתובות רשומות נכון. ה-secret אצל Or לשלב 3. פתוח לאישור: ש-Or פרסם ל-In production.
**זהות-חשבונות (תוקן — ראה `docs/google-identities.md`):** הקליקים בקונסולה + ה-support/contact email
של מסך-ה-consent = **`edriorp38@or-infra.com`** (חשבון-המפעיל; `authuser=1`), **לא** `edri2or@gmail.com`.

**שינוי תוכנית:** —

---

### שלב 2 — הרחבת זריעת-הסודות ב-deploy לכסות את שני זוגות-ה-clients (קוד; ענף-עבודה)

ב-`.github/workflows/deploy-mcp-server.yml`: להוסיף `seed gmail-oauth-client-id` +
`seed gmail-oauth-client-secret` ליד שתי הקיימות (שורות ~298-299), מאותם `GH_*` ממוסכים;
להוסיף את שני שמות-ה-gmail ללולאת ה-placeholder (שורה ~258) כרשת-ביטחון idempotent (כבר קיימים → no-op).
כך שינוי repo-secret אחד מזריק את כל 4 שמות-ה-SM לאותו client חדש.

**Acceptance:**
- [ ] 4 קריאות `seed` מצביעות על אותו זוג `GH_GOOGLE_CLIENT_ID/SECRET`.
- [ ] לולאת ה-placeholder כוללת את 4 שמות-ה-clients.
- [ ] ‏actionlint + yamllint נקיים; שער ה-devplan + ה-changelog (fragment) מעודכנים באותו commit.

**הוכחה תפקודית (באותו שלב):** הוכחת-בנייה — yamllint + shellcheck(severity=error) נקיים; grep/סקירה
שמאמתת 4 קריאות `seed` עם אותם 2 ה-`GH_*`. ה-helper `seed()` כבר **מוכח-ייצור** (רץ על
`google-oauth-client-*` בפיתוח הקודם). **אין פריסה כאן** — השינוי אינרטי עד המיזוג בשלב 4
(החיבור החי = הלבנה האחרונה). Playground ב-CI לאישור.

**הערת התקדמות אחרונה:** הושלם (2026-06-11). נכתב ב-`deploy-mcp-server.yml`: לולאת ה-placeholder כוללת
עכשיו את 4 שמות-ה-clients, וצעד ה-`seed` מזריע את אותו `GOOGLE_OAUTH_CLIENT_{ID,SECRET}` (repo-secret) גם
ל-`gmail-oauth-client-*` (4 קריאות `seed`, אותם 2 `GH_*`). **כל 5 בדיקות ה-CI ירוקות** על PR #397
(Changelog gates, shellcheck+yamllint, Playground, Scan secrets, Supply chain). אינרטי עד המיזוג בשלב 4.

**שינוי תוכנית:** —

---

### שלב 3 — Or מזריק את מפתחות ה-client החדש ל-repo secrets + תיעוד rollback

**Acceptance:**
- [x] הסוכן רשם (דרך `list_secret_metadata`, בלי גישה-לערך) את מוני-הגרסאות הנוכחיים של 4 סודות-ה-client + `gmail-oauth-refresh-token` (ה-rollback השלם — מוסיפים גרסה בלבד): 2 / 2 / 1 / 1 / 4.
- [x] ‏Or עדכן את repo secrets `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` לערכי ה-client המאוחד החדש (נתיב ממוסך; ערכים לעולם לא בצ'אט/לוג).

**הוכחה תפקודית (באותו שלב):** תצפיתי — GitHub מציג שהסודות "Updated"; הסוכן מאמת מחדש דרך
`list_secret_metadata` ש-4 סודות-ה-SM **לא קיבלו גרסה חדשה** (שלב 3 אינרטי, ה-rollback שלם).
אין שינוי-התנהגות. הפיך לגמרי (SM + ה-gateway החי לא נגעו).

**הערת התקדמות אחרונה:** in-progress (2026-06-11) — baseline ל-rollback נרשם (גרסאות SM נוכחיות בפרויקט-הבקרה:
`google-oauth-client-id`=2, `google-oauth-client-secret`=2, `gmail-oauth-client-id`=1, `gmail-oauth-client-secret`=1,
`gmail-oauth-refresh-token`=4; מוסיפים-גרסה בלבד → כולן נשמרות כ-rollback). **הושלם** — Or עדכן ידנית את שני
ה-repo secrets לארנק המאוחד; אומת ב-`list_repo_secrets_names`: `GOOGLE_OAUTH_CLIENT_ID` updated 2026-06-11T09:43Z,
`GOOGLE_OAUTH_CLIENT_SECRET` updated 09:39Z. SM לא נגע (repo-secrets נפרדים מ-GCP SM; ה-baseline 2/2/1/1/4 שלם).

**שינוי תוכנית:** עדכון ה-repo secret נעשה ידנית ע"י Or. מחקר תוך-כדי העלה: אין כיום כלי לכתיבת GitHub
*secret* אוטונומית (דפוס ה-PyNaCl-PUT נפרש מטעמי אבטחה), ו-`client_id` (לא-סודי) ראוי לשבת ב-git/variable
שהסוכן שולט בו — ה-`scan-for-secrets.sh` לא היה חוסם client_id. **שדרוג-האוטונומיה נדחה לסשן נפרד בבחירת Or.**

---

### שלב 4 — ההחלפה החיה (אבן-דרך; חלון-ההשבתה היחיד) — מיזוג + קליק consent

סדר מדויק (בלי פערים — ממזער את החלון):
1. **מיזוג שלב 2 ל-main** (✅ של Or) → מפעיל `deploy-mcp-server.yml` → הזריעה `addVersion`-ת את
   ה-client החדש על **כל 4** שמות-ה-SM → rebuild + ‏`gcloud run services replace` מאתחל gateway+sidecar
   על ה-client החדש. **⏱ חלון נפתח:** ה-sidecar מחזיק את הטוקן הישן (כבול ל-client הישן) מול
   ה-client החדש → `unauthorized_client`. (ההתחברות מתאוששת מיד — client חדש חי, `/oauth/callback` רשום.)
2. **מיד לשגר `request-workspace-scopes-consent.yml`** (`confirm=consent`) → קישור-קליק-אחד ל-Or בטלגרם.
3. **‏Or לוחץ Allow פעם אחת — מחובר כ-`shared-google@or-infra.com`** (זהות-ה-data; ‏`docs/google-identities.md`)
   → `/workspace/consent/callback` מחליף מול ה-client החדש, שומר ה-6-scopes עובר, `addSecretVersion` כותב
   `gmail-oauth-refresh-token` חדש (כבול ל-client החדש + לחשבון shared-google; הישן נשמר כ-rollback).
4. **פריסה מחדש** (re-run `deploy-mcp-server.yml`) כך שה-sidecar עולה עם הטוקן החדש. **⏱ חלון נסגר**
   כשהרוויזיה Ready. סה"כ ≈ קליק consent אחד + פריסה אחת ≈ דקות.

**Acceptance:**
- [x] מיזוג שלב 2 + `deploy-mcp-server.yml` SUCCESS (כל 4 שמות-ה-SM = ה-client החדש; run 27339079527).
- [x] `request-workspace-scopes-consent.yml` רץ; Or לחץ (×2); `gmail-oauth-refresh-token` קיבל גרסאות חדשות.
- [x] פריסות-מחדש SUCCESS (27339465506, 27340017135).
- [x] **`google-mcp-smoke` ירוק 6/6** (run 27344835076) — אחרי 3 תיקונים: scopes (6→17), תווית-חשבון (shared-google→edriorp38), והפעלת GCP APIs.

**הוכחה תפקודית (באותו שלב — מכרעת):** `probe_endpoint …/workspace/consent/start` → 302 עם 6 ה-scopes;
`list_secret_metadata gmail-oauth-refresh-token` → גרסה חדשה בתאריך היום; **`google-mcp-smoke` ירוק 6/6**
(mint bearer → initialize → tools/list עם כלי-גוגל → `list_gmail_labels` אמיתי → קבוצות Drive+Docs →
`search_drive_files` אמיתי). ירוק כאן = הארנק המאוחד עובד end-to-end.

**הערת התקדמות אחרונה:** **הושלם** (2026-06-11). ההחלפה רצה end-to-end: מיזוג #397 → deploy הזריע את הארנק
המאוחד (`140345952904-csqtb1…`) לכל 4 המגירות → Or עשה consent → פריסה-מחדש — **אך `google-mcp-smoke` נכשל ×2**.
אבחון מלוגי ה-sidecar ב-Cloud Run (לא ניחוש): ה-plumbing ירוק (bearer, MCP init, 58 כלי-גוגל, ה-client החדש
בשימוש), אבל ה-sidecar (`--tools calendar gmail drive docs`) דורש **17 scopes** וה-token החדש מחזיק רק את 6
שהדלת ביקשה ("Authentication Needed"). הארנק הישן הסתיר זאת (צבר את ה-17). **תיקון בוצע** (אישור Or):
`WORKSPACE_SCOPES`/`WORKSPACE_MCP_SCOPES`/`entrypoint default_scopes` הורחבו ל-17 (byte-equal), הבדיקות
עודכנו — **92/92 ירוק**, מוזג (PR #399, `0de1777`) ונפרס; Or עשה consent-מחדש — **אך ה-smoke עדיין נכשל
(4 פעמים סה"כ)**, אותו "Authentication Needed for shared-google".
**שורש מתוקן (אישר Or ישירות):** `shared-google@or-infra.com` הוא **חשבון בדוי** — תווית שסשן קודם המציא
ושאני (בטעות) תיעדתי כעובדה. החשבון האמיתי של or-infra הוא **`edriorp38@or-infra.com`** והטוקן שייך לו;
ה-mcp שנבנה-מחדש אוכף שחשבון-הטוקן תואם לתווית → הבדויה נכשלה. **תיקון (relabel, בלי consent):**
‏`WORKSPACE_GOOGLE_ACCOUNT_LABEL`/`entrypoint LABEL`/`smoke GOOGLE_ACCOUNT_LABEL` → `edriorp38@or-infra.com`
+ תיקון התיעוד השגוי (`google-identities.md`+`CLAUDE.md`), מוזג (PR #400, `b4caf96`) ונפרס.
**מכשול 5 (אחרון):** עם החשבון תואם — ה-smoke חשף "Gmail API is not enabled for project 140345952904". ה-APIs
(Gmail/Calendar/Drive/Docs) לא היו מופעלים בפרויקט-הבקרה (היו ב-factory-test-7). ניסיון אוטונומי דרך `gcp-action`
נכשל (`AUTH_PERMISSION_DENIED` — לברוקר אין serviceusage על control); Or הפעיל אותם בקונסולה כ-edriorp38 (4 קליקים).
**✅ הושלם — `google-mcp-smoke` ירוק 6/6 (run 27344835076):** הארנק המאוחד עובד end-to-end (bearer → init → 58 כלי →
`list_gmail_labels` אמיתי כ-`edriorp38@or-infra.com` → Drive+Docs → `search_drive_files` אמיתי).

**שינוי תוכנית:** נוסף תת-מסלול תיקון-scopes בתוך שלב 4 — פער שנחשף ע"י הארנק הנקי (באג חבוי). תבנית-המערכת
(`bootstrap-gmail-oauth.yml`) לא נגעה (אין מערכות חיות) → follow-up; שומר על `/dev-stage` ללא golden gate.

---

### שלב 5 — פרישת הכפילות `google-oauth-client-*` → ארנק אחד + צרור-מפתחות אחד (בחירת Or)

1. ב-`scripts/render-mcp-service-yaml.sh:52-53` לכוון את ה-LOGIN env לזוג ששרד:
   `GOOGLE_OAUTH_CLIENT_ID=gmail-oauth-client-id`, `GOOGLE_OAUTH_CLIENT_SECRET=gmail-oauth-client-secret`.
   כעת `GOOGLE_OAUTH_CLIENT_*` וגם `WORKSPACE_OAUTH_CLIENT_*` נפתרים לאותו זוג. **אפס שינוי TS / template** (חוץ מהערה).
2. ב-`deploy-mcp-server.yml` להוריד את ה-ensure+seed של `google-oauth-client-*` (להשאיר את זריעת ה-gmail משלב 2).
3. אחרי שמיזוג+פריסה מוכיחים שההתחברות עובדת — **disable (לא destroy)** לגרסאות היתומות של `google-oauth-client-*`
   (בטוח רק כשהרוויזיה החדשה היא היחידה בתעבורה ולא ממפה אותן — לקח #2).

**Acceptance:**
- [x] `render-mcp-service-yaml.sh` מכוון את ה-LOGIN ל-`gmail-oauth-client-*`; `deploy-mcp-server.yml` בלי `google-oauth-client-*` (קוד נכתב — ממתין למיזוג+פריסה).
- [ ] פריסה SUCCESS; round-trip התחברות ירוק + `google-mcp-smoke` ירוק; `google-oauth-client-*` יתומים (אופציונלי: disabled, לא destroyed).

**הוכחה תפקודית (באותו שלב):** round-trip התחברות-מפעיל — Or מתחבר מחדש ל-gateway עם `edri2or@gmail.com`
→ מאומת (ההתחברות קוראת עכשיו `gmail-oauth-client-*`); `google-mcp-smoke` ירוק שוב; `inspect_cloud_run`
מראה רוויזיה חדשה; `list_secret_metadata` מאשר ש-`google-oauth-client-*` לא צבר גרסאות.

**הערת התקדמות אחרונה:** in-progress (2026-06-11) — הקוד נכתב בענף `claude/fervent-lovelace-m3tkyf`: ב-`render-mcp-service-yaml.sh`
ה-LOGIN env (`GOOGLE_OAUTH_CLIENT_*`) מכוון עכשיו לזוג ששרד `gmail-oauth-client-*` (גם ה-WORKSPACE כבר שם → שני ה-env
נפתרים לאותו זוג); ב-`deploy-mcp-server.yml` הוסרו `google-oauth-client-*` מלולאת ה-placeholder ומקריאות ה-`seed`
(נשאר רק זוג ה-gmail); הערה לא-מדויקת ב-`google-oauth.ts` ("TWO OAuth clients") תוקנה למציאות המאוחדת (הערה-בלבד).
**ערך-זהה:** שני הזוגות מחזיקים את אותו client → מיקוד ה-LOGIN ל-`gmail-oauth-client-*` שקוף; `google-oauth-client-*`
הופכים ליתומים לא-מחוברים. ממתין לאישור Or למיזוג → פריסה → הוכחה (round-trip + smoke).

**שינוי תוכנית:** הורחב מעט מעבר ל-2 הקבצים המתוכננים: תוקנה גם הערה ב-`services/mcp-server/src/google-oauth.ts`
(הערה-בלבד, בטוחה לבילד) כי "TWO OAuth clients exist" הפך לא-מדויק אחרי האיחוד — שמירה על אמינות-התיעוד.

---

### שלב 6 — ניקוי: השארת רק 2 ה-redirect URIs החיים על ה-client המאוחד

על ה-client המאוחד (היחיד עכשיו) Or משאיר רק `…/oauth/callback` + `…/workspace/consent/callback`;
מסיר את ה-n8n המתה (`n8n-or-adhd-agent.or-infra.com/rest/oauth2-credential/callback`) וכל כפילות.

**Acceptance:**
- [ ] על ה-client נשארות בדיוק 2 ה-KEEP URIs.
- [ ] `google-mcp-smoke` ירוק + round-trip התחברות ירוק אחרי הגיזום (אין `redirect_uri_mismatch`).

**הוכחה תפקודית (באותו שלב):** `google-mcp-smoke` ירוק + התחברות ירוקה אחרי הגיזום; `probe_endpoint
…/workspace/consent/start` עדיין 302 עם ה-redirect הרשום הנכון. אז `status: completed`.

**נשאר לפירוק factory-test-7 הנפרד (מחוץ להיקף):** 2 הארנקים הישנים (`n8n MCP gateway` ‏`…cs19`,
`or-adhd-agent n8n` ‏`…s1f0`) + מסך-ה-consent + הפרויקט 651677607847 + ה-IAM. **דגל:** קיים שם גם
client שלישי **לא-קשור** `Cloudflare Access - Nuriel` (`…pj46`, Jun 4) — חייב בדיקה/העברה (Cloudflare
Access) לפני כל פירוק של factory-test-7. נרשם כגבול בהערת-הסגירה.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- הפיתוח נפתח (2026-06-11): מאחדים את שני "ארנקי גוגל" לאחד שיושב בבית הקבוע (פרויקט-הבקרה), מוכיחים חי, ומשאירים צרור-מפתחות אחד נקי — הכל בשערי ✅.
- שלב 0 הושלם — הצצנו למסך-ההסכמה הישן: הוא "External + In production", בדיוק ההגדרה שמאפשרת ארנק אחד. אישור להמשיך לבנות ארנק אחד (בלי מסלול-גיבוי). גילינו גם ארנק שלישי לא-קשור (Cloudflare) שיטופל בנפרד בפירוק העתידי.
- שלב 1 הושלם — אור יצר את הארנק החדש בבית הקבוע (פרויקט-הבקרה), עם 2 כתובות-החזרה. בדקתי מול גוגל שהארנק קיים והכתובות רשומות נכון — ירוק.
- שלב 2 הושלם — הכנתי בקוד (ב-workflow של הפריסה) שמפתח-ארנק אחד יזרום לכל ארבע מגירות-הסוד. עדיין לא נפרס — רק נבדק, וכל בדיקות ה-CI ירוקות.
- שלב 3 הושלם — אור הזין את מפתחות הארנק החדש (ID + secret) ב-GitHub. אומת שנחת. עדיין שום דבר חי לא הוחלף (זה קורה רק בשלב 4).
- שלב 4 הושלם — **הארנק המאוחד חי ומוכח (smoke ירוק 6/6)!** בדרך התגברנו על 3 מכשולים חבויים: הרשאות חסרות (6→17), שם-חשבון בדוי שתיקנתי שגוי בתיעוד (shared-google→edriorp38, אור תיקן אותי), ו-APIs של גוגל שלא היו מופעלים בפרויקט החדש (אור הפעיל ב-4 קליקים). הסוכנים קוראים Gmail/Drive חי דרך הארנק האחד שב-control.
- שלב 5 (קוד נכתב, ממתין לאישורך למיזוג) — סידרתי שה-gateway יקרא את הארנק מ**מגירת-סוד אחת בלבד** במקום שתיים. שני הזוגות מחזיקים בדיוק את אותו ארנק, אז זו החלפה "שקופה" — ההתחברות תמשיך לעבוד, והמגירה הכפולה (`google-oauth-client-*`) פשוט תהפוך ל"יתומה" לא-מחוברת. אחרי המיזוג אוכיח לבד (התחברות + smoke), בלי פעולה שלך.
