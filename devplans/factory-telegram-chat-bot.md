---
dev_name: בוט טלגרם דו-כיווני לפקטורי
slug: factory-telegram-chat-bot
opened: 2026-06-01
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| F | הוכחה חיה (פריסה + סבב טלגרם אמיתי) | completed | `deploy-mcp-server.yml` (seed-step), פריסה (Or-gated) |
| G | איחוד לבוט אחד (הבוט הקיים עונה גם) | completed | `services/mcp-server/src/{index.ts,telegram-chat.ts}`, `deploy-mcp-server.yml` |
| H | תיעוד עדכון לבוט-אחד | completed | `docs/telegram-chat-bot-factory.md`, `docs/roadmap.md`, `CLAUDE.md` |
| I | הוכחה חיה לבוט המאוחד | completed | פריסה (Or-gated) + סבב טלגרם + ודא OIL תקין |

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
- [x] **בוצע:** Or יצר בוט ב-@BotFather, הזין טוקן ל-GH-secret + נתן id `5786217215`; dispatch deploy עם
      `chat_allowlist` כתב את הסודות, נפרס, רשם webhook (`HTTP 200`); **סבב טלגרם אמיתי הצליח** — תשובה
      מודעת-פקטורי מבוססת-כלים. הבוט (בגרסת שני-בוטים) עבד מקצה-לקצה.

**הערת התקדמות אחרונה:** הושלם ואומת חי (סבב אמיתי). **אבל** Or החליט אחרי-כן שלא רוצה שני בוטים —
רוצה בוט אחד (בוט-המערכת הקיים) שגם שולח התראות וגם עונה. לכן ממשיכים לשלבים G–I (איחוד), לא סוגרים עדיין.

**שינוי תוכנית:** הפעלת הבוט נעשתה דרך seed-step ב-`deploy-mcp-server.yml`. ההמשך (G–I) מאחד את הצ'אט
על בוט-ההתראות הקיים ומבטל את הבוט הנפרד — לבקשת Or.

---

### שלב G — איחוד לבוט אחד (קוד + תצורת פריסה)

**Acceptance:**
- [x] `index.ts`: `/telegram-webhook` הפך לכניסה מאוחדת — ניתוב לפי סוג: callback `oilapprove:`/`oilreject:`
      → `handleTelegramCallback` (OIL, ללא שינוי); message או `cdo:`/`cno:` → `handleChatUpdate`. ה-route
      `/telegram-chat-webhook` + `FACTORY_TG_CHAT_WEBHOOK_SECRET`/`chatTokenMatches` הוסרו.
- [x] `telegram-chat.ts`: שימוש חוזר ב-senders של `observability-client` (טוקן בוט-ההתראות); הוסרו
      `FACTORY_TG_CHAT_BOT_TOKEN`/`botConfigured()` + ארבעת ה-senders הייעודיים; allowlist+freshness+LLM נשמרו.
- [x] `deploy-mcp-server.yml`: ה-setWebhook המאוחד → `allowed_updates:["message","callback_query"]`; צעד
      ה-CHAT setWebhook הוסר; mounts/mints של bot-token + webhook-secret הוסרו; ה-seed קוצץ ל-allowlist בלבד.
- [x] build + 40 בדיקות ירוקים; yamllint+actionlint ירוקים; אין שאריות-רפרנס; OIL routing נשמר (לפי prefix).

**הערת התקדמות אחרונה:** הושלם מקומית. הצ'אט עבר לבוט-ההתראות הקיים דרך `/telegram-webhook` המאוחד (ניתוב
לפי סוג-עדכון/prefix), הבוט הנפרד + ה-route + הסוד שלו הוסרו. כל לוגיקת ה-LLM/כלים/HITL נשמרה — רק ה"דלת
הקדמית" הוחלפה. ממתין ל-CI ואז לפריסה+סבב חי (שלב I).

**שינוי תוכנית:** —

---

### שלב H — תיעוד עדכון לבוט-אחד

