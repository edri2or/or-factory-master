# סנכרון-תיעוד: `append_agent_data` נכנס למלאי-הכלים ולהערת-ה-gate

אחרי שכלי-השער `append_agent_data` נפרס (#637) והוכח חי (בדיקת-עשן 2026-07-21: `appended:true`,
commit `94fe3d76`, main נקי, path-lock עובד, לא מגודר על claude.ai), התיעוד עודכן כדי לא להשאיר
רשומה שסותרת מציאות:

- **`CLAUDE.md` § MCP** — מלאי כלי-הכתיבה עודכן מ"**שני** כלי-כתיבה … `dispatch_workflow` הכתיבה-
  החוצה-ריפו היחידה" ל-**שלושה**: `append_agent_data` הוא **הכותב-חוצה-ריפו השני** (append לענף
  `agent-data` של `edri2or/or-agents`, טוקן broker מוגבל-לריפו + `contents:write` server-side,
  path-allowlist ל-`agents/<agent>/data/`, main נעול).
- **`CLAUDE.md` § Web-session connector gate** — נוספה עובדה חיה: ה-gate הוא **פר-כלי, לא גורף**.
  `append_agent_data` (כלי-כתיבה) **הוכח לא-מגודר** על claude.ai — סוכן or-agents על משטח מנוהל
  יכול להתמיד שורת-דאטה ישירות.
- **`docs/mcp-connector-setup.md`** — הצלב-קישור להערת-ה-gate חודד: הכלי הוא כתיבה לא-מגודרת במחבר.

שינוי-תיעוד בלבד (אין נגיעה ב-`services/mcp-server/**` — אין פריסה מחדש).
