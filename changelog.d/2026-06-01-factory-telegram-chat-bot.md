### בוט טלגרם דו-כיווני לפקטורי עצמו (dogfooding של Phase F)

- **שלב A — זהות בוט-צ'אט + secrets (תשתית, רדום).** `deploy-mcp-server.yml` קיבל מינטינג של
  ארבעה סודות חדשים ל-SM של `or-factory-master-control`, בדפוס הקיים של
  `telegram-approval-webhook-secret`: `factory-telegram-chat-bot-token` (placeholder
  `__NOT_CONFIGURED__` — טוקן @BotFather שהמפעיל מזין מבחוץ; הבוט **רדום** עד אז),
  `factory-telegram-chat-webhook-secret` (אקראי `openssl rand -hex 32` — ה-secret_token
  של `setWebhook`), `factory-telegram-chat-allowlist` (placeholder — CSV של מזהי-טלגרם
  מורשים, סגור-כברירת-מחדל), ו-`factory-telegram-chat-openrouter-key` (נטבע מ-
  `openrouter-management-key` כמו ב-`eval-agent-router.yml`, עם נפילה ל-placeholder אם
  המפתח-מנהל חסר או הטביעה נכשלת — כך שהפריסה לעולם לא נופלת). ארבעתם מורכבים ל-Cloud Run
  כ-env (`FACTORY_TG_CHAT_BOT_TOKEN`/`_WEBHOOK_SECRET`/`_ALLOWLIST`/`_OPENROUTER_KEY`),
  ונוסף `FACTORY_TG_CHAT_MODEL=anthropic/claude-haiku-4.5`. נוסף צעד `setWebhook` נפרד
  (soft-fail) שמכוון את **בוט-הצ'אט** (נפרד מבוט-ההתראות, שיכול להחזיק רק webhook אחד)
  ל-`/telegram-chat-webhook` עם `allowed_updates:["message","callback_query"]`; הוא מדלג
  בשקט כל עוד הטוקן הוא placeholder. אפס שינוי-התנהגות — שום קוד עוד לא קורא את הסודות.
- **שלב B+C — route נכנס + guardrails + CI.** נוסף ל-`services/mcp-server` הלב של הבוט:
  `telegram-chat-guards.ts` (פונקציות pure, נטולות תלויות כבדות — allowlist/freshness/parse —
  כדי שייבדקו הרמטית), ו-`telegram-chat.ts` (הלוגיקה). ה-route `/telegram-chat-webhook` ב-
  `index.ts` ממראה את `/telegram-webhook` הקיים: 503 אם הסוד לא מורכב, בדיקת
  `X-Telegram-Bot-Api-Secret-Token` ב-constant-time, ותמיד 200 (התשובה נשלחת חזרה ב-sendMessage
  נפרד). **Guardrails (החלטה 5):** allowlist על שולח (`FACTORY_TG_CHAT_ALLOWLIST`), חלון
  טריות ~120ש' נגד replay, וקריאת OpenRouter (Haiku 4.5) עם **6 כלים read-only בלבד**
  (ריצות-workflow אחרונות, jobs של ריצה, קריאת לוג-job, מלאי-מערכות, מכסת-פרויקטים, probe ל-
  endpoint) — הקריאה-בלבד מובטחת *מבנית* (אף פונקציית כתיבה/dispatch לא מיובאת למודול), לא רק
  ב-prompt. ה-system-prompt מוקשח: טקסט-כלי/התראה הוא קלט לא-מהימן, אין חשיפת שמות-כלים/סודות,
  אין טוקן-אדמין עומד. עיבוד סינכרוני חסום (≤4 סבבי-כלים, 45ש'/קריאה) כי Cloud Run מקצה CPU רק
  בזמן בקשה. **שער CI חדש:** צעד "MCP server build + unit tests" ב-job "Playground tests" מריץ
  `npm ci` + `tsc` + `node --test` — עד עכשיו שום שער PR לא קימפל את ה-TS (רק ה-Docker build בפריסה).
  בדיקות יחידה ל-guardrails ב-`test/telegram-chat-guards.test.mjs` (מוסכמת ה-`.mjs`-מול-`dist` הקיימת).
  הבוט נשאר רדום עד שמוזנים טוקן+מפתח אמיתיים (שלב F).
- **שלב D — פעולות-כתיבה מאושרות (HITL).** הבוט יכול עכשיו *לבקש* פעולה דרך כלי `request_action`,
  אבל **לעולם לא מבצע אותה בעצמו**: הכלי רק שולח ל-Or הודעת ✅/❌ בטלגרם, וה-`dispatchWorkflow`
  קורה רק ב-`handleChatCallback` אחרי ✅ ממשתמש מורשה — לולאת-ה-LLM לא יכולה לכתוב ישירות (אותה
  invariant של OIL: AI מציע, אדם מאשר). ה-state חי כולו ב-`callback_data` (`cdo:<idx>`/`cno:<idx>`,
  מתחת ל-64 בתים), אז החלפת instance ב-Cloud Run לא מאבדת אישור ממתין. ה-allowlist קבוע ומכוון
  לשני workflows בטוחים, פרמטרלס ו-idempotent בלבד (`meta-monitoring-watchdog.yml`,
  `deploy-mcp-server.yml`); שום דבר הרסני (`decommission`/`provision`) אינו נגיש לבוט. ה-parser של
  ה-callback (`parseActionCallback`) ב-`telegram-chat-guards.ts` (pure, נבדק). 40 בדיקות יחידה עוברות.
- **שלב E — תיעוד + עיגון.** `docs/roadmap.md` קיבל "Phase I" שמתעד את הבוט ואת **החלטת-העיגון**
  (ה-core נשאר על Cloud Run + Actions; n8n/Railway למערכות-בנות בלבד — הימנעות מ-circular-dependency),
  והשורה הישנה "factory-actions MCP — לא לבנות" תוקנה: ה-MCP קיים ורץ ומארח את הגשר-OIL ואת הבוט;
  מה שנמנע הוא רק *משטח-כתיבה רחב* (כתיבה נשארת human-gated ו-allow-listed). נוסף מסמך ייעודי
  `docs/telegram-chat-bot-factory.md` (ארכיטקטורה, סודות, guardrails, HITL, הפעלה), ושורת-הסבר ב-`CLAUDE.md`.
- **שלב F — הפעלה חיה (מנגנון).** `deploy-mcp-server.yml` קיבל **seed-step** + input `chat_allowlist`
  שמאפשרים הפעלת הבוט בלי פעולת-טרמינל של Or ובלי סוד בלוגים: טוקן-הבוט מגיע כ-GitHub Actions secret
  ממוסך (`FACTORY_TG_CHAT_BOT_TOKEN`) ונכתב ל-`factory-telegram-chat-bot-token`; ה-allowlist מגיע
  כ-dispatch-input מאומת (CSV מספרי, ממראה את `set-oil-allowlist.yml`) ונכתב ל-`factory-telegram-chat-allowlist`
  — שניהם רצים *לפני* הפריסה כך ש-`:latest` נטען ו-`setWebhook` מפעיל את הבוט. no-op בטוח כששניהם ריקים.
  הקוד כבר קודם ונפרס; אומת חי (route מוגן `401`, מפתח-LLM נטבע). נותר רק ש-Or ייצור בוט ב-@BotFather.
