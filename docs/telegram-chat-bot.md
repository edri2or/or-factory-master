# Telegram Chat Bot — בוט שיחה חכם לכל מערכת

מסמך זה מתאר את בוט השיחה בטלגרם שכל מערכת חדשה מקבלת (Phase F). הבוט הופך את טוקן
הטלגרם שכבר קיים בכל מערכת לסוכן שיחה חכם שמכיר את המערכת — בלי לגעת ב-classifier
וב-Macro-F1 gate של ה-Agent Router הקיים.

> **סטטוס v1.** המסמך מתאר את מה ש**מותקן ופעיל** היום, ומה **נדחה ל-follow-up** (סעיף 6).
> ה-v1 אומת מקצה-לקצה על מערכת test (טלגרם → תשובה אמיתית עם נתוני מערכת חיים).

## 1. מטרה

לכל מערכת יש כבר בוט טלגרם, אבל עד עכשיו הוא שימש **רק להתראות יוצאות**
(`scripts/emit-event.sh`). Phase F סוגר את הפער היחיד — **קליטת הודעות נכנסות** —
ומחבר אותן ל-Agent Router הקיים, כך שהמשתמש מקבל בוט שמבין שפה טבעית, עונה תשובות
חכמות (כמו ChatGPT/Gemini), ויודע לשלוף נתונים חיים על המערכת שהוא חי בתוכה.

## 2. ארכיטקטורת שני הבוטים (חשוב)

יש **שני בוטים נפרדים פיזית** בטלגרם, ששניהם מדברים עם אותו chat:

| בוט | טוקן (SM) | תפקיד | מי משתמש |
|---|---|---|---|
| 🤖 **בוט השיחה** | `n8n-telegram-bot-token` (per-system) | דו-כיווני: עונה לשאלות, מכיר את המערכת | `tg-inbound` ב-n8n |
| 🟡/🔴 **בוט ההתראות** | `telegram-bot-token` (bulk-copied) | חד-כיווני: שגיאות/אזהרות מערכת | `scripts/emit-event.sh` |

**chat_id משותף.** בצ'אט פרטי `chat_id == user_id`, וזה אותו אדם מול שני הבוטים, לכן
שני הבוטים משתמשים באותו ערך. `provision-system.yml` זורע את `n8n-telegram-chat-id`
מ-`telegram-chat-id` הקיים, כך שאין צורך בסוד chat-id חדש.

## 3. הזרימה הנכנסת (v1)

```
משתמש כותב לבוט השיחה
        ↓ (Telegram setWebhook עם secret_token)
https://n8n-<system>.or-infra.com/webhook/telegram-in/inbound
        ↓
Caddy (gateway):
  @telegram_authed = path /webhook/telegram-in/*  +  header
    X-Telegram-Bot-Api-Secret-Token == {$N8N_TELEGRAM_WEBHOOK_SECRET}
  → reverse_proxy → n8n   (פטור מ-HMAC; header שגוי/חסר → 401)
        ↓
n8n workflow: tg-inbound
  • Webhook node (path telegram-in/inbound)
  • Extract & Normalize — message/callback/edited → טקסט אחיד
    + סינון chat_id (רק המפעיל; כל אחד אחר נזרק)
  • Call Agent Router — POST פנימי ל-http://localhost:5678/webhook/agent-router
    (עוקף את Caddy; הקריאה דרך הדומיין הציבורי הייתה נחסמת ב-HMAC → 401)
        ↓
Agent Router הקיים (ללא שינוי): classify → sub-agent מתאים
  • unknown-agent = צ'אט כללי חכם + מודעות-מערכת (קריאה בלבד)
        ↓
tg-inbound → Telegram sendMessage (קידומת 🤖) → חזרה למשתמש
```

**ה-`unknown-agent` המשודרג:** AI Agent על `anthropic/claude-haiku-4.5`, עם זיכרון
חלון (Window Buffer Memory, מפתח `tg:<chat_id>`) ו-2 כלי קריאה ל-n8n API שלו עצמו
(`list_workflows`, `recent_errors`). טון ידידותי, עברית כברירת מחדל. אם מבקשים ממנו
פעולת **כתיבה** — הוא מסביר שהיכולת עוד לא מופעלת, ולא מתיימר שביצע.

## 4. סודות

| סוד | מיקום | תפקיד | מי יוצר |
|---|---|---|---|
| `n8n-telegram-bot-token` | per-system SM | טוקן בוט השיחה (ה-credential `Telegram (factory-master)` ב-n8n נבנה ממנו) | provision זורע ממערכות test מ-`n8n-telegram-bot-token-test`; מערכת אמיתית — מילוי ידני |
| `n8n-telegram-bot-token-test` | control SM בלבד | ה-durable default לזריעה. **כאן מדביקים את הטוקן** (סעיף 7) | המפעיל (פעם אחת) |
| `n8n-telegram-chat-id` / `telegram-chat-id` | per-system SM | chat_id (זהה לבוט ההתראות) | provision זורע מ-`telegram-chat-id` |
| `n8n-telegram-webhook-secret` | per-system SM | ה-secret_token ש-Caddy בודק על `/webhook/telegram-in/*` | **נטבע ב-provision** (`openssl rand -hex 32`, אידמפוטנטי) |

