---
dev_name: תיקון דליפת מפתח פרטי בלוג של Configure Agent Router (מיסוך רב-שורתי)
slug: mask-multiline-secrets
opened: 2026-06-11
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — תיקון דליפת מפתח פרטי בלוג של Configure Agent Router

## מטרה

בקובץ `templates/system/.github/workflows/configure-agent-router.yml` (שמועתק לכל מערכת
שהפקטורי מקים) השורה שאמורה להסתיר את המפתח הפרטי של ה-GitHub App בלוג —
`echo "::add-mask::${GH_APP_PRIVATE_KEY}"` — היא זו שמדליפה אותו: `::add-mask::` עובד
שורה-שורה, ומפתח PEM הוא רב-שורתי, אז רק השורה הראשונה ממוסכת וכל גוף המפתח נשפך ללוג.
מוסיפים helper בשם `_mask_secret` שממסך נכון (כולל רב-שורתי), מחליפים בו את כל 18
קריאות ה-add-mask בקובץ, מוכיחים בבדיקה קבועה + על מערכת-טסט חיה, ומקדמים.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | התיקון + הוכחה מקומית + שערים סטטיים ירוקים | in-progress | configure-agent-router.yml, scripts/tests/mask-secret.bats, tests/golden/system/ |
| 2 | הוכחה חיה על מערכת-טסט זולה (reuse mode) | pending | — (dispatches בלבד) |
| 3 | קידום — merge ל-main | pending | — |
| 4 | מערכות קיימות (החלטת Or) | pending | — (refresh-system-agents per system) |
| 5 | פירוק מערכת-הטסט + סגירה | pending | devplans/mask-multiline-secrets.md |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב* — לא
> "CI ירוק" (הכרחי אך לא מספיק), ולא "הוכחה בשלב מאוחר". בנייה מלמטה-למעלה; החיבור
> החיצוני הוא הלבנה האחרונה, לא כלי הבדיקה הראשון.

---

### שלב 1 — התיקון + הוכחה מקומית + שערים סטטיים ירוקים

**Acceptance:**
- [ ] helper בשם `_mask_secret` מוגדר מיד אחרי `_sm_read` (לפני השימוש הראשון בסוד): ריק → כלום; חד-שורתי → mask אחד; רב-שורתי → mask לכל שורה לא-ריקה; הערך לעולם לא נפלט מחוץ לפקודת add-mask; תמיד מחזיר 0.
- [ ] כל 18 קריאות `echo "::add-mask::…"` בקובץ הומרו ל-`_mask_secret "$X"` (כולל שורת הדליפה של `GH_APP_PRIVATE_KEY`).
- [ ] אומת שאין `set -x`/trace בקובץ (יש רק `set -euo pipefail` ו-`set +e/-e` נקודתי סביב ה-smoke).
- [ ] `scripts/tests/mask-secret.bats` חדש: מחלץ את ה-helper מקובץ ה-workflow, מריץ על PEM אמיתי שנוצר ב-runtime (`openssl genrsa` — שום מפתח לא נכנס לריפו), כולל הדגמת fail-before של הדפוס הישן ו-regression pin על הקובץ עצמו.
- [ ] golden רוענן (`bash scripts/check-system-golden.sh --update`) באותו commit.
- [ ] כל הבדיקות המקומיות ירוקות + כל ה-checks על ה-PR ירוקים (Playground tests, Changelog gates, shellcheck + yamllint, Scan for committed secrets, Supply chain gates).

**הוכחה תפקודית (באותו שלב):** ריצת `mask-secret.bats` על מפתח RSA אמיתי שנוצר בזמן
הבדיקה: (א) כל שורת פלט של ה-helper היא פקודת `::add-mask::` וכל שורת מפתח לא-ריקה
מכוסה; (ב) fail-before — הדפוס הישן (`echo "::add-mask::$PEM"`) אכן פולט את גוף המפתח
החל מהשורה השנייה (משחזר את הבאג); (ג) pin — הקובץ לא מכיל יותר את שורת ה-echo הישנה על
המפתח. הבדיקה קבועה ב-"Playground tests" — הוכחה שחוזרת בכל ריצת CI, לא חד-פעמית.

**הערת התקדמות אחרונה:** המימוש הושלם מקומית: ה-helper נוסף, כל 18 האתרים הומרו
(`grep`: נשארו בדיוק 2 פקודות mask — שתיהן בתוך ה-helper), אומת שאין `set -x`, ה-golden
רוענן (שורת hash אחת בדיוק), ו-`mask-secret.bats` ירוק 6/6 כולל שחזור הדליפה בדפוס הישן
על מפתח RSA אמיתי. כל סוללת ה-bats ‏158/158, yamllint/validate-templates/שערי התבנית
וסריקת הסודות ירוקים מקומית. ממתין ל-CI על ה-PR.

