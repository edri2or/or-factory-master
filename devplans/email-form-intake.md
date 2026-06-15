---
dev_name: סורק דוא"ל לטפסים → הצעה לטלגרם (email-form-intake)
slug: email-form-intake
opened: 2026-06-15
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — סורק דוא"ל לטפסים → הצעה לטלגרם (email-form-intake)

## מטרה

יכולת חדשה שתישתל בכל מערכת שהפקטורי מקים: workflow ב-n8n שסורק את הדוא"ל (מתוזמן יומי +
הרצה ידנית), מזהה מייל עם טופס מצורף (PDF), קורא אותו עם OpenRouter רב-מודלי, ובגישת
**"הצעה בלבד"** מציע ערכים למילוי (מפרטים קבועים + הסקה) ושולח לטלגרם לאישור — **בלי לכתוב
בחזרה על ה-PDF** (הרסן המובנה: אין כתיבה ⇒ אין סגירה אוטומטית). תשתית להוכחה מקצה-לקצה;
המנגנון חשוב מהתוכן.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | בניית ה-workflow + skill + בוקקיפינג (סטטי) | completed | `templates/system/workflows/n8n/email-form-intake.json`, `templates/system/.claude/skills/email-form-intake/SKILL.md`, `scripts/gen-workflow-skill.sh`, `monitoring/registry-exempt.txt`, `devplans/email-form-intake.md`, `changelog.d/2026-06-15-email-form-intake.md`, `tests/golden/system/MANIFEST.sha256` |
| 2 | חיווט ל-configure-agent-router.yml (סטטי) | in-progress | `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/MANIFEST.sha256` |
| 3 | הוכחה חיה על or-edri-4 (תפקודית + E2E) | pending | `e2e-proofs/email-form-intake.json` |
| 4 | קיבוע (merge) + סגירה | pending | `devplans/email-form-intake.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*. החיבור
> החיצוני (Gmail אמיתי → קריאת PDF → טלגרם) הוא הלבנה האחרונה (שלב 3), לא כלי הבדיקה הראשון.
>
> **הוכחת E2E כשמשנים התנהגות בוט:** השינוי נוגע ב-`workflows/n8n/*.json` וב-
> `configure-agent-router.yml` → שני אלו ב-`trigger_paths`/`hash_inputs` של משטח `telegram-bot`,
> אז המיזוג חסום בלי `e2e-proofs/email-form-intake.json` טרי, חתום, ומ-`or-edri-4`.

---

### שלב 1 — בניית ה-workflow + skill + בוקקיפינג (סטטי)

**Acceptance:**
- [x] `email-form-intake.json` תקין (jq) — 17 נודים, גרסאות-נודים תואמות לתבניות; כל בלוקי
      ה-Code עוברים `node --check`.
- [x] גישת קריאת-Gmail: HTTP Request → Gmail REST API עם `nodeCredentialType: googleOAuth2Api`
      (הקרדנציאל הקיים "Google OAuth2 API", **בלי שינוי scope**). **שינוי מהתוכנית המקורית**:
      לא נוד Gmail — ראה "שינוי תוכנית".
- [x] קריאת PDF: OpenRouter native-PDF (`{type:"file", file:{filename,file_data:"data:application/pdf;base64,…"}}`),
      ראשי `google/gemini-2.5-flash` → fallback `anthropic/claude-sonnet-4.5`; **ללא** `mistral-ocr`
      (צד-שלישי). ניסוח כרטיס-ההצעה ב-chainLlm+lmChatOpenRouter; egress validation מ-tg-vision.
- [x] PII: אין ת"ז/שם/כתובת אמיתיים בקובץ (placeholder ריק `FIXED={}`).
- [x] skill מותאם נוצר דטרמיניסטית; שער workflow↔skill ירוק.
- [x] golden מרוענן; שערי Playground tests + Changelog gates ירוקים ב-CI (commit 73631c7).

**הוכחה תפקודית (באותו שלב):** סטטי — `jq` מאמת JSON; `node --check` מאמת 6 בלוקי-Code;
שער הזיווג עבר מקומית (15 workflows מזווגים). ריצה-חיה אמיתית היא שלב 3.

**הוכחת E2E (artifact):** לא-באותו-שלב — מופקת בשלב 3 (`e2e-proofs/email-form-intake.json`).

**הערת התקדמות אחרונה:** ה-workflow + skill + devplan + changelog נבנו ואומתו סטטית, golden
רוענן, ו-PR #477 נפתח. CI הראה כשל אחד לא-צפוי (שער "Check watchdog registry") — תוקן:
ה-workflow נוסף ל-`monitoring/registry-exempt.txt` (worker יומי provision-only; מנוטר קולקטיבית
ב-system-n8n-executions; לא במפת ה-cadence עדיין כדי לא להקפיץ התראות-סרק על מערכות ותיקות).
שער ה-E2E אדום כצפוי (proof יגיע בשלב 3). שאר השערים ירוקים.

**שינוי תוכנית:** התוכנית המקורית הניחה **נוד Gmail** + הזרקת credential. אימות (n8n docs +
חיפוש) הראה שנוד Gmail דורש credential מסוג `gmailOAuth2`, בעוד `bootstrap-gmail-oauth.yml`
יוצר credential גנרי `googleOAuth2Api` ("Google OAuth2 API"). הם טיפוסים שונים → נוד Gmail
לא יכול לבחור את הקרדנציאל הקיים. לכן עברנו ל-**HTTP Request → Gmail REST API** עם
`nodeCredentialType: googleOAuth2Api` — שימוש בקרדנציאל הקיים *בדיוק* כפי שהוא נועד (קריאות
Google API מותאמות), בלי שינוי scope ובלי תלות בטיפוס נוד-Gmail. תואם יותר את האילוץ
"השתמש בקרדנציאל הקיים בלי לשנות scope".

---

### שלב 2 — חיווט ל-configure-agent-router.yml (סטטי)

**Acceptance:**
- [x] בלוק lookup ל-"Google OAuth2 API" → `GMAIL_OAUTH_CRED_ID` (כמו דפוס ה-jq הקיים, ב-`/tmp/ar-creds.json`).
- [x] בלוק ייבוא/publish/activate ל-email-form-intake ("5d-bis", כמו בלוק tg-proactive, דרך `_upsert_wf "…" file yes`),
      עם `sed` ל-`@@CRED_GMAIL_OAUTH_ID@@`/`@@CRED_OPENROUTER_ID@@`/`@@CRED_TELEGRAM_ID@@`/`@@CHAT_ID@@`/`@@SYSTEM_NAME@@` + שורת-דיווח בטבלת הסיכום.
- [x] דרגרדציה חיננית: ייבוא רק אם הקרדנציאל קיים (+OpenRouter+Telegram+chat id); אחרת skip+warn.
- [x] golden מרוענן (configure-agent-router.yml תחת templates/system/); yamllint נקי;
      הרצת ה-sed מקומית על ה-JSON מאמתת אפס `@@…@@` שנותרו.
- [ ] שערי Playground tests + Changelog gates ירוקים ב-CI על ה-commit החדש.

**הוכחה תפקודית (באותו שלב):** סטטי — yamllint נקי; הרצת sed יבשה על ה-JSON מחזירה אפס
placeholders ו-JSON תקין עם ה-credentials מוחלפים. ייבוא חי ל-n8n הוא שלב 3.

**הוכחת E2E (artifact):** לא-באותו-שלב — מופקת בשלב 3.

**הערת התקדמות אחרונה:** החיווט נוסף ל-configure-agent-router.yml (lookup + בלוק 5d-bis +
דרגרדציה חיננית + שורת-סיכום), golden רוענן, נותר אישור CI ירוק על ה-push.

**שינוי תוכנית:** —

---

### שלב 3 — הוכחה חיה על or-edri-4 (תפקודית + E2E)

**Acceptance:**
- [ ] Pre-flight: ל-or-edri-4 יש קרדנציאל "Google OAuth2 API" (אם לא — dispatch `bootstrap-gmail-oauth.yml`;
      הסודות `gmail-oauth-*` קיימים שם → התחברות אוטומטית ללא קליק).
- [ ] החלה חיה: `refresh-system-agents.yml` (system_name=or-edri-4, paths לתת-העץ, post_merge_workflow=configure-agent-router.yml, ref=branch)
      → email-form-intake מיובא+פעיל ב-n8n החי.
- [ ] הוכחה תפקודית: Or שולח מייל-בדיקה עם טופס PDF ל-`edriorp38@or-infra.com`; הרצה ידנית →
      `inspect_n8n_execution` מראה ריצה מוצלחת → הצעה מגיעה בטלגרם. כאן נסגרת הכרעת קריאת-ה-PDF (מודל/גוף).
- [ ] הוכחת E2E: `e2e-verify.yml` (ref=main, system_name=or-edri-4, gcp_project=factory-test-21, target_ref=branch, slug=email-form-intake)
      → `e2e-proofs/email-form-intake.json` חתום בענף; שער "E2E verification gate" ירוק.

**הוכחה תפקודית (באותו שלב):** ריצת n8n אמיתית ממייל-בדיקה (execution id) + ההודעה בטלגרם.

**הוכחת E2E (artifact):** `e2e-proofs/email-form-intake.json` (system=or-edri-4, result=pass, חתום).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — קיבוע (merge) + סגירה

**Acceptance:**
- [ ] כל השערים ירוקים (כולל E2E) → merge ל-main = נעילה לתבנית.
- [ ] `devplans/email-form-intake.md` → `status: completed` (זו התוכנית הפעילה היחידה כרגע →
      אפשר לסגור באותו PR; אם תיפתח תוכנית מקבילה — סגירה ב-PR-תיעוד נפרד).
- [ ] or-edri-4 קבוע — לא מפרקים. Day-0 birth check = אופציונלי, רק לבקשת Or (מהלך עם עלות).

**הוכחה תפקודית (באותו שלב):** מצב ה-PR = merged; ה-workflow קיים ב-main תחת templates/system/.

**הוכחת E2E (artifact):** ה-proof משלב 3 (כבר בענף שמתמזג).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם: בניתי את ה-workflow החדש שקורא מיילים עם טפסים ומציע מילוי בטלגרם, כל
  הבדיקות הסטטיות עברו, ו-PR #477 נפתח. תוך כדי גיליתי שעדיף לקרוא Gmail דרך ה-API הקיים
  (במקום נוד ייעודי) כדי להשתמש במפתח שכבר קיים בלי לגעת בהרשאות — וזה גם בטוח יותר.
- שלב 2 הושלם: חיברתי את ה-workflow ל"קו-ההרכבה" (configure-agent-router) — כל מערכת חדשה
  תתקין ותדליק אותו אוטומטית, ורק אם המייל מחובר (אחרת מדלג בשקט בלי תקלה).
