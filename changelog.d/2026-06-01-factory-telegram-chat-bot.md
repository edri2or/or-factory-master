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
