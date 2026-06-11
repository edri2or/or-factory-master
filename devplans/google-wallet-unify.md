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
| 1 | Or יוצר את ה-client המאוחד + מסך-consent ב-control | in-progress | — (קונסולת גוגל) |
| 2 | הרחבת זריעת-הסודות ב-deploy לכסות את שני זוגות-ה-clients | pending | `.github/workflows/deploy-mcp-server.yml` |
| 3 | Or מזריק את מפתחות ה-client החדש ל-repo secrets + תיעוד rollback | pending | — (GitHub repo secrets) |
| 4 | ההחלפה החיה: מיזוג→פריסה→consent→פריסה→smoke ירוק | pending | מיזוג ל-main (deploy) + control SM + קונסולה |
| 5 | פרישת הכפילות `google-oauth-client-*` → ארנק אחד + צרור-מפתחות אחד | pending | `scripts/render-mcp-service-yaml.sh`, `.github/workflows/deploy-mcp-server.yml` |
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
- [ ] מסך-ה-consent ב-`or-factory-master-control` נוצר: User Type External, Published (In production).
- [ ] ‏client אחד מסוג "Web application" נוצר; שני ה-redirect URIs רשומים בדיוק:
      `https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app/oauth/callback`
      `https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app/workspace/consent/callback`
- [ ] ‏Or העתיק את ה-Client ID + Client secret (לשלב 3; לעולם לא לצ'אט).

**הוכחה תפקודית (באותו שלב):** הוכחת-נגישות נטולת-סוד (לא click-through): `probe_endpoint` ל-URL
ההרשאה של גוגל שנבנה עם ה-client_id החדש + ה-redirect של workspace + `scope=openid email` →
לאשר HTTP 200 דף-גוגל, ו**לא** `redirect_uri_mismatch`/`invalid_client`. מוכיח שה-client קיים
וה-redirect רשום — לפני שמחווטים סוד כלשהו. הפיך לגמרי (מחיקת ה-client).

**הערת התקדמות אחרונה:** in-progress (2026-06-11) — שלב 0 אישר single-client GO; הוראות צעד-צעד
ל-Google Auth Platform (פרויקט `or-factory-master-control`) נמסרו ל-Or: מסך-consent External+publish,
ואז client אחד מסוג Web עם 2 ה-redirect URIs. ממתין ש-Or יבצע וידווח client_id (+ ישמור את ה-secret לשלב 3).
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

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — Or מזריק את מפתחות ה-client החדש ל-repo secrets + תיעוד rollback

**Acceptance:**
- [ ] הסוכן רשם (דרך `list_secret_metadata`, בלי גישה-לערך) את מוני-הגרסאות הנוכחיים של 4 סודות-ה-client + `gmail-oauth-refresh-token` (ה-rollback השלם — מוסיפים גרסה בלבד).
- [ ] ‏Or עדכן את repo secrets `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` לערכי ה-client המאוחד החדש (נתיב ממוסך; ערכים לעולם לא בצ'אט/לוג).

**הוכחה תפקודית (באותו שלב):** תצפיתי — GitHub מציג שהסודות "Updated"; הסוכן מאמת מחדש דרך
`list_secret_metadata` ש-4 סודות-ה-SM **לא קיבלו גרסה חדשה** (שלב 3 אינרטי, ה-rollback שלם).
אין שינוי-התנהגות. הפיך לגמרי (SM + ה-gateway החי לא נגעו).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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
- [ ] מיזוג שלב 2 + `deploy-mcp-server.yml` SUCCESS (כל 4 שמות-ה-SM = ה-client החדש).
- [ ] `request-workspace-scopes-consent.yml` רץ; Or לחץ; `gmail-oauth-refresh-token` קיבל גרסה חדשה היום.
- [ ] פריסה שנייה SUCCESS; ה-sidecar קורא את הטוקן החדש.
- [ ] **`google-mcp-smoke` ירוק** (עם `system=unification-smoke`; הברירת-מחדל מפורקת).

**הוכחה תפקודית (באותו שלב — מכרעת):** `probe_endpoint …/workspace/consent/start` → 302 עם 6 ה-scopes;
`list_secret_metadata gmail-oauth-refresh-token` → גרסה חדשה בתאריך היום; **`google-mcp-smoke` ירוק 6/6**
(mint bearer → initialize → tools/list עם כלי-גוגל → `list_gmail_labels` אמיתי → קבוצות Drive+Docs →
`search_drive_files` אמיתי). ירוק כאן = הארנק המאוחד עובד end-to-end.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — פרישת הכפילות `google-oauth-client-*` → ארנק אחד + צרור-מפתחות אחד (בחירת Or)

1. ב-`scripts/render-mcp-service-yaml.sh:45-46` לכוון את ה-LOGIN env לזוג ששרד:
   `GOOGLE_OAUTH_CLIENT_ID=gmail-oauth-client-id`, `GOOGLE_OAUTH_CLIENT_SECRET=gmail-oauth-client-secret`.
   כעת `GOOGLE_OAUTH_CLIENT_*` וגם `WORKSPACE_OAUTH_CLIENT_*` נפתרים לאותו זוג. **אפס שינוי TS / template.**
2. ב-`deploy-mcp-server.yml` להוריד את ה-ensure+seed של `google-oauth-client-*` (להשאיר את זריעת ה-gmail משלב 2).
3. אחרי שמיזוג+פריסה מוכיחים שההתחברות עובדת — **disable (לא destroy)** לגרסאות היתומות של `google-oauth-client-*`
   (בטוח רק כשהרוויזיה החדשה היא היחידה בתעבורה ולא ממפה אותן — לקח #2).

**Acceptance:**
- [ ] `render-mcp-service-yaml.sh` מכוון את ה-LOGIN ל-`gmail-oauth-client-*`; deploy בלי `google-oauth-client-*`.
- [ ] פריסה SUCCESS; `google-oauth-client-*` יתומים (disabled, לא destroyed).

**הוכחה תפקודית (באותו שלב):** round-trip התחברות-מפעיל — Or מתחבר מחדש ל-gateway עם `edri2or@gmail.com`
→ מאומת (ההתחברות קוראת עכשיו `gmail-oauth-client-*`); `google-mcp-smoke` ירוק שוב; `inspect_cloud_run`
מראה רוויזיה חדשה; `list_secret_metadata` מאשר ש-`google-oauth-client-*` לא צבר גרסאות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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
