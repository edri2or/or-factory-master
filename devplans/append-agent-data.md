---
dev_name: כלי-שער append_agent_data — אוטונומיית כתיבת-דאטה לסוכני or-agents
slug: append-agent-data
opened: 2026-07-21
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — כלי-שער `append_agent_data`

## מטרה

סוכן or-agents (למשל דפנה) שמצהיר `data_capture: כן` צריך לכתוב שורת-לוג לקבצי-הדאטה שלו, אבל
על משטח מנוהל (claude.ai/Cowork) יש לו רק קריאת-ריפו. מוסיפים כלי-MCP כללי `append_agent_data`
לשער — כותב שורה ל-`agents/<agent>/data/<file>` בענף לא-מוגן `agent-data` של or-agents, עם טוקן
broker מוגבל-לריפו server-side ו-path-allowlist. main נשאר נעול. יכולת לכל סוכן, לא רק דפנה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כלי `append_agent_data` + עוזרים + בדיקות | completed | services/mcp-server/src/agent-data.ts · github-client.ts · tools.ts · test/agent-data-path.test.mjs |
| 2 | פריסת השער (deploy-mcp-server) | pending | (deploy — באישור-Or) |
| 3 | אימות-חי (append נוחת בענף agent-data) | pending | (הוכחה חיה) |

> **הוכחה בכל שלב:** שלב 1 = `npm test` ירוק + הליבה טהורה בדוקה. שלב 3 = append חי דרך הכלי
> שנוחת בענף `agent-data` של or-agents, ו-main לא נגע.

---

### שלב 1 — כלי + עוזרים + בדיקות

**Acceptance:**
- [x] `append_agent_data` רשום ב-`registerTools` (משטח `/mcp`); path מורכב server-side, allowlist דוחה traversal.
- [x] עוזרי github-client (`brokerContentsToken`/`getRepoFileWithSha`/`putRepoFile`/`ensureBranch`) — טוקן broker מוגבל לריפו + contents:write.
- [x] בדיקות-יחידה ל-allowlist + append; `npm test` ירוק (136/136).

**הוכחה תפקודית (באותו שלב):** `npm test` = 136/136 (4 חדשות ב-`agent-data-path.test.mjs`); tsc עובר; `secret-scan` ירוק (אין טוקן בקוד).

**הוכחת E2E (artifact):** לא-התנהגותי (אין נגיעה ב-`workflows/n8n/*.json` או `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם — נבנה ונבדק מקומית.

**שינוי תוכנית:** —

---

### שלב 2 — פריסה

**Acceptance:**
- [ ] מיזוג ל-main → `deploy-mcp-server.yml` מפרס את השער (באישור-Or; רדיוס כולל or-aios).

**הוכחה תפקודית (באותו שלב):** הכלי מופיע ב-`/mcp` אחרי הפריסה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — אימות-חי

**Acceptance:**
- [ ] append דרך הכלי → שורה נחתה בענף `agent-data` של or-agents; main לא נגע; path-lock דוחה כתיבה מחוץ ל-`data/`.

**הוכחה תפקודית (באותו שלב):** קריאת-כלי חיה שמסתיימת בשורה בענף `agent-data`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — נבנה כלי-השער שנותן לכל סוכן לכתוב שורת-דאטה לקובץ שלו, נעול-לתיקיית-הדאטה, ל-main לא נוגעים. הבדיקות ירוקות.
