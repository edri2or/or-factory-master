## כלי הסרת workflow מ-n8n חי של מערכת (remove-system-n8n-workflow)

נסגר "פער הניקוי" שזוהה ב-`enforce-capability-first`: לא הייתה דרך נקייה להסיר יכולת/`workflow`
ממערכת חיה. נוסף כלי-ניהול מינימלי ומגודר (גם ממלא את "כלי-ההסרה" של שלב-3 שנדחה, בגרסה קטנה).

- **`.github/workflows/remove-system-n8n-workflow.yml` (חדש, factory-only, מחוץ ל-dispatch
  allowlist):** dispatch ידני בלבד. מסיר workflow אחד מ-n8n של מערכת חיה — deactivate + delete
  דרך ה-n8n Public API (`X-N8N-API-KEY`, fallback ל-`/rest` cookie-login) — ואופציונלית מוחק
  משתני-סביבה ב-Railway מ-service ה-n8n (`variableDelete`). רץ כ-broker SA דרך WIF, קורא את ה-SM
  של המערכת חוצה-פרויקט (דפוס מ-`mirror-secret-to-system.yml`). שומרים: סירוב קשיח
  control/factory/`factory-test-25`, `confirm==system_name`, ולידציית `system_name`/`workflow_id`,
  אימות שה-workflow קיים לפני ואינו קיים אחרי, אידמפוטנטי (כבר-לא-קיים = no-op), ולעולם לא מדפיס
  ערכי-סוד. לא מאלץ redeploy (לא מפעיל-מחדש מערכת חיה).
- **`monitoring/registry-exempt.txt`:** הכלי נרשם כ-manual operator tool (workflow_dispatch בלבד,
  אין cadence).
- **capability-first self-check:** כלי-ניהול תחת `.github/workflows/` (לא `templates/system/workflows/n8n/`)
  שמשתמש ב-API-ים שהפקטורי כבר מפעיל → אין יכולת-חוץ גולמית חדשה → מדלג על Phase-1 (plumbing).
- **הוכחה:** yamllint + actionlint(+shellcheck) נקיים; השומרים נבדקו (regex/refusals). הרצה חיה על
  or-edri-4 (הסרת `email-form-intake`, id `cTKyxHEOE43jqsPh`) מתבצעת בנפרד לאחר ✅ של Or, ומאומתת
  ב-`list_n8n_workflows` (27→26).