**שינוי תוכנית:** —

---

### שלב 2 — הוכחה חיה על מערכת-טסט זולה (reuse mode)

**Acceptance:**
- [ ] באישור Or: מערכת-טסט throwaway הוקמה ב-reuse mode (`shared_gcp_project=factory-test-25`, ‏0 מכסת GCP): provision → register-system-app (2 קליקים של Or — חובה כדי שיהיה PEM אמיתי ב-SM) → deploy, עם verify אחרי כל אחד.
- [ ] Baseline (אם Or לא דילג): ריצת `configure-agent-router.yml` עם הקוד הישן מ-main מציגה את הדליפה חיה בלוג (מפתח-צעצוע של מערכת throwaway).
- [ ] `prove-on-test-system.yml` עם `ref=claude/bold-darwin-033tsk`, `paths=.github/workflows/configure-agent-router.yml`, `post_apply_workflow=configure-agent-router.yml` עבר בהצלחה (PR פנימי בריפו-הטסט מוזג דרך ה-CI שלו).
- [ ] בלוג הריצה החדשה: אפס תוכן PEM; שורת `GitHub App JWT credential id=` קיימת (ה-credential עדיין נוצר); סיכום הראוטר PASS (ה-soft-fail לא נשבר).

**הוכחה תפקודית (באותו שלב):** קריאת לוג ה-job של configure-agent-router על מערכת-הטסט
אחרי החלת התיקון מהענף (`read_github_actions_run_logs` עם grep על דפוסי PEM): הקלט
האמיתי הוא המפתח הפרטי האמיתי של מערכת-הטסט שנקרא מ-SM בריצה חיה; הפלט המצופה — הלוג
נקי לחלוטין מתוכן המפתח, לעומת ה-baseline שמראה אותו. אימות בלתי-תלוי-MCP-של-n8n (לוג
GitHub Actions בלבד).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — קידום: merge ל-main

**Acceptance:**
- [ ] באישור Or: ה-PR מוזג (squash) ל-main אחרי שכל ה-checks ירוקים.
- [ ] ריצות ה-CI על main אחרי המיזוג ירוקות.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד מבחינת קוד חדש — ההוכחה היא מצב ה-main: המיזוג
עבר דרך ה-ruleset (PR-only) וכל שערי ה-CI על main ירוקים; `get_file_contents` על main
מראה את `_mask_secret` בקובץ התבנית.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — מערכות קיימות (החלטת Or)

**Acceptance:**
- [ ] מופו המערכות החיות שנושאות את הקובץ הישן (or-adhd-agent מאומתת; לבדוק or-tok, tokile, or-edri-2, project-life-130).
- [ ] הוצגו ל-Or האפשרויות (refresh-system-agents.yml פר מערכת עם `paths=.github/workflows/configure-agent-router.yml`; עם/בלי הרצת configure מחדש) + ה-flag על מפתחות שכבר הופיעו בלוגים ישנים (שאלת rotation — הצגה בלבד, לא נבנית כאן).
- [ ] בוצע מה ש-Or אישר, ואומת שהקובץ נחת בכל מערכת שאושרה (grep `_mask_secret` דרך `get_file_contents`).

**הוכחה תפקודית (באותו שלב):** לכל מערכת שאושרה — `get_file_contents` על
`.github/workflows/configure-agent-router.yml` בריפו שלה מראה את ה-helper ולא את שורת
ה-echo הישנה; ה-PR של ה-refresh מוזג דרך ה-CI של המערכת.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — פירוק מערכת-הטסט + סגירה

**Acceptance:**
- [ ] הוצע ל-Or פירוק ה-throwaway (`decommission-test-system.yml` — רק בהוראתו, לעולם לא אוטומטית).
- [ ] שורת Teardown ledger נרשמה (ראה למטה) — `torn-down` או `left-alive by user decision`.
- [ ] `status: completed` + יומן ל-Or מעודכן + סיכום סגירה קצר בעברית.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (סגירת תיעוד); אם בוצע פירוק — ריצת
decommission הסתיימה בהצלחה ואומת שפרויקט ה-Railway וה-DNS נמחקו והריפו אורכב.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> שורה חיה אחת. מתעדכנת בכל שינוי מצב — גם אחרי שהתוכנית completed.

- טרם הוקמה מערכת-טסט (שלב 2 עוד לא התחיל).

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- (מתמלא תוך כדי)