## 5. מה הותקן (v1)

- `templates/system/workflows/n8n/tg-inbound.json` — מותקן + **מופעל** ע"י
  `configure-agent-router.yml`.
- `templates/system/Caddyfile` — חריגת `/webhook/telegram-in/*` (Phase F PR 2).
- `configure-agent-router.yml` — מוודא את הטוקן ב-SM של המערכת, יוצר credential של
  Telegram, מתקין+מפעיל את `tg-inbound`, ורושם את `setWebhook`.
- `unknown-agent.json` — שוכתב לצ'אטבוט כללי חכם עם מודעות-מערכת (קריאה בלבד).

## 6. מה נדחה ל-follow-up (דורש גילוי חי של חיבור ה-DB)

הדברים הבאים תוכננו ב-`factory-research-context.md` אך **לא נכללו ב-v1**, כי ה-Postgres
של המערכת נגיש רק מרשת Railway הפנימית והסיסמה שלו לא ב-SM — כך ש-GitHub Actions לא
יכול ליצור טבלאות/credential שם. הם ייבנו מול מערכת test חיה:

- **זיכרון מתמשך ב-Postgres** (היום הזיכרון בחלון בזיכרון, מתאפס ב-restart).
- **למידת סגנון** (`style_profile`) + רענון שבועי (`style-refresh.json`).
- **סיכום יומי יזום** ב-08:00 (`tg-proactive.json`).
  `tg-proactive.json` ו-`style-refresh.json` קיימים כתבניות **אך אינם מותקנים**.
- **dedup** (`tg_updates_seen`) ו-**`spend_log`**.
- **פעולות-כתיבה עם אישור (HITL)** — אישור ✅/❌ לפני ביצוע פעולה משנת-מצב.

## 7. הפעלה — הפעולה הידנית היחידה

`configure-agent-router.yml` בודק את `n8n-telegram-bot-token` של המערכת. אם הוא ריק,
השלב **soft-halt** עם הוראה בעברית ב-job summary, וה-router עדיין מוגדר (רק הבוט מדולג).
כדי שמערכות test יקבלו את הטוקן אוטומטית, הדבק אותו פעם אחת ל-control SM:

```
gcloud secrets create n8n-telegram-bot-token-test \
  --project=or-factory-master-control --replication-policy=automatic 2>/dev/null
echo -n '<TOKEN_FROM_BOTFATHER>' | gcloud secrets versions add \
  n8n-telegram-bot-token-test --project=or-factory-master-control --data-file=-
```

זה צריך לקרות **לפני** ה-provision (כדי שייזרע ל-`n8n-telegram-bot-token`). ניתן גם
לזרוע ממערכת test קיימת דרך `seed-test-bot-token.yml`. **בדיקת חיים:** שלח `/start`
ואז הודעה לבוט מהאקאונט שלך (טלגרם דורש שהמשתמש יפתח את השיחה לפני שהבוט יכול לענות).

## 8. אבחון תקלות

| תופעה | בדיקה |
|---|---|
| הבוט לא עונה בכלל | ב-job summary של `configure-agent-router.yml`: האם `tg-inbound` פעיל ו-`setWebhook` עבר (PASS)? האם הטוקן היה קיים (אחרת "נדרשת פעולה ידנית")? ודא ששלחת `/start`. |
| 401 ב-`/webhook/telegram-in/*` | תקין ללא ה-header. עם `X-Telegram-Bot-Api-Secret-Token` נכון (הערך מ-`n8n-telegram-webhook-secret`) → 404/200. אם 401 גם עם הערך הנכון — ה-secret ב-Caddy שונה מזה שב-SM (לרוב אחרי re-provision של מערכת test ללא re-deploy). |
| הבוט עונה רק את ה-fallback | הקריאה לראוטר נכשלה. ודא ש-`tg-inbound` קורא ל-`http://localhost:5678/webhook/agent-router` (פנימי) ולא לדומיין הציבורי (ש-Caddy חוסם ב-HMAC). |
| `setWebhook` החזיר שגיאה | בדוק ב-`https://api.telegram.org/bot<token>/getWebhookInfo` את `last_error_message`. |

## 9. מיגרציה של מערכת קיימת

מערכות שהוקמו לפני Phase F **לא מקבלות את הבוט אוטומטית**. למיגרציה: הרץ
`deploy-railway-cloudflare.yml` (Caddy + webhook secret) ואז `configure-agent-router.yml`
(credential + tg-inbound + setWebhook). שניהם אידמפוטנטיים ו-soft-fail. מערכת שהוקמה
לפני Phase F צריכה גם שטוקן יהיה ב-`n8n-telegram-bot-token` שלה (זריעה ידנית, כי provision
לא רץ מחדש).
