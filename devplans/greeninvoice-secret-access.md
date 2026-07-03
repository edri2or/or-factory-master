<!--
DEVPLAN — greeninvoice-secret-access
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: הרשאת-קריאה קבועה ל-greeninvoice-api-{id,secret} במערכת or-aios
slug: greeninvoice-secret-access
opened: 2026-07-03
status: completed
---

# תוכנית פיתוח — הרשאת-קריאה לזוג סודות Green Invoice (or-aios)

## מטרה

Or יצר ידנית בקונסול שני סודות ב-SM של מערכת or-aios (GCP `factory-test-8`,
מספר 922467928893) עבור אינטגרציית חשבונית ירוקה (morning): `greeninvoice-api-id`
ו-`greeninvoice-api-secret` (שניהם עם version 1 Enabled). ל-`runtime-sa` ול-`deploy-sa`
לא הייתה הרשאת `roles/secretmanager.secretAccessor` עליהם, כמו שיש לכל סוד פר-מערכת אחר.
הפיתוח — שכפול מדויק של תקדים `fal-api-key-iam-access` (2026-06-30): (1) הענקת ה-binding
**חי ועכשיו** דרך `grant-secret-accessor.yml` הקיים, פעם לכל סוד, ו-(2) הוספת שני השמות
ל**רשימה המנוהלת** (`RUNTIME_SHELLS` ב-`provision-system.yml`) כדי שההרשאה תהיה **קבועה**
ולא תיעלם ב-re-provision. לא נוגעים בערכי הסודות. plumbing בלבד — אין יכולת חדשה, לכן
capability-first מדולג.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הענקה חיה לשני הסודות + רשימה מנוהלת קבועה | completed | `.github/workflows/provision-system.yml`, `changelog.d/`, `devplans/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הענקה חיה + הוספה לרשימה המנוהלת

**Acceptance:**
- [x] הרצת `grant-secret-accessor.yml` (על main) עם `gcp_project=factory-test-8`,
      `secret_name=greeninvoice-api-id`, `members=""` → ברירת-מחדל `deploy-sa` + `runtime-sa`
      — run 28629413804, success; הלוג מאשר PASS לשני החשבונות.
- [x] אותה הרצה עבור `secret_name=greeninvoice-api-secret` — run 28629429889, success;
      הלוג מאשר PASS לשני החשבונות.
- [x] שני השמות נוספו ל-`RUNTIME_SHELLS` ב-`provision-system.yml` — אותו מנגנון שיוצר shell
      (אם חסר, בלי לדרוס ערך) ומעניק `secretAccessor` ל-`runtime-sa` + `deploy-sa` בכל provision.
- [x] שערי CI: changelog fragment + devplan.

**הוכחה תפקודית (באותו שלב):** שתי הריצות החיות של `grant-secret-accessor.yml` הן ההוכחה —
שלב ה-grant נכשל ב-`exit 1` אם binding לא הוחל, ושתיהן ירוקות עם PASS מפורש פר-member.
בדיקת-ההצלחה שהוגדרה מראש (workflow "Green Invoice — verify secret shells" במערכת or-aios,
שקורא `versions access latest` כ-deploy-sa אל /dev/null) זמינה ל-Or/למערכת להרצה כאימות נוסף.
שינוי ה-`RUNTIME_SHELLS` הוא plumbing שיוכח בריצת provision/adopt עתידית.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע בקבצי-התנהגות של בוט).

**הערת התקדמות אחרונה:** ה-bindings הוענקו חי על שני הסודות ואומתו בלוגים; הרשימה המנוהלת
עודכנה כדי שההרשאה תשרוד re-provision.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם — נתתי למערכת or-aios הרשאה לקרוא את שני המפתחות של חשבונית ירוקה ששמת
  בכספת (לא נגעתי בערכים עצמם). גם רשמתי אותם ב"רשימה הקבועה" של המערכת, כך שאם המערכת
  אי-פעם תיבנה מחדש — ההרשאה תחזור לבד ולא תיעלם.
