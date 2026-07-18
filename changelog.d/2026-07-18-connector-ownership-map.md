# מפת-בעלות של קונקטורים — שיתופי / or-aios / factory

חקיקת סיווג-הבעלות המוכח בסעיף `## MCP`: לאיזו משתי המערכות (or-factory-master / or-aios) שייך
כל קונקטור, ומה רלוונטי לפי הריפו המחובר — כדי שסשן factory ידע בוודאות מה שלו, בלי ניחוש.

**מפה (מוכחת חי 2026-07-18):**
- **שיתופי (שני הריפוז):** `factory` (`20d5b7f9`), **GitHub** (מובנה + `GitHub CLAUDE` `f492dc70`,
  שניהם `edri2or-commits` — כפילות).
- **or-aios בלבד:** `n8n-live` (`fb1698ee`) + `N8N-or-aios` (`e7bebea5`); `factory-master-actions-mcp`
  (`b6d78a00`, מסלול Google, מתארח ב-factory ומשרת את or-aios).
- **factory בלבד:** אין.
- **לפי סשן:** factory → factory + GitHub בלבד (בלי n8n, בלי `.mcp.json`); or-aios → בנוסף Google + n8n.

**שינוי:** `CLAUDE.md` סעיף `## MCP` — פסקת "Connector ownership across Or's two systems".
תיעוד בלבד.
