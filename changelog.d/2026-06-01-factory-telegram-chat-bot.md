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
