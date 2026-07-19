# יישור-אמת של CLAUDE.md מול המצב החי (or-agents + /new-system)

ביקורת truth-protocol (אימות חי) מצאה כמה עובדות-עולם ב-CLAUDE.md שהתיישנו אחרי ש-or-agents עלתה לאוויר
ואחרי החזרת `/new-system`. תוקנו כדי לא להשאיר תיעוד שסותר את המצב האמיתי:

- **Header (blockquote):** נוסף caveat "2026-07-19" — היכולת הרזה `/new-system` הוחזרה במכוון (לא החייאת המכונה).
- **§Which connectors** — "the only Railway n8n instance is or-aios's" תוקן: כעת גם or-agents מריצה n8n חי משלה
  (`n8n-or-agents.or-infra.com`); העיקרון ש-**factory עצמו אין לו n8n** נשאר נכון.
- **§Connector ownership** — נוסף or-agents כאח שלישי חי (פרויקט + n8n משלו), **מחוץ להיקף סשן-factory**
  (סשן factory עדיין = `factory` + GitHub בלבד; הקונקטורים שלו שייכים לסשן-or-agents, כמו של or-aios).
- **§Workflows (live)** — `bootstrap-system-infra.yml` נוסף כ"Sibling-system builder (permanent)" — הפער היחיד
  שבו המנוע של `/new-system` היה מתועד ב-fold + Key files אך חסר מרשימת ה-workflows.

במקביל תוקן גם `or-agents/AGENTS.md` (ריפו נפרד): הוסר ה-drift של "טרם נפרס" (ה-runtime חי), והובהר
שה-n8n כבר מכיל 2 workflows-דמו של אתחול.
