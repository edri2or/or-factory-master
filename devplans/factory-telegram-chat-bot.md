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
| B+C | route נכנס + guardrails + CI | completed | `services/mcp-server/src/{telegram-chat.ts,telegram-chat-guards.ts,index.ts}`, `test/`, `playground-tests.yml` |
| D | פעולות-כתיבה מאושרות (HITL) | completed | `services/mcp-server/src/{telegram-chat.ts,telegram-chat-guards.ts}`, `test/` |
| E | תיעוד + עיגון ב-roadmap | completed | `docs/roadmap.md`, `docs/telegram-chat-bot-factory.md`, `CLAUDE.md` |
| F | הוכחה חיה (פריסה + סבב טלגרם אמיתי) | in-progress | `deploy-mcp-server.yml` (seed-step), פריסה (Or-gated) |

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
- [x] route חדש `/telegram-chat-webhook` ב-`index.ts` (mirror של `/telegram-webhook`): 503 אם הסוד לא מורכב,
      בדיקת `X-Telegram-Bot-Api-Secret-Token` ב-constant-time, תמיד 200.
- [x] `telegram-chat.ts`: allowlist על שולח, freshness (~120ש'), LLM read-only כברירת-מחדל,
      טקסט לא-מהימן (system prompt מוקשח, אין טוקן-אדמין עומד), קריאת OpenRouter (Haiku 4.5) עם
      function-calling על 6 כלים read-only קיימים (ריצות/jobs/לוג/מלאי/מכסה/probe), תשובה בעברית דרך טוקן בוט-הצ'אט.
- [x] job חדש ב-CI (צעד ב-"Playground tests") שמקמפל ובודק את ה-mcp-server (`npm ci` + `tsc` + `node --test`).
- [x] בדיקות יחידה לפונקציות ה-pure (freshness/allowlist/parse) ב-`test/telegram-chat-guards.test.mjs`. כל השערים ירוקים מקומית.

**הערת התקדמות אחרונה:** הושלם. הפרדתי את ה-guardrails ה-pure ל-`telegram-chat-guards.ts` (נבדק
הרמטית), והלוגיקה ב-`telegram-chat.ts` (LLM + 6 כלים read-only בלבד — מבני, לא רק prompt). ה-route
ב-`index.ts` עם בדיקת secret_token ב-constant-time. הוספתי צעד CI שמקמפל ובודק את ה-mcp-server (עד עכשיו
שום שער PR לא קימפל את ה-TS). 38 בדיקות עוברות; actionlint+yamllint+build ירוקים מקומית. הבוט עדיין רדום
(אין טוקן/מפתח אמיתיים) — נתחבר חי בשלב F.

**שינוי תוכנית:** במקום `telegram-chat.test.ts` בתוך `src/`, הבדיקות נכתבו כ-`test/telegram-chat-guards.test.mjs`
מול ה-`dist` המקומפל — לפי המוסכמה הקיימת בריפו (`test/*.test.mjs`), כי Node 22 מריץ גם `.test.ts` ישירות ונשבר.

**שינוי תוכנית:** —

---

### שלב D — פעולות-כתיבה מאושרות (HITL)

**Acceptance:**
- [x] הבוט יכול *לבקש* פעולה דרך כלי `request_action` — אף פעם לא מבצע ישירות (ה-dispatch קורה רק ב-callback אחרי ✅).
- [x] שולח ✅/❌ inline-keyboard בבוט-הצ'אט, state ב-`callback_data` (`cdo:<idx>`/`cno:<idx>`, <64 בתים), mirror של oil-approval.
- [x] ב-✅ משולח-מורשה → `dispatchWorkflow` על workflow מ-allowlist קבוע (parameterless, idempotent בלבד: watchdog / deploy-mcp), עורך את ההודעה עם התוצאה. שום דבר הרסני (decommission/provision לא נגישים לבוט).
- [x] build+unit-test ירוקים (40 בדיקות); מסלולי reject/לא-מורשה/callback-לא-תקין מכוסים.

**הערת התקדמות אחרונה:** הושלם. הוספתי כלי `request_action` (רק *שולח* בקשת אישור — לא מבצע),
ו-`handleChatCallback` שמבצע את ה-`dispatchWorkflow` רק אחרי ✅ ממשתמש מורשה. ה-LLM עדיין לא יכול לכתוב
ישירות (ה-dispatch לא נגיש מלולאת-הכלים — רק מה-callback ההומני). allowlist קבוע של 2 workflows בטוחים
ופרמטרלס. parser ה-callback ב-guards (pure, נבדק). 40 בדיקות עוברות; build ירוק.

**שינוי תוכנית:** במקום קידוד הפרמטרים המלאים ב-callback_data (חורג מ-64 בתים), v1 מוגבל ל-workflows
פרמטרלס מ-allowlist קבוע (אינדקס בלבד ב-callback) — state-free ובטוח ל-Cloud Run (אין אובדן בהחלפת instance).

---

### שלב E — תיעוד + עיגון ב-roadmap

**Acceptance:**
- [x] עדכון `docs/roadmap.md`: נוסף "Phase I" עם החלטת-העיגון (core על Cloud Run+Actions; n8n/Railway
      למערכות בלבד), ותוקנה השורה הישנה "factory-actions MCP — לא לבנות" שתשקף שה-MCP קיים ורץ ומארח את הבוט.
- [x] `docs/telegram-chat-bot-factory.md` חדש (ארכיטקטורה, סודות, guardrails, HITL, הפעלה). הערת MCP ב-`CLAUDE.md`.

**הערת התקדמות אחרונה:** הושלם. שלב תיעוד בלבד (אין קוד). עודכן ה-roadmap (Phase I + תיקון השורה הישנה),
נוצר מסמך עיצוב/סטטוס ייעודי, ונוספה שורה ל-`CLAUDE.md` על ה-endpoint החדש. נשאר רק שלב F — ההדלקה החיה.

**שינוי תוכנית:** —

---

### שלב F — הוכחה חיה (פריסה + סבב טלגרם אמיתי, Or-gated)

**Acceptance:**
- [x] קידום = merge ל-main (PR #263) → פריסה אוטומטית של `deploy-mcp-server.yml` הצליחה.
- [x] אימות חי בפרודקשן: `/health`=200; POST ל-`/telegram-chat-webhook` בלי secret-token → `401` (ה-route חי
      ומוגן); מפתח ה-LLM (OpenRouter) נטבע אמיתי (`http=201`); ה-chat setWebhook דילג כצפוי (בוט רדום).
- [x] מנגנון הפעלה מאובטח: נוסף seed-step ל-`deploy-mcp-server.yml` (קורא GH-secret `FACTORY_TG_CHAT_BOT_TOKEN`
      ממוסך + input `chat_allowlist`), כך ש-Or לא נוגע בטרמינל ושום סוד לא נרשם בלוג.
- [ ] **נותר:** Or יוצר בוט ב-@BotFather, מזין את הטוקן ל-GH-secret + נותן id; dispatch deploy עם `chat_allowlist`;
      **סבב טלגרם אמיתי** (Or שואל → תשובה מודעת-פקטורי) + פעולת HITL ✅ אחת. ואז `status: completed`.

**הערת התקדמות אחרונה:** הקוד קודם ל-main ונפרס; אומת חי בפרודקשן (route מוגן 401, LLM מחובר). הוספתי
מנגנון הפעלה מאובטח (seed-step ב-deploy). נותרה רק יצירת הבוט ע"י Or + ההזנה, ואז סבב חי.

**שינוי תוכנית:** הפעלת הבוט נעשית דרך seed-step ב-`deploy-mcp-server.yml` (GH-secret לטוקן + dispatch-input
ל-allowlist) במקום כתיבה ידנית ל-SM — כדי שיהיה MCP-dispatchable ובלי פעולת-טרמינל של Or ובלי סוד בלוגים.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב A הושלם — הכנו לפקטורי "תעודת זהות" לבוט-צ'אט חדש ונפרד: 4 מפתחות סודיים והחיווט שלהם לשרת, בלי לשנות עדיין שום התנהגות (הבוט עוד ישן).
- שלב B+C הושלם — כתבנו את "המוח" של הבוט: הוא מקבל הודעה, מוודא שזה אתה ושההודעה טרייה, מפעיל AI עם כלים *לקריאה בלבד* ועונה בעברית. הוספנו גם בדיקות אוטומטיות שמוודאות שהקוד תקין. הבוט עדיין לא דובר — נחבר אותו חי בסוף.
- שלב D הושלם — עכשיו הבוט יכול גם לבקש *פעולה* (כמו "תריץ ניטור עכשיו" או "פרוס מחדש"), אבל רק כשאתה מאשר ב-✅ בטלגרם. בלי אישור — שום דבר לא רץ. הרשימה מוגבלת לשתי פעולות בטוחות בלבד, שום דבר הרסני.
- שלב E הושלם — עדכנו את התיעוד: ה-roadmap משקף עכשיו שהבוט קיים ושה-core נשאר על הבית שלו (Cloud Run), וכתבנו מסמך קצר שמסביר איך הבוט עובד. בלי קוד.
