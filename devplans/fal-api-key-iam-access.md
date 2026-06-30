<!--
DEVPLAN — fal-api-key-iam-access
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: הרשאת-קריאה קבועה ל-fal-api-key במערכת or-aios
slug: fal-api-key-iam-access
opened: 2026-06-30
status: completed
---

# תוכנית פיתוח — הרשאת-קריאה ל-fal-api-key (or-aios)

## מטרה

Or הוסיף ידנית סוד `fal-api-key` (מפתח fal.ai לפיצ'ר ה-likeness/LoRA) ל-SM של מערכת
or-aios (GCP `factory-test-8`). ל-`runtime-sa` ול-`deploy-sa` לא הייתה הרשאת
`roles/secretmanager.secretAccessor` על הסוד, אז workflow שרץ דרך WIF נכשל ב-"lacks
secretAccessor". הפיתוח: (1) הענקת ה-binding **חי ועכשיו** על `factory-test-8` דרך
`grant-secret-accessor.yml` הקיים, ו-(2) הוספת `fal-api-key` ל**רשימת-הסודות המנוהלת**
(`RUNTIME_SHELLS` ב-`provision-system.yml`) כדי שההרשאה תהיה **קבועה** ולא תיעלם ב-re-provision.
לא נוגעים בערך הסוד. זו בקשת plumbing — אין יכולת חדשה, לכן capability-first מדולג.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הענקה חיה + רשימה מנוהלת קבועה | completed | `.github/workflows/provision-system.yml`, `changelog.d/`, `devplans/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הענקה חיה + הוספה לרשימה המנוהלת

**Acceptance:**
- [x] הרצת `grant-secret-accessor.yml` (קיים על main) עם `gcp_project=factory-test-8`,
      `secret_name=fal-api-key`, `members=""` → ברירת-מחדל `deploy-sa` + `runtime-sa`,
      מסתיימת ב-success (שלב ה-grant נכשל ב-`exit 1` אם binding לא הוחל → ריצה ירוקה = הוכחה).
- [x] `fal-api-key` נוסף ל-`RUNTIME_SHELLS` ב-`provision-system.yml` — אותו מנגנון שיוצר shell
      (אם חסר, בלי לדרוס ערך) ומעניק `secretAccessor` ל-`runtime-sa` + `deploy-sa` בכל provision.
- [x] שערי CI: changelog fragment + devplan.

**הוכחה תפקודית (באותו שלב):** הריצה החיה של `grant-secret-accessor.yml` היא ההוכחה התפקודית —
שלב ה-grant שבה מאמת שכל member קיבל binding. שינוי ה-`RUNTIME_SHELLS` הוא plumbing
שיוכח בריצת provision/adopt עתידית (idempotent: create-if-missing + grant set-semantics).

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע בקבצי-התנהגות של בוט).

**הערת התקדמות אחרונה:** ה-binding הוענק חי; הרשימה המנוהלת עודכנה כדי שההרשאה תשרוד re-provision.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם — נתתי למערכת or-aios הרשאה לקרוא את מפתח fal.ai החדש ששמת בכספת (לא נגעתי
  בערך עצמו). גם הוספתי אותו ל"רשימה הקבועה" של המערכת, כך שאם המערכת אי-פעם תיבנה מחדש —
  ההרשאה תחזור לבד ולא תיעלם.
