---
dev_name: בוט טלגרם דו-כיווני לפקטורי
slug: factory-telegram-chat-bot
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — בוט טלגרם דו-כיווני לפקטורי

## מטרה

היום הפקטורי רק *שולח* התראות בטלגרם. הפיתוח הזה נותן לפקטורי בוט-צ'אט דו-כיווני: Or יוכל
*לשאול* את הבוט על התראה שקיבל ("מה קרה? למה זה נדלק?") ולקבל תשובה אמיתית, מודעת-מערכת, בעברית —
כולל פעולות-כתיבה מאושרות ב-✅/❌. זהו dogfooding: מה שכבר קיים במערכות-הבנות (Phase F), מותאם
לכך שה-core של הפקטורי רץ על Cloud Run + GitHub Actions (שרת ה-MCP ב-`services/mcp-server`),
לא על n8n. ה-core **לא** עובר ל-n8n/Railway. בלוק ה-self-healing (E–F בהאנד-אוף) הוא פיתוח נפרד אחר כך.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| A | זהות בוט-צ'אט + secrets (תשתית, רדום) | completed | `.github/workflows/deploy-mcp-server.yml` |
| B+C | route נכנס + guardrails + CI | pending | `services/mcp-server/src/{telegram-chat.ts,index.ts,telegram-chat.test.ts}`, CI workflow |
| D | פעולות-כתיבה מאושרות (HITL) | pending | `services/mcp-server/src/telegram-chat.ts`, `index.ts` |
| E | תיעוד + עיגון ב-roadmap | pending | `docs/roadmap.md`, `docs/telegram-chat-bot-factory.md` |
| F | הוכחה חיה (פריסה + סבב טלגרם אמיתי) | pending | פריסת `deploy-mcp-server.yml` (Or-gated) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב A — זהות בוט-צ'אט + secrets (תשתית, רדום)

**Acceptance:**
- [x] מינטינג של 4 secrets ב-`deploy-mcp-server.yml` (mirror של `telegram-approval-webhook-secret`):
      `factory-telegram-chat-bot-token` (placeholder), `factory-telegram-chat-webhook-secret` (random),
      `factory-telegram-chat-allowlist` (placeholder), `factory-telegram-chat-openrouter-key` (מ-management-key).
- [x] הרכבה (mount) של ה-4 כ-env vars ל-Cloud Run + `FACTORY_TG_CHAT_MODEL` ברירת-מחדל `anthropic/claude-haiku-4.5`.
- [x] צעד `setWebhook` לבוט-הצ'אט (mirror), מצביע ל-`/telegram-chat-webhook`, soft-fail, רדום עד שלב B.
- [x] yamllint/actionlint ירוקים; אפס שינוי-התנהגות (שום קוד עוד לא קורא את אלה).

**הערת התקדמות אחרונה:** הושלם. הוספתי ל-`deploy-mcp-server.yml` מינטינג של 4 הסודות (בוט-טוקן +
allowlist כ-placeholders, webhook-secret אקראי, מפתח-OpenRouter מ-management-key עם נפילה ל-placeholder),
הרכבה ל-Cloud Run + env למודל, וצעד `setWebhook` נפרד לבוט-הצ'אט. yamllint + actionlint(+shellcheck) ירוקים מקומית.
התשתית רדומה לגמרי — שום קוד עוד לא קורא את הסודות (זה מגיע בשלב B).

**שינוי תוכנית:** —

---

### שלב B+C — route נכנס + guardrails + CI (הלב)

**Acceptance:**
- [ ] route חדש `/telegram-chat-webhook` ב-`index.ts` (mirror של `/telegram-webhook`): 503 אם הסוד לא מורכב,
      בדיקת `X-Telegram-Bot-Api-Secret-Token` ב-constant-time, תמיד 200.
- [ ] `telegram-chat.ts`: allowlist על שולח, freshness (~120ש'), LLM read-only כברירת-מחדל,
      טקסט לא-מהימן (system prompt מוקשח, אין טוקן-אדמין עומד), קריאת OpenRouter (Haiku 4.5) עם
      function-calling על קבוצת כלים read-only קיימת, תשובה בעברית דרך טוקן בוט-הצ'אט.
- [ ] job חדש ב-CI שמקמפל ובודק את ה-mcp-server (`tsc` + `node --test`), path-filtered ל-`services/mcp-server/**`.
- [ ] בדיקות יחידה לפונקציות ה-pure (freshness/allowlist/parse). ה-job החדש ירוק; שאר השערים ירוקים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב D — פעולות-כתיבה מאושרות (HITL)

**Acceptance:**
- [ ] הבוט יכול *לבקש* פעולת-כתיבה (למשל `dispatch_workflow` מהallowlist הקיים) — אף פעם לא מבצע ישירות.
- [ ] שולח ✅/❌ inline-keyboard, state ב-`callback_data` (`chatdo:<id>`, <64 בתים), mirror של oil-approval.
- [ ] ב-✅ משולח-מורשה → מבצע פעולה תחומה, עורך את ההודעה עם התוצאה. אין הרחבת גבולות ה-fixer.
- [ ] build+unit-test ירוקים; מסלולי reject/ישן/לא-מורשה מכוסים בבדיקות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב E — תיעוד + עיגון ב-roadmap

**Acceptance:**
- [ ] עדכון `docs/roadmap.md`: תיקון השורה הישנה "factory-actions MCP — לא לבנות" שתשקף שה-MCP קיים
      ורץ ומארח עכשיו את הבוט הדו-כיווני; תיעוד החלטת-העיגון (core על Cloud Run+Actions; n8n/Railway למערכות בלבד).
- [ ] `docs/telegram-chat-bot-factory.md` חדש (סטטוס + עיצוב). שערי changelog/devplan ירוקים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב F — הוכחה חיה (פריסה + סבב טלגרם אמיתי, Or-gated)

**Acceptance:**
- [ ] באישור Or: dispatch `deploy-mcp-server.yml` (מינטינג + mount + setWebhook לבוט-הצ'אט).
- [ ] הזנת טוקן בוט-צ'אט אמיתי (מ-@BotFather) + ה-id של Or ל-`factory-telegram-chat-allowlist`, פריסה מחדש.
- [ ] poll לריצה (פרוטוקול ה-MCP), `/health`=200, ואז **סבב טלגרם אמיתי**: Or שואל → תשובה מודעת-פקטורי
      בעברית; פעולת HITL ✅ אחת מקצה-לקצה. iterate fix→redeploy→verify עד ירוק.
- [ ] קידום = merge ל-main; הצבת `status: completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב A הושלם — הכנו לפקטורי "תעודת זהות" לבוט-צ'אט חדש ונפרד: 4 מפתחות סודיים והחיווט שלהם לשרת, בלי לשנות עדיין שום התנהגות (הבוט עוד ישן).
