---
dev_name: לולאת תיקון אוטונומית לתקלות (OIL auto-fix)
slug: oil-autofix
opened: 2026-05-28
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — לולאת תיקון אוטונומית לתקלות (OIL auto-fix)

## מטרה

בניית "החצי השני" של מנגנון התקלות. היום המערכת מזהה תקלות ופותחת תיק ב-Linear (OIL),
אבל אין מי שמתקן — Or מתקן ידנית. הפיתוח הזה בונה סוכן אוטונומי שקורא תיק, חוקר את שורש
הבעיה, מכין תיקון קטן, ושולח ל-Or הודעת אישור אחת בטלגרם (✅/❌). בלחיצה אחת התיקון מיושם
(עם אימות בכל צעד) והתיק נסגר — בלי ש-Or נוגע בטרמינל. נבנה PR-אחד-בכל-פעם, עם עצירה
לאישור בכל גבול.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | חוקר קריאה-בלבד (workflow) | completed | `.github/workflows/oil-autofix-investigate.yml` |
| 2 | פעמון Linear + סינון רעש (triage) | completed | `services/mcp-server/src/*`, `deploy-mcp-server.yml`, `oil-autofix-investigate.yml` |
| 3 | הצעת תיקון כ-PR טיוטה | completed | `.github/workflows/oil-autofix-investigate.yml`, `scripts/oil-autofix-validate.sh` |
| 4 | גשר אישור טלגרם (✅/❌ → מיזוג) | in-progress | `services/mcp-server/src/*`, `deploy-mcp-server.yml`, `oil-autofix-investigate.yml` |
| 5 | אימות פוסט-תיקון + סגירת תיק | pending | `.github/workflows/oil-autofix-investigate.yml` |
| 6 | תיעוד (חריג מכוון ותחום) | pending | `docs/oil-autofix.md`, `CLAUDE.md`, `docs/roadmap.md` |
| 7 | סביבת-בדיקות — הרחבת כיסוי התיקון | deferred | `services/mcp-server/*`, `scripts/`, `.github/workflows/pipeline-tests.yml` (TBD) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed` / `deferred`.

---

### שלב 1 — חוקר קריאה-בלבד (workflow)

**Acceptance:**
- [ ] `oil-autofix-investigate.yml` קיים: טריגרים `repository_dispatch:[oil-investigate]` + `workflow_dispatch(issue_id)`.
- [ ] מריץ `claude-code-action@v1` (מוצמד ל-SHA) ב-read-only בלבד (Read/Grep/Glob; חוסם Bash/Edit/Write/...).
- [ ] קורא את תיק ה-OIL + לוגי הריצה שנכשלה (soft-fail), מטפל בטקסט כ-untrusted.
- [ ] כותב אבחנה (סיווג + confidence + שורש) כתגובה ב-Linear; ללא קוד, ללא PR, ללא שינוי סטטוס.
- [ ] עובר את 4 בדיקות ה-CI; אומת ע"י `workflow_dispatch` על OIL-16 → תגובה הופיעה בתיק.

**הערת התקדמות אחרונה:** הושלם ומוזג (PR #164). אומת סטטית + 4 בדיקות CI ירוקות. האימות
החי (הרצה על OIL-16) הועבר ל-PR 2.

**שינוי תוכנית:** האימות החי נדחה ל-PR 2 — ב-PR 1 לא הייתה דרך אוטונומית להדליק את
ה-workflow (כלי ההפעלה של הפקטורי מוגבל לרשימה סגורה), והטוקן הקלאסיק הזמני פג תוקף. ב-PR 2
נבנית ההדלקה האוטומטית (Linear→repository_dispatch) + החוקר נוסף ל-allowlist, ואז האימות החי
מתבצע שם.

---

### שלב 2 — פעמון Linear + סינון רעש (triage)

**Acceptance:**
- [ ] endpoint `/linear-webhook` ב-MCP server מאמת חתימת `Linear-Signature` (HMAC על raw body) + replay-window.
- [ ] triage חוקים בלבד (סדר קובע: `factory.pilot.test`→test; `info`→maintenance לפני `action_required`; `action_required:false`→skip). זיהוי תיק-פקטורי לפי ה-OTel JSON בגוף התיק.
- [ ] רק תיק actionable מפעיל `repository_dispatch(oil-investigate)`; ה-investigator נוסף ל-allowlist של `dispatch_workflow`.
- [ ] סוד `linear-webhook-secret` מעוגן ב-deploy; `/oil-register-webhook` רושם את ה-webhook ב-Linear (אידמפוטנטי).
- [ ] אומת חי: תקלת בדיקה → webhook → החוקר רץ ואבחנה מופיעה בתיק (כולל האימות שנדחה מ-PR 1). מסנן את OIL-12/OIL-13.

**הערת התקדמות אחרונה:** הופעל. הקוד נפרס לבד עם מיזוג PR 2 (הסוד `linear-webhook-secret`
מוטבע בשרת החי). הבדיקה החיה על OIL-16 חשפה באג אמיתי — `claude-code-action` חסם את שחקן-ה-Bot
של הברוקר ("non-human actor"), כך שהלולאה לא יכלה לרוץ כלל; תוקן עם `allowed_bots` (אפליקציית
הברוקר בלבד, לא `*`). רישום ה-webhook הוטמע כשלב אידמפוטנטי (soft-fail) ב-`deploy-mcp-server.yml`,
כי הסביבה של הסוכן חסומה ל-run.app והרישום חייב לרוץ מ-runner. שני ה-workflows נעולים ל-main, אז
האימות החי המלא מתבצע על ריצת ה-main שאחרי המיזוג.

**שינוי תוכנית:** הוקטן והתמקד: (1) ה-reconciler (רשת-ביטחון) הוצא ל-PR קטן נפרד; (2) Haiku
ב-triage נדחה (מיותר — החוקר מסווג לעומק; החוקים מסננים את הרעש); (3) זיהוי תיק-פקטורי לפי
ה-OTel JSON ולא לפי תווית (ה-payload של Linear לא תמיד נושא שמות תוויות); (4) JWT ב-payload נדחה.

---

### שלב 3 — הצעת תיקון כ-PR טיוטה

**Acceptance:**
- [ ] בביטחון גבוה + תיקון קטן → נפתח PR טיוטה (תקרה ~100 שורות / ≤2 קבצים).
- [ ] חובה בדיקה שנכשלת-לפני/עוברת-אחרי; אסור לגעת ב-`.github/workflows/*`, WIF/IAM, secrets.
- [ ] הפרה כלשהי או ביטחון נמוך → אבחנה כ-comment + escalation, בלי PR.
- [ ] קישור ה-PR נכתב ב-comment ב-Linear; אומת ש-PR טיוטה עובר את 4 הבדיקות.

**הערת התקדמות אחרונה:** הושלם. החוקר הורחב: אחרי האבחנה, אם הסיווג `actionable-bug` בביטחון
≥0.8 והבאג בקוד הפקטורי עצמו — סוכן-כתיבה (ללא Bash/אינטרנט) מייצר תיקון קטן + בדיקת-bash; שער
דטרמיניסטי (`scripts/oil-autofix-validate.sh`) מאמת ≤2 קבצים/~100 שורות, נתיבים אסורים, ללא
סודות, ובדיקה שנכשלת-לפני/עוברת-אחרי המורצת בסביבה מנוקה אחרי הסרת ה-credentials; ורק אז נפתח
**PR טיוטה** (broker-App token מצומצם לריפו אחד) עם קישור ב-Linear. אחרת — הסלמה כ-comment, בלי
PR. לעולם לא ממזג (שלב 4-5). שער-הבטיחות נבדק מקומית ב-6 תרחישים; אימות-ההסלמה החי על main אחרי המיזוג. **אומת חי (2026-05-29):** נתיב פתיחת-ה-PR-טיוטה הוכח מקצה-לקצה — תיק בדיקה OIL-19 → החוקר אבחן ותיקן, השער אישר, ו-PR טיוטה (#171) נפתח אוטומטית ע"י ה-broker App (base `main`, draft, לא מוזג); ה-PR נסגר, התיק בוטל, והפיגום הזמני הוסר — main ללא שינוי.

**שינוי תוכנית:** נוסף `scripts/oil-autofix-validate.sh` (השער הדטרמיניסטי) כקובץ נפרד — כך
shellcheck בודק אותו ב-CI והוא נבדק ביחידה מקומית. v1 פותח תיקונים רק על `or-factory-master`
(תקלות מערכת מוסלמות — תיקון ברמת התבנית). הסוכן לא מקבל Bash; ה-workflow מריץ את הבדיקה ופותח
את ה-PR; ה-credentials של GCP מוסרים לפני הרצת קוד שה-AI כתב.

---

### שלב 4 — גשר אישור טלגרם (✅/❌ → מיזוג)

> שלב 4 המקורי ("סביבת אישור" מבוססת GitHub Environment) ושלב 5 ("גשר טלגרם") **אוחדו**
> לשלב אחד אחרי שהשער של GitHub התברר כחסום בחבילה שלנו (ראה "שינוי תוכנית"). השער
> והמיזוג מתבצעים שניהם דרך טלגרם.

**Acceptance:**
- [ ] `oil-autofix-approver` App רשום (זהות נפרדת מהברוקר) + 3 סודות ב-SM; סודות `oil-approval-register-secret` + `oil-approver-telegram-allowlist`.
- [ ] אחסון state ממתין (Firestore מועדף / GCS) + הרשאת IAM ל-runtime SA.
- [ ] `/oil-approval-register` (admin-gated; שולח הודעת טלגרם אחת ✅/❌ עם approval_id אטום) + `/telegram-webhook` (אימות `X-Telegram-Bot-Api-Secret-Token` + allowlist על `from.id` + lookup → **מיזוג ה-PR בזהות `oil-autofix-approver`**).
- [ ] אומת חי: באג → PR טיוטה → טלגרם → ✅ → ה-PR ממוזג (בזהות המאשר, לא הברוקר).

**הערת התקדמות אחרונה:** נוקה שער-ה-GitHub. שלב 4 המקורי (Environment `oil-autofix` + job
`apply` ממתין + `gate_smoketest`) נבנה ומוזג (PR #174), אבל ה-push ל-main הוכיח חי שהשער חסום:
GitHub החזיר **HTTP 422** ("billing plan supports … protection rule") — required reviewers /
wait_timer / prevent_self_review על **repo פרטי** הם **Enterprise-only**, והארגון ב-Team. ה-PR
שניקה (`setup-oil-environment.yml` נמחק; `oil-autofix-investigate.yml` הוחזר למצב נקי של סוף-
שלב-3, בלי `apply`/`gate_smoketest`/`mode`/`outputs`; ה-Environment הריק נמחק מה-repo). השער
עובר לטלגרם. **נותר (בנייה נפרדת, מתחילה ברישום אפליקציה — דורש אישור Or):** הגשר עצמו לפי
ה-Acceptance למעלה. הקוד הקיים שישמש בשימוש-חוזר: דפוס HMAC + raw-body מ-`handleLinearWebhook`,
`sendTelegramMessage` (להרחיב ל-inline-keyboard), דפוס admin-gate מ-`/oil-register-webhook`,
ו-`register-system-app.yml` לרישום האפליקציה.

**PR-A (קוד ה-MCP — רדום עד פריסה):** נכתב כל קוד הגשר בצד ה-MCP. `github-client.ts` הוכלל
לתמוך בזהות-אפליקציה שנייה (`tokenFor(identity)`; מסלול הברוקר ללא שינוי התנהגותי) + נוספו
`mergePullRequestAsApprover`/`closePullRequestAsApprover` (זהות `oil-autofix-approver` מ-env
`OIL_APPROVER_*`, lazy; `approverConfigured()` מחזיר false עד שהסודות מותקנים). מודול חדש
`oil-approval.ts`: `registerApproval` (שולח הודעת טלגרם אחת עם כפתורי ✅/❌ שנושאים את מספר
ה-PR ב-`callback_data` — **בלי state בשרת**), `handleTelegramCallback` (allowlist על `from.id`
→ מיזוג/סגירה בזהות המאשר), ו-`parseCallbackData`/`isAllowed` (טהורים, נבדקו ביחידה).
`index.ts`: route `/oil-approval-register` (admin-gated) + `/telegram-webhook` (secret_token
gated, תמיד 200). `observability-client.ts`: `sendTelegramKeyboard`/`answerCallbackQuery`/
`editTelegramMessage`. הכל רדום עד שהאפליקציה תירשם + ה-MCP ייפרס (PR-B). אומת: `tsc` נקי,
7 בדיקות-יחידה ירוקות (`npm test`).

**PR-B (חיווט workflow — בטוח):** חובר הכל. `register-oil-approver-app.yml` חדש (workflow ייעודי
מינימלי, דפוס `register-system-app.yml` + אותו receiver גנרי): רושם את `oil-autofix-approver`
עם הרשאות `{contents:write, pull_requests:write, metadata:read}`, single-repo על
or-factory-master, 3 סודות ל-SM של הבקרה, אימות-scope צר, teardown. **לא** ב-allowlist (המפעיל
מדליק מה-UI). `deploy-mcp-server.yml`: שלבי mint-if-missing ל-`telegram-approval-webhook-secret`
+ placeholder ל-`oil-approver-telegram-allowlist` + 3 shells ל-`oil-autofix-approver-app-*`
(כדי שה-mount תמיד ייפתר גם לפני הרישום), מאונט 5 הסודות ל-env, ורישום webhook מול Telegram
(`setWebhook` על בוט-ההתראות הקיים — send-only היום, אז בטוח — עם secret_token + allowed_updates
=callback_query). `oil-autofix-investigate.yml`: שלב `approval` אחרי `openpr` (soft-fail) שקורא
`POST /oil-approval-register` (admin secret נקרא ב-lockdown לפני שלילת ה-creds), רק לתיקוני
or-factory-master. ה-placeholder `__NOT_CONFIGURED__` מזוהה ב-`approverConfigured()` וב-allowlist
כך שהגשר נשאר רדום עד מילוי אמיתי. אומת: `tsc`+7 בדיקות ירוקות, yamllint נקי, שלבי-ה-bash
החדשים shellcheck-נקיים, supply-chain ירוק.

**אקטיבציה — באג שנתפס חי + תיקון:** PR-A+B מוזגו → `deploy-mcp-server.yml` רץ אוטומטית
(06:41), פרס את ה-MCP עם קוד הגשר, יצר את 5 הסודות כ-placeholders, ורשם את webhook הטלגרם
(`setWebhook` → `/telegram-webhook`, HTTP 200 — הבוט חי). אבל כשהמפעיל הדליק את
`register-oil-approver-app.yml`, הוא **דילג בטעות**: בדיקת ה-`exists` בדקה רק *קיום* סוד, וה-
placeholder shells מ-deploy "ניצחו" אותה → האפליקציה לא נרשמה. **תוקן** (PR קטן): בדיקת ה-
`exists` עכשיו קוראת את *הערך* ומתייחסת ל-`__NOT_CONFIGURED__`/ריק כ"חסר", כך שהרישום ימשיך.
נותר: להריץ שוב את הרישום (2 קליקים), למלא את ה-allowlist במזהה הטלגרם של Or, ואימות חי.

**רישום הושלם + allowlist:** האפליקציה `oil-autofix-approver` **נרשמה בהצלחה** (הרצה שנייה אחרי
התיקון — אומת scope צר, 3 הסודות עברו ל-version 2 אמיתי). נוסף workflow חד-פעמי
`set-oil-allowlist.yml` (דפוס `seed-test-bot-token.yml`): מקבל מזהי-טלגרם כקלט, מאמת שכל אחד
מספר חיובי, וכותב ל-`oil-approver-telegram-allowlist`. נותר: להדליק אותו עם ה-user-id של Or,
ואז פריסה מחדש של ה-MCP (כדי לקלוט את הסודות האמיתיים) + אימות חי.

**allowlist מולא + פריסה אוטונומית:** `set-oil-allowlist.yml` הודלק עם ה-user-id של Or
(`oil-approver-telegram-allowlist` → version 2 אמיתי). כל 5 סודות הגשר עכשיו אמיתיים ב-SM.
נותר רק שה-MCP החי יקלוט אותם (Cloud Run טוען סודות בזמן פריסה). `deploy-mcp-server.yml` לא
היה ב-allowlist של `dispatch_workflow` (אז לא יכולתי להדליקו אגנטית); נוסף ל-allowlist
(`tools.ts` + CLAUDE.md) — ומכיוון שזה נוגע ב-`services/mcp-server/**`, **מיזוג ה-PR הזה
מפעיל פריסה אוטומטית** שתקלוט את הסודות האמיתיים ותעיר את הגשר. נותר אחרי המיזוג: אימות חי.

**שינוי תוכנית:** **שער-ה-GitHub ננטש לטובת טלגרם, ושלבים 4+5 אוחדו.** הסיבה: חוקי-הגנה על
environment ב-repo פרטי דורשים GitHub Enterprise (אומת חד-משמעית מול ה-API: branch-policy=200,
אבל `prevent_self_review`=422 ו-`required_reviewers`=422, וב-changelog רשמי של GitHub). ה-
Environment היה מה שהפריד את "השער" (4) מ"המיזוג" (5); בלעדיו הם מנגנון טלגרם אחד. הפרדת-
הזהויות נשמרת: הברוקר פותח את ה-PR, ואפליקציית `oil-autofix-approver` (זהות נפרדת, הרשאות
`contents`+`pull_requests` write בלבד) ממזגת — רק אחרי אימות לחיצת ה-✅ בטלגרם (secret_token +
allowlist על `from.id`). זו הגנה אפליקטיבית במקום הגנת-פלטפורמה.

---

### שלב 5 — אימות פוסט-תיקון + סגירת תיק

**Acceptance:**
- [ ] אחרי מיזוג + CI ירוק → אימות (reproducer / re-dispatch בטוח של ה-workflow שנכשל).
- [ ] הצלחה → `issueUpdate(completed)` + comment סוגר. כשל → עצירה + comment + טלגרם "נכשל באימות", בלי לסגור.
- [ ] אומת חי את הלולאה המלאה = הגדרת הסיום של Or.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — תיעוד (חריג מכוון ותחום)

**Acceptance:**
- [ ] `docs/oil-autofix.md` חדש; רשומת CHANGELOG.
- [ ] עדכון `CLAUDE.md` + `docs/roadmap.md`: הלולאה מתועדת כחריג מכוון ותחום ל-"auto-chain / issue-based reporting שלא נבנים".

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — סביבת-בדיקות: הרחבת כיסוי התיקון (דחוי)

> השלב הזה דחוי במכוון. הלולאה (שלבים 1–6) נסגרת ומסומנת `completed` כרגיל; שלב 7 *מתבגר
> לפיתוח נפרד* (משלו `/dev-stage`) כשמתחילים אותו — כך הוא לעולם לא משאיר את התוכנית `active`
> ולא תופס את שער ה-CI לאורך זמן.

**מטרה:** היום המתקן (שלב 3) יודע להוכיח תיקון רק לקוד שרץ בפשטות ב-bash (`scripts/*.sh`);
קוד TS (`services/mcp-server`) חסר test runner, ו-`.github/workflows/*` אסור למתקן — אז הם
מוסלמים. סביבת-בדיקות אמיתית תרחיב את מה שהמתקן יכול לתקן בבטחה.

**Acceptance (כיוון כללי — הפרטים ייקבעו כשמתחילים):**
- [ ] harness לסקריפטים (למשל `bats`) + test runner ל-`services/mcp-server`, מחוברים ל-`pipeline-tests.yml`.
- [ ] המשטח המותר של המתקן (שלב 3) מתרחב ל-TS ברגע שיש runner. `.github/workflows/*`, WIF/IAM וסודות נשארים אסורים תמיד.
- [ ] תיעוד הרחבת-הכיסוי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — "החוקר" (workflow קריאה-בלבד) נבנה, עבר את כל בדיקות ה-CI, ומוזג (PR #164). אימות חי הועבר ל-PR 2.
- שלב 2 הושלם — ה"פעמון" מ-Linear חובר: תקלה חדשה מדליקה עכשיו את החוקר לבד, ורישום ה-webhook מתבצע אוטומטית בכל פריסה. בדרך גילינו ותיקנו באג שמנע מהחוקר לרוץ כשהמערכת (ולא בן-אדם) מפעילה אותו.
- שלב 3 הושלם — כשהחוקר מזהה באג קטן ובטוח בקוד של הפקטורי, הוא עכשיו גם **מכין תיקון ופותח אותו כ-PR טיוטה** (לא ממוזג לבד — מחכה לאישור). אם התיקון מסוכן, גדול, או שאי-אפשר להוכיח אותו בבדיקה — הוא פשוט מסביר ומסלים אליך, בלי לגעת בקוד. שמנו שכבות אבטחה כדי שה-AI לא יוכל לעשות נזק.
- שלב 4 בתהליך — תכננו "חדר המתנה לאישור" דרך GitHub, אבל התברר חי שהתכונה חסומה בחבילה שלנו (היא דורשת חבילת פרימיום של GitHub). אז שינינו כיוון: **האישור יעבור דרך טלגרם** — תקבל הודעה אחת עם ✅/❌ ובלחיצה התיקון יתמזג. זה גם מאחד את מה שהיה אמור להיות שני שלבים לאחד. ניקינו את הקוד שכבר לא רלוונטי; את גשר הטלגרם עצמו נבנה בצעד הבא (שמתחיל ברישום אפליקציה חדשה — אבקש את אישורך).

---

## הערות צד — שינויים שמוזגו בזמן הפיתוח הזה

> שינויים לא-קשורים ל-OIL שמוזגו בזמן שהפיתוח הזה עדיין `active`. נרשמים כאן רק כדי לעבור את שער ה-CI של תוכניות הפיתוח (`check-devplan-updated.sh`); אינם משנים אף סטטוס שלב של ה-OIL.

- 2026-05-29 · **Stage 129** — זהות סוכן לכל מערכת ב-`AGENTS.md` (כרטיס מפעיל קבוע + שדה `system_purpose` + שם סוכן אוטומטי). שינוי פקטורי עצמאי; הפירוט המלא ב-`CHANGELOG.md`.
