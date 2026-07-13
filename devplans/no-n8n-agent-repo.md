---
dev_name: מערכת בלי n8n — ריפו-סוכן or-edri-agent
slug: no-n8n-agent-repo
opened: 2026-07-13
status: completed   # פעולה חד-פעמית שהושלמה ואומתה; אין שער E2E (אין קבצי-התנהגות/n8n)
---

# תוכנית פיתוח — מערכת בלי n8n (ריפו-סוכן)

## מטרה

Or ביקש להקים מערכת חדשה **בלי שום n8n** (ובלי אזכור אליו), **בלי לגעת בפקטורי עצמו**.
מחקר הראה שמוצר ה-"system" הרגיל של הפקטורי הוא מהותית מכונת n8n (n8n מוזכר ב-96 קבצים /
1,347 פעמים ב-`templates/system/`) — אין "מערכת רגילה בלי n8n". אבל לפקטורי כבר יש מוצר שני
נטול-n8n: ה-**agent-repo** (`docs/agent-repo-product.md`) — ריפו פרטי שקלוד-קוד מפעיל, בלי
GCP project / Railway / Caddy / n8n. Or בחר בכיוון הזה.

**התוצאה:** ריפו-סוכן חדש `edri2or/or-edri-agent`, נטול-n8n לחלוטין, בלי שינוי בקוד/בתבניות
של הפקטורי.

## מה נעשה (מאומת)

| # | פעולה | סטטוס | תוצאה מאומתת |
|---|---|---|---|
| 1 | הקמת ריפו-סוכן | completed | `provision-agent-repo.yml` ריצה [29270901504](https://github.com/edri2or/or-factory-master/actions/runs/29270901504) → success. `edri2or/or-edri-agent` נוצר, private, עם 4 קבצים: `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, `.github/workflows/agent-main.yml`. |
| 2 | ניקוי אזכורי n8n מ-AGENTS.md (רק בריפו החדש) | completed | דפוס custom-persona: `refresh-agent-repo.yml` ריצה [29271910548](https://github.com/edri2or/or-factory-master/actions/runs/29271910548) → success דחף גרסת AGENTS.md נקייה ל-`or-edri-agent:main`. אומת: 0 מופעים של "n8n" בכל 4 הקבצים. |

## הוכחה תפקודית (באותו שלב)

תוכן/תשתית בלבד — אין קבצי-התנהגות של בוט ואין n8n, לכן **לא-התנהגותי** (אין שער E2E).
האימות הוא קריאה ישירה של קבצי הריפו דרך כלי הקריאה הארגוני של הפקטורי:
- `get_repo edri2or/or-edri-agent` → קיים, `private: true`.
- קריאת 4 הקבצים → תקינים; חיפוש "n8n" → **0 מופעים**.

## שמירה על "בלי לגעת בפקטורי"

- לא שונו `templates/system/**`, `provision-system.yml`, או קוד/וורקפלו של הפקטורי.
- תבנית ה-agent-repo במיין (`templates/agent-repo/AGENTS.md.template`) והגולדן — **ללא שינוי**.
- הניקוי נעשה בדפוס ה-custom-persona המוסמך: קובץ-מקור זמני (`templates/agent-repo/AGENTS.md`)
  הוצב על ענף הפיתוח לצורך ה-refresh בלבד, ו**הוסר לפני פתיחת ה-PR** — כך ש-diff ה-PR מכיל
  אך ורק את קובץ התיעוד הזה. השינוי-נטו על תבנית הפקטורי = אפס.
- ה-`.mcp.json` של הריפו החדש מצביע רק על ה-MCP הקריא של הפקטורי (`/mcp`), בלי `n8n-live`.

## יומן ל-Or (עברית)

- הוקמה מערכת חדשה מסוג "ריפו-סוכן" בשם `or-edri-agent` — נקייה לגמרי מ-n8n, בלי שום נגיעה
  בפקטורי. זה ריפו פרטי שקלוד-קוד מפעיל דרך הברוקר המרכזי.