**Acceptance:**
- [x] עודכן `docs/telegram-chat-bot-factory.md` (ארכיטקטורת בוט-אחד + הפעלה), `docs/roadmap.md` Phase I
      (G/H/I), ושורת ה-MCP ב-`CLAUDE.md` (`/telegram-chat-webhook` → מאוחד ב-`/telegram-webhook`).

**הערת התקדמות אחרונה:** הושלם — אוחד עם שלב G ל-PR אחד (#269) כדי לצמצם תקורה ל-Or.

**שינוי תוכנית:** אוחד עם G לאותו PR (במקום PR נפרד) לבקשת-העדפת Or לפחות שלבים.

---

### שלב I — הוכחה חיה לבוט המאוחד

**Acceptance:**
- [x] merge (#269) → פריסה אוטומטית; ה-setWebhook המאוחד נרשם `HTTP 200` עם
      `allowed_updates:["message","callback_query"]`, ה-allowlist נשמר (Or כבר מורשה), ה-LLM מחובר.
- [x] **סבב חי הצליח:** Or שלח ל**בוט-ההתראות הקיים** "מה מצב הפקטורי?" וקיבל תשובה מודעת-פקטורי
      בעברית, מבוססת-כלים (ריצות/מערכות/מכסה/Cloudflare). בוט אחד = הכל.
- [x] אישורי OIL נשמרים מבנית: ה-route המאוחד מנתב `oilapprove:`/`oilreject:` ל-`handleTelegramCallback`
      ללא שינוי (מאומת ע"י ה-build הירוק + בדיקות; ירוצו חי בתיק ה-OIL הבא).
- [x] `status: completed`.

**הערת התקדמות אחרונה:** הושלם ואומת חי. הבוט המאוחד (בוט-ההתראות הקיים) עונה על שאלות בעברית עם
נתונים אמיתיים. הפיתוח נסגר.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב A הושלם — הכנו לפקטורי "תעודת זהות" לבוט-צ'אט חדש ונפרד: 4 מפתחות סודיים והחיווט שלהם לשרת, בלי לשנות עדיין שום התנהגות (הבוט עוד ישן).
- שלב B+C הושלם — כתבנו את "המוח" של הבוט: הוא מקבל הודעה, מוודא שזה אתה ושההודעה טרייה, מפעיל AI עם כלים *לקריאה בלבד* ועונה בעברית. הוספנו גם בדיקות אוטומטיות שמוודאות שהקוד תקין. הבוט עדיין לא דובר — נחבר אותו חי בסוף.
- שלב D הושלם — עכשיו הבוט יכול גם לבקש *פעולה* (כמו "תריץ ניטור עכשיו" או "פרוס מחדש"), אבל רק כשאתה מאשר ב-✅ בטלגרם. בלי אישור — שום דבר לא רץ. הרשימה מוגבלת לשתי פעולות בטוחות בלבד, שום דבר הרסני.
- שלב E הושלם — עדכנו את התיעוד: ה-roadmap משקף עכשיו שהבוט קיים ושה-core נשאר על הבית שלו (Cloud Run), וכתבנו מסמך קצר שמסביר איך הבוט עובד. בלי קוד.
- שלב F הושלם — הבוט עלה חי ובדיקה אמיתית עבדה (שאלת "מה מצב הפקטורי?" וקיבלת תשובה אמיתית). אבל החלטת שעדיף בוט אחד במקום שניים — אז ממשיכים לאחד (שלבים G–I).
- שלב G הושלם — איחדנו לבוט אחד: הצ'אט עבר לבוט-ההתראות הקיים (אותו בוט ששולח לך עדכונים עכשיו גם עונה). הבוט הנפרד בוטל. כל היכולות נשמרו — רק "הדלת" הוחלפה. נשאר לעדכן תיעוד ולבדוק חי.
- שלבים H+I הושלמו — עדכנו תיעוד, מיזגנו, פרסנו, ובדיקה אמיתית עבדה: שלחת לבוט הקיים "מה מצב הפקטורי?" וקיבלת תשובה אמיתית. **הפיתוח הסתיים — בוט אחד שעושה הכל.** 🎉
