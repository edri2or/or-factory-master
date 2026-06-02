---
dev_name: עיניים על החיובים — כלי עלות ומשאבים ל-MCP
slug: mcp-org-inventory-billing
opened: 2026-06-02
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — עיניים על החיובים

## מטרה

לתת לסוכן "ידיים" לראות כסף ומשאבים. אחרי שה-broker SA קיבל הרשאות חיוב/asset/BigQuery,
מוסיפים ל-MCP server שני כלי קריאה קבועים: `inspect_all_org_resources` (רשימת כל המשאבים
בארגון בקריאה אחת) ו-`get_billing_costs` (פירוק עלות לפי פרויקט/שירות מתוך ה-Billing→BigQuery
export). מעכשיו אפשר לשאול בכל שיחה "כמה אני מוציא ועל מה?" ולקבל תשובה מיידית — בלי קונסול.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | הרשאות + export (Cloud Shell + קונסול) | completed | (out-of-band: IAM, APIs, BQ dataset, billing export) |
| 1 | פונקציות עזר ב-gcp-client | completed | `services/mcp-server/src/gcp-client.ts` |
| 2 | רישום שני הכלים ב-tools | completed | `services/mcp-server/src/tools.ts` |
| 3 | Deploy + אימות חי | completed | `.github/workflows/deploy-mcp-server.yml` (dispatch) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 0 — הרשאות + export

**Acceptance:**
- [x] `roles/billing.viewer` ל-broker SA על חשבון החיוב `014D0F-AC8E0F-5A7EE7`
- [x] `roles/cloudasset.viewer` ל-broker SA על הארגון `905978345393`
- [x] `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` ל-broker SA על `or-factory-master-control`
- [x] APIs: cloudasset / cloudbilling / bigquery מופעלים
- [x] dataset `billing_export` (US) + Detailed-usage Billing→BigQuery export מופעל

**הערת התקדמות אחרונה:** הושלם ע"י Or ב-Cloud Shell + קונסול (2026-06-02). הדאטה הראשונה ב-BQ תוך ~24ש'.

**שינוי תוכנית:** —

---

### שלב 1 — פונקציות עזר ב-gcp-client

**Acceptance:**
- [x] `searchAllOrgResources()` — Cloud Asset searchAllResources, pagination, ספירות לפי project/type, cap 20 עמודים
- [x] `queryBillingCosts()` — BigQuery jobs.query עם `location:"US"`, query פרמטרי, table-not-found → `available:false`
- [x] `npm run build` (tsc) נקי

**הערת התקדמות אחרונה:** נכתב, מתקמפל נקי, REST בלבד (בלי תלויות npm חדשות).

**שינוי תוכנית:** —

---

### שלב 2 — רישום שני הכלים ב-tools

**Acceptance:**
- [x] `inspect_all_org_resources` רשום (schema `assetTypes?`, ענף permission_denied)
- [x] `get_billing_costs` רשום (schema `days?`/`groupBy?`, ענף permission_denied)
- [x] build + `node --test` (40/40) עוברים

**הערת התקדמות אחרונה:** שני הכלים רשומים אחרי `gcp_project_quota_status`, פורמט תגובה סטנדרטי.

**שינוי תוכנית:** —

---

### שלב 3 — Deploy + אימות חי

**Acceptance:**
- [x] PR ירוק → merge ל-`main` (commit `2966b36`)
- [x] `deploy-mcp-server.yml` רץ בהצלחה (build מריץ tsc + node --test)
- [x] בסשן חדש: `inspect_all_org_resources` מחזיר סיכום משאבים (10,000 משאבים, 154 פרויקטים, ~6,480 secret-objects, `truncated:true`)
- [x] `get_billing_costs` מחזיר `available:false` עם הודעת warm-up — מתעדכן ל-`rows`+`totalCost` תוך ~24ש'

**הערת התקדמות אחרונה:** הכלים חיים בפרודקשן; אומתו דרך MCP בסשן הזה (2026-06-02).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 0 הושלם — נתת לסוכן הרשאות לראות חיובים ומשאבים, והפעלת זרימת פירוט החיובים.
- שלב 1+2 הושלמו — בניתי לסוכן שני כלים חדשים: "מה רץ בכל הארגון" ו"כמה כל דבר עולה".
- שלב 3 הושלם — הכלים עלו לפרודקשן (MCP server) ואומתו חי: "מה רץ" מחזיר 10,000 משאבים על פני 154 פרויקטים, ו"כמה עולה" עוד מתחמם (~24ש' עד הנתון הראשון מ-BigQuery).
