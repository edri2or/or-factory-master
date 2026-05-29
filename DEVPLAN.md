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
| 4 | סביבת אישור + job יישום ממתין | pending | `.github/workflows/oil-autofix-investigate.yml` + Environment `oil-autofix` |
| 5 | גשר אישור טלגרם (✅/❌ → מיזוג) | pending | `services/mcp-server/src/*`, `deploy-mcp-server.yml` |
| 6 | אימות פוסט-תיקון + סגירת תיק | pending | `.github/workflows/oil-autofix-investigate.yml` |
| 7 | תיעוד (חריג מכוון ותחום) | pending | `docs/oil-autofix.md`, `CLAUDE.md`, `docs/roadmap.md` |
| 8 | סביבת-בדיקות — הרחבת כיסוי התיקון | deferred | `services/mcp-server/*`, `scripts/`, `.github/workflows/pipeline-tests.yml` (TBD) |

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
PR. לעולם לא ממזג (שלב 4-5). שער-הבטיחות נבדק מקומית ב-6 תרחישים; אימות-ההסלמה החי על main אחרי המיזוג.

**שינוי תוכנית:** נוסף `scripts/oil-autofix-validate.sh` (השער הדטרמיניסטי) כקובץ נפרד — כך
shellcheck בודק אותו ב-CI והוא נבדק ביחידה מקומית. v1 פותח תיקונים רק על `or-factory-master`
(תקלות מערכת מוסלמות — תיקון ברמת התבנית). הסוכן לא מקבל Bash; ה-workflow מריץ את הבדיקה ופותח
את ה-PR; ה-credentials של GCP מוסרים לפני הרצת קוד שה-AI כתב.

---

### שלב 4 — סביבת אישור + job יישום ממתין

**Acceptance:**
- [ ] Environment `oil-autofix` נוצר: required reviewer = App מאשר חדש (`oil-autofix-approver`), prevent-self-review ON, מוגבל ל-main.
- [ ] job `apply` ממתין על הסביבה אחרי פתיחת ה-PR.
- [ ] אומת שה-job אכן נעצר וממתין לאישור.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — גשר אישור טלגרם (✅/❌ → מיזוג)

**Acceptance:**
- [ ] `oil-autofix-approver` App רשום + 3 סודות ב-SM; סודות `oil-approval-register-secret` + `oil-approver-telegram-allowlist`.
- [ ] אחסון state ממתין (Firestore מועדף / GCS) + הרשאת IAM ל-runtime SA.
- [ ] `/oil-approval-register` (שולח הודעת טלגרם אחת ✅/❌ עם approval_id אטום) + `/telegram-webhook` (secret_token + allowlist על from.id + lookup + אישור pending_deployments בזהות ה-App).
- [ ] אומת חי: באג → טלגרם → ✅ → ה-PR ממוזג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — אימות פוסט-תיקון + סגירת תיק

**Acceptance:**
- [ ] אחרי מיזוג + CI ירוק → אימות (reproducer / re-dispatch בטוח של ה-workflow שנכשל).
- [ ] הצלחה → `issueUpdate(completed)` + comment סוגר. כשל → עצירה + comment + טלגרם "נכשל באימות", בלי לסגור.
- [ ] אומת חי את הלולאה המלאה = הגדרת הסיום של Or.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — תיעוד (חריג מכוון ותחום)

**Acceptance:**
- [ ] `docs/oil-autofix.md` חדש; רשומת CHANGELOG.
- [ ] עדכון `CLAUDE.md` + `docs/roadmap.md`: הלולאה מתועדת כחריג מכוון ותחום ל-"auto-chain / issue-based reporting שלא נבנים".

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 8 — סביבת-בדיקות: הרחבת כיסוי התיקון (דחוי)

> השלב הזה דחוי במכוון. הלולאה (שלבים 1–7) נסגרת ומסומנת `completed` כרגיל; שלב 8 *מתבגר
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
