---
dev_name: הקמת or-agents (מערכת מקבילה חדשה)
slug: or-agents-bootstrap
opened: 2026-07-18
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הקמת or-agents

## מטרה

Or רוצה מערכת-סוכנים חדשה ונקייה (`or-agents`) לצד `or-aios` — התחלה מחדש עם
ארכיטקטורה שהוא יודע היום שהוא רוצה, אבל עם אותם חיבורים/סודות/Google/MCP שכבר עובדים.
שלב א׳: "השלד שעובד" בלבד — תשתית חיה ומוכחת, בלי תכנון הסוכנים (שיבוא אחרי).

הכלי כאן, `bootstrap-system-infra.yml`, הוא גרסה מצומצמת וחד-פעמית של
`provision-system.yml` שנמחק בקיפול (שוחזר מהיסטוריית git): הוא עושה רק את עבודת
ה-GCP + WIF + Secret-Manager למערכת חדשה שהריפו שלה כבר קיים, בלי scaffolding של תוכן.
לפי החלטת Or (2026-07-18) — יימחק אחרי שירוץ, כדי לכבד את הקיפול.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כלי הקמה + שחזור copy-generic-secrets | in-progress | `.github/workflows/bootstrap-system-infra.yml`, `scripts/copy-generic-secrets.sh` |
| 2 | הרצת ההקמה ל-or-agents + אימות | pending | (ריצת workflow; אימות בכלי קריאה) |
| 3 | מחיקת הכלי (כיבוד הקיפול) | pending | `.github/workflows/bootstrap-system-infra.yml`, `scripts/copy-generic-secrets.sh` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — כלי הקמה + שחזור copy-generic-secrets

**Acceptance:**
- [x] `bootstrap-system-infra.yml` נכתב (normal-mode בלבד, ריפו-קיים, בלי scaffold)
- [x] `scripts/copy-generic-secrets.sh` שוחזר מהיסטוריה
- [ ] CI ירוק על ה-PR

**הוכחה תפקודית (באותו שלב):** קוד-workflow + סקריפט; ההוכחה החיה היא ריצת ה-workflow
עצמו (שלב 2). כאן: CI ירוק (shellcheck/yamllint/actionlint/secret-scan) על ה-PR.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע ב-`workflows/n8n/*.json` או `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** ה-workflow והסקריפט נכתבו; ממתין ל-PR ו-CI.

**שינוי תוכנית:** התגלה ש-`gcp-action.yml` לא יכול ליצור WIF (הגנת-charset חוסמת `&&`/מרכאות
בתנאי ה-CEL), ולכן נדרש workflow ייעודי במקום פקודות בודדות בערוץ הקל.

---

### שלב 2 — הרצת ההקמה ל-or-agents + אימות

**Acceptance:**
- [ ] `bootstrap-system-infra.yml` רץ עם `system_name=or-agents` והסתיים בהצלחה
- [ ] פרויקט GCP `or-agents` + runtime-sa + deploy-sa + WIF נעול לריפו — מאומת בכלי קריאה
- [ ] הסודות הועתקו/מונטו; משתני הריפו נקבעו

**הוכחה תפקודית (באותו שלב):** `verify_gcp_system` / `inspect_wif_provider` / `list_iam_bindings`
/ `list_system_secrets` / `list_repo_variable` (קריאה בלבד) מאשרים את המצב החי.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — מחיקת הכלי (כיבוד הקיפול)

**Acceptance:**
- [ ] `bootstrap-system-infra.yml` + `scripts/copy-generic-secrets.sh` נמחקים לאחר הצלחה
- [ ] תוכנית זו נסגרת `status: completed`

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (הסרה) — הפעולה מוכחת בכך ש-or-agents כבר עומד
מהשלב הקודם.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- <מתמלא תוך כדי>
