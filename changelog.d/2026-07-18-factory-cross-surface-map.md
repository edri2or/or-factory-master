# מפה חוצת-משטחים ב-CLAUDE.md — מוכח ע"י בדיקת-Cowork על factory

בדיקה חיה בסשן Cowork שמחובר לריפו factory (Or הריץ, החזיר תוצאות) אישרה איזה קונקטור נכנס לכל
משימה בסשן-factory, כולל הוכחה חיה ש-factory אין לו n8n.

**מוכח (2026-07-18):**
- **GitHub:** Claude Code → `github` (מובנה); Cowork → `GitHub CLAUDE` (`f492dc70`). שניהם
  `edri2or-commits`. Cowork חסר את המובנה → `GitHub CLAUDE` הוא מסלול ה-GitHub **היחיד** שלו,
  **אין למחוק** (הוא כפול רק בתוך Claude Code).
- **Google:** שני המשטחים → `factory-master-actions-mcp` (`b6d78a00`), 3 יומנים, ראשי `edri2or@gmail.com`.
- **n8n של factory:** נכשל חי עם **`n8n_key_missing`** דרך קונקטור `factory`
  (`list_n8n_workflows systemName=factory`) — הוכחה חיה ש-factory **אין לו n8n**. הקונקטורים של
  or-aios (`N8N-or-aios`/`n8n-live`) לא נגעו בהם.

**שינוי:** `CLAUDE.md` סעיף `## MCP` — תיקון ניסוח שורת GitHub ("not a removable duplicate") +
פסקה חדשה "Claude Code vs Cowork (factory session) — proven live". תיעוד בלבד.
