# כלי-שער חדש `append_agent_data` — אוטונומיית כתיבת-דאטה לסוכני or-agents

סוכן or-agents עם `data_capture: כן` צריך לכתוב שורת-לוג לקבצי-הדאטה שלו, אבל על משטח מנוהל
(claude.ai/Cowork) יש לו רק **קריאת-ריפו** — בלי מסלול-כתיבה, ולכן `data_capture` לא היה ניתן
למימוש שם (התגלה באימות-חי של סוכן `gmail`/דפנה, 2026-07-21). מחקר-עומק אישר שהמסלול הנכון הוא
דרך השער-המשותף (or-agents תוכננה לחלוק את ה-backbone), לא שירות עצמאי.

**התוספת:** כלי-MCP חדש `append_agent_data` על משטח `/mcp` של השער — יכולת **כללית לכל סוכן**
(לא ייעודית לדפנה):

- **`services/mcp-server/src/agent-data.ts`** (חדש) — הלפרים טהורים `buildAgentDataPath(agent, file)`
  (מרכיב server-side את `agents/<agent>/data/<file>`; regex-allowlist שדוחה `../`/absolute/רב-מקטע —
  ה-slash מוכנס רק כאן, בין טוקנים מאומתים) ו-`composeAppendedContent(base, row)` (append עם
  newline יחיד מפריד + trailing). ליבת-האבטחה טהורה ובדוקת-יחידה במלואה.
- **`services/mcp-server/src/github-client.ts`** — עוזרי-רשת חדשים (exported): `brokerContentsToken(repo)`
  (מנצל `repoScopedToken` → טוקן broker מוגבל לריפו-אחד + `contents:write` בלבד, server-side),
  `getRepoFileWithSha` / `putRepoFile` (Contents API) / `ensureBranch` (יוצר ענף מ-head של main אם חסר,
  idempotent). כולם מנצלים את `ghFetchRepoAs` הקיים.
- **`services/mcp-server/src/tools.ts`** — הכלי `append_agent_data({agent, file, row})`: path-allowlist →
  `ensureBranch` → לולאת GET-sha→append→PUT עם retry על 409, לענף **`agent-data`** לא-מוגן של
  `edri2or/or-agents`. **main נשאר נעול לגמרי**; הטוקן server-side (המודל לא רואה אותו).
- **`test/agent-data-path.test.mjs`** (חדש) — בדיקות-יחידה ל-allowlist (מקבל `agents/gmail/data/log.md`;
  דוחה traversal/slash/absolute/dotfile/שם-סוכן-לא-חוקי) ולוגיקת-ה-append.

הליבה זהה לכל סוכן: path-allowlist ל-`agents/<agent>/data/`. `secret-scan` ירוק (אין טוקן בקוד).
בדיקות: `npm test` ירוק (136/136, כולל 4 החדשות). פריסה: מיזוג ל-main → `deploy-mcp-server.yml`
אוטומטי (רדיוס כולל or-aios — deploy באישור-Or).
