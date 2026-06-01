---
dev_name: הוכח→מזג — מפתח-צעצוע סנדבוקס לענף-עבודה
slug: prove-before-merge
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הוכח→מזג (prove-before-merge)

## מטרה

היום, כדי לנסות שינוי על מערכת-טסט חיה, חייבים קודם למזג ל-main ("מזג→הוכח"). הופכים את
הסדר ל"הוכח→מזג": בונים **מפתח-צעצוע** — זהות-ענן זעירה שגרה רק בתוך `factory-test-25`
ומותר להפעיל גם מענף-עבודה. הוא מאפשר לדחוף שינוי מהענף אל מערכת-טסט חיה ולבדוק חי, *לפני*
המיזוג. המפתח החזק (broker) נשאר נעול ל-main — לא נוגעים בו.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הקמת זהות-הסנדבוקס (תשתית; broker; ממוזג ראשון) | completed | `.github/workflows/bootstrap-sandbox-tester.yml`, `scripts/bootstrap-sandbox-tester.sh`, `services/mcp-server/src/tools.ts` |
| 2 | שלד ה-workflow המתזמר ל-main (כדי שיהיה ניתן-להרצה-מענף) | in-progress | `.github/workflows/prove-on-test-system.yml`, `services/mcp-server/src/tools.ts`, `monitoring/registry-exempt.txt` |
| 3 | גוף ה-workflow — מפותח ומוכח מענף (ה-dogfood) | pending | `.github/workflows/prove-on-test-system.yml` |
| 4 | הוכחה חיה על מערכת-טסט (מהלך-עלות, באישור Or) | pending | — (הרצות חיות) |
| 5 | תיעוד + סגירה | pending | `docs/live-test-loop.md`, `CLAUDE.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הקמת זהות-הסנדבוקס

יוצרים על `factory-test-25` זהות-צעצוע נפרדת ומינימלית: pool+provider חדשים
(`sandbox-pool`/`github-sandbox-provider`, CEL נעול ל-owner-id+repo-id של הפקטורי, **כל ref**),
ו-SA חדש `sandbox-tester-sa` שמקבל **רק** `secretAccessor` על שלושת סודות ה-`github-app-*`
של מערכת-הטסט. ה-`github-pool`/test_pool הקיים (נעול ל-main) נשאר ללא נגיעה.

**Acceptance:**
- [x] `bootstrap-sandbox-tester.yml` + `scripts/bootstrap-sandbox-tester.sh` נכתבו, idempotent, ועם hard-guard שמסרב לכל פרויקט שאינו `factory-test-25`.
- [x] שערים סטטיים ירוקים (Changelog gates + Playground tests); אין שינוי golden (לא נגענו ב-`templates/system/**`).
- [x] ה-bootstrap רץ בהצלחה ב-factory-test-25, וה-provider/SA/הרשאות אומתו חי ומינימליים (MCP `inspect_wif_provider` + `list_iam_bindings`).

**הערת התקדמות אחרונה (הושלם):** הזהות באוויר ומאומתת חי. אימות MCP:
(1) `inspect_wif_provider(sandbox-pool/github-sandbox-provider)` → state ACTIVE, CEL בדיוק
`assertion.repository_owner_id=='259965754' && assertion.repository_id=='1245681889'` (הפקטורי, **כל ref**, ללא נעילת-main).
(2) `list_iam_bindings(factory-test-25)` → `sandbox-tester-sa` מופיע **פעם אחת בלבד**, עם
`roles/secretmanager.secretAccessor_withcond_...` (ה-`_withcond_` מאשר שה-IAM Condition מחובר —
github-app-* בלבד), ואפס תפקידים אחרים (לא owner, לא admin, כלום). מינימלי בדיוק כמתוכנן.
הדרך לשם: 3 הרצות — תוקנו propagation-retry ו-idempotency של "כבר-קיים" (PR #270, #271).

**שינוי תוכנית:** הקדמתי את הוספת ה-workflow ל-MCP allowlist (שתוכנן במקור לשלב 5) לתוך שלב 1,
לפי בחירת Or "להוסיף לאוטומציה" במקום לחיצה ידנית חד-פעמית. דורש redeploy אחד של שרת ה-MCP.
ההרצה הראשונה של ה-bootstrap נכשלה בשלב האחרון (הרשאת קריאת-סודות) בגלל השהיית-התפשטות
ידועה של IAM ("SA does not exist" מיד אחרי יצירת ה-SA) — תיקנתי בהוספת retry (כמו ב-provision),
ה-pool/provider/SA כבר נוצרו (idempotent). ההרצה החוזרת נפלה בנקודה אחרת קטנה: בדיקת
ה"כבר-קיים" של יצירת ה-SA חיפשה טוקן מדויק בלבד (`ALREADY_EXISTS`) ולא זיהתה את הניסוח
ש-gcloud מחזיר ל-SA קיים ("subject of a conflict") — תיקנתי גם את זה (PR #271). נותר: למזג
ולהריץ את ה-bootstrap שוב עד שמסיים נקי, ואז לאמת את הזהות ב-MCP.

---

### שלב 2 — שלד ה-workflow המתזמר ל-main

`prove-on-test-system.yml` עם `on: workflow_dispatch` + inputs (`system_name`, `paths`,
`post_apply_workflow`) וגוף מינימלי: אימות דרך provider-הסנדבוקס→`sandbox-tester-sa` והדפסת
הזהות. נדרש מיזוג ל-main כדי ש-GitHub יאפשר הרצה-מענף בהמשך.

**Acceptance:**
- [x] הקובץ קיים עם `workflow_dispatch` + ה-inputs, גוף-שלד שמאמת מול provider-הסנדבוקס ומוודא שהזהות הפעילה היא ה-sandbox SA (לא broker).
- [x] שערים סטטיים ירוקים (yamllint + tsc + node --test 40/40); אין שינוי golden.
- [ ] לאחר מיזוג + redeploy של ה-MCP: אימות חי שהשלד ניתן-להרצה ומאמת כ-sandbox SA.

**הערת התקדמות אחרונה:** השלד נכתב — `workflow_dispatch` בלי נעילת-main, אימות דרך
`github-sandbox-provider`→`sandbox-tester-sa`, ובדיקת-זהות שנכשלת אם רואים את ה-broker. הוסף
ל-allowlist של ה-MCP (`tools.ts`) ולרשימת-הפטור של השומר. נותר: מיזוג + redeploy אחד של ה-MCP,
ואז הרצת-בדיקה (אפשר מ-main קודם) שמאשרת שהאימות עובד.

**שינוי תוכנית:** הוספתי כבר בשלב 2 גם את ה-allowlist + הפטור (במקור תוכננו לשלב 5), כדי
שרענון-ה-MCP אחד יספיק גם לשלב 3 (הרצת השלד/הגוף מענף).

---

### שלב 3 — גוף ה-workflow (מפותח ומוכח מענף)

ממלאים את `prove-on-test-system.yml` כתאום סנדבוקס + ניתן-להרצה-מענף של
`refresh-system-agents.yml`: קריאת פרטי-האפליקציה של ריפו-הטסט מ-SM של `factory-test-25`
(דרך ה-SA הסנדבוקס) → הנפקת token מצומצם-לריפו-הטסט (`scripts/generate-app-token.sh`) →
העתקת `templates/system/<paths>` **מהענף** אל ה-`main` של ריפו-הטסט → הפעלת
ה-deploy/configure של ריפו-הטסט → סיכום. מסרב לריפו בקרה/אמיתי; מאמת צורת `system_name`;
idempotent (אין diff → אין push). כאן "הוכח→מזג" מתבצע בפועל: מפתחים בענף, מריצים את
ה-workflow **מהענף**, וממזגים רק כשעובד.

**Acceptance:**
- [ ] הגוף המלא נכתב; מסרב לריפו בקרה/אמיתי; idempotent.
- [ ] שערים סטטיים ירוקים.
- [ ] הוכחה מהענף (לפני מיזוג): הרצה מהענף הצליחה, הלוגים מראים אימות כ-`sandbox-tester-sa` (לעולם לא broker), והשינוי הוחל על ריפו-הטסט.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — הוכחה חיה על מערכת-טסט

באישור Or המפורש (מהלך-עלות): מקימים מערכת-טסט זולה לזריקה (provision reuse → register-app
→ deploy). ואז מהענף מריצים את `prove-on-test-system.yml` כדי להחיל שינוי-תבנית מוכר וזניח
ולבדוק חי (`probe_endpoint` על `/healthz`/UI, או סבב Telegram). מתקנים→מחילים→בודקים עד ירוק.

**Acceptance:**
- [ ] מערכת-טסט חיה הוקמה (באישור Or).
- [ ] השינוי הוחל מהענף והוכח חי (probe/Telegram), עם תיעוד התוצאה בתוכנית.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — תיעוד + סגירה

עדכון `docs/live-test-loop.md` (מסלול הוכח→מזג מהענף) ו-`CLAUDE.md` (טבלת Workflows: שני
ה-workflows החדשים; הערת-זהות לסנדבוקס; הוספת `prove-on-test-system.yml` ל-allowlist של
`dispatch_workflow` אם רוצים תזמור-מ-MCP). fragment ל-changelog. מילוי **Teardown ledger**.
סטטוס → `completed`.

**Acceptance:**
- [ ] התיעוד עודכן; fragment ל-changelog נכתב.
- [ ] Teardown ledger מלא (torn-down או left-alive בהחלטת Or).
- [ ] `status: completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> שורה חיה אחת. מתעדכנת ברגע שמתבצע פירוק — גם בסשן מאוחר יותר.

- מצב: טרם הוקמה מערכת-טסט (נכון ל-2026-06-01).

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם ואומת חי — "מפתח-הצעצוע" באוויר על factory-test-25: זהות זעירה שמותר להפעיל מענף, יכולה לקרוא רק את סודות-הכניסה של מערכת-הטסט, ואפס גישה לכל השאר. המפתח החזק לא נגעו בו.
