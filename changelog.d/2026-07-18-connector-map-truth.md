# מפת-קונקטורים ב-CLAUDE.md — ול-factory אין n8n משלו

חקירה חיה בסשן (פרוטוקול-אמת) הבהירה איזה קונקטורים סשן factory באמת משתמש בהם, ותיעדה במפורש
ש-or-factory-master **לא מריץ n8n משלו** — כדי שסשן לא ינחש ולא ינסה קונקטורי n8n "עבור factory".

**מה הוכח (2026-07-18):** ה-inventory מראה פרויקט Railway אחד בלבד (`or-aios`); אין ב-factory אף
קובץ workflow n8n; ה-route `/n8n/<system>/mcp` הוא פרוקסי ל-n8n של מערכות *אחרות*
(`n8n-<system>.or-infra.com`, מפתח-המערכת מוזרק בצד-שרת). ה-n8n היחיד הוא של or-aios.

**שינוי:** `CLAUDE.md` סעיף `## MCP` — נוסף תת-סעיף "Which connectors a factory session uses — and
factory has NO n8n of its own": רשימת הקונקטורים של סשן factory (`factory` / GitHub / Google-gateway),
הבהרה שאין n8n של factory (והקידומת `factory-master:` היא חותמת-מותג של התבניות שנמחקו, לא ראיה
ל-n8n משלו), וכלל "השתמש רק במה שמתועד כשייך למערכת — אל תנסה קונקטור רק כי הוא מחובר". קונקטורי
`n8n-live`/`N8N-or-aios` שייכים ל-or-aios; `n8n-all`/`n8n-or-edri-base`/`n8n-or-tok` לאף אחד מהשניים.

תיעוד בלבד; לא נוגע ב-gateway/workflows/תשתית.
