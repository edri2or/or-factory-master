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

**Follow-up (Stages 95–103) הרחיב את ההתקנה:** `configure-agent-router.yml` מתקין גם
`db-setup` (יצירת 7 טבלאות Postgres), משדרג את `unknown-agent` ל-`memoryPostgresChat`
(זיכרון שורד restart) עם הזרקת `style_profile` ל-system prompt, ומתקין+מפעיל את
`style-refresh` (שבועי) ואת `tg-proactive` (יומי). `tg-inbound` מקבל `Dedup Guard`
(טבלת `tg_updates_seen` מונעת עיבוד כפול של אותו `update_id`). **Stage 108** הוסיף
ל-`unknown-agent` שני מנגנונים נוספים של מודעות-מערכת: tool בשם `postgres_named_query`
שקורא ל-subworkflow `postgres-named-queries` עם whitelist קבועה של 4 שאילתות
SELECT (ללא SQL חופשי), וגוש `SYSTEM-INFO` JSON שמוזרק ע"י `configure-agent-router.yml`
ל-system prompt של ה-Chat Agent בזמן ה-install (system_name, n8n_domain, gcp_project_id,
gcp_region, runtime, capabilities) — כך הבוט עונה על "מי אני / איפה אני" בלי תלות-ריצה
חדשה ובלי סוד חדש. ראה §6 לסטטוס מלא.

## 6. סטטוס היכולות (Phase F closure)

החלקים שהיו דחויים ב-v1 כי ה-Postgres של המערכת נגיש רק מרשת Railway הפנימית והסיסמה
שלו לא נשמרת ב-SM נשלחו ואומתו חי על `factory-test-tgbot7` ו-`factory-test-tgbot8`.
ה-Postgres נפתח דרך שליפת הסיסמה מ-Railway GraphQL (באמצעות `railway-api-token` של
המערכת) ב-`configure-agent-router.yml`, וטבלאות הסכמה נוצרות מבפנים ע"י workflow
`db-setup` שרץ ב-n8n (`POST /rest/workflows/{id}/run` עם `workflowData` מלא +
`destinationNode`):

| יכולת | סטטוס | מקור |
|---|---|---|
| זיכרון מתמשך ב-Postgres | ✅ נשלח | Stage 96 (PR #141) — `memoryPostgresChat` ב-`unknown-agent`, session key `tg:<chat_id>` |
| למידת סגנון + רענון שבועי | ✅ נשלח | Stage 100 (PR #145) — `style-refresh.json` (cron `0 3 * * 0`); Stage 103 — הזרקת `style_profile` ל-system prompt של `unknown-agent` |
| סיכום יומי יזום (08:00 UTC) | ✅ נשלח | Stage 101 (PR #146) — `tg-proactive.json` (cron `0 8 * * *`) |
| dedup (`tg_updates_seen`) | ✅ נשלח | Stage 102 (PR #147) — `Dedup Guard` ב-tg-inbound; `INSERT … ON CONFLICT DO NOTHING RETURNING update_id` |
| `spend_log` (טבלה + סכמה תואמת §7.5.4) | ✅ נשלח | Stage 95 + Stage 103 (תיקון סכמה: `prompt_tokens`, `completion_tokens`) |
| כתיבת `usage.cost` אמיתי ל-`spend_log` | 🟡 נדחה | `cost_usd` עדיין 0 קבוע ב-tg-proactive. דורש שינוי בכל workflow שצורך OpenRouter כדי לקרוא usage. נפרד. |
| HITL לפעולות-כתיבה (`pending_actions`) | 🟡 נדחה | `Send-and-Wait` של n8n תוקע webhook סינכרוני עד timeout; גם אין tools של כתיבה כעת לאשר. ייבנה אסינכרונית כשתתווסף יכולת כתיבה. |
| `postgres_named_query` ב-unknown-agent (whitelist) | ✅ נשלח | Stage 108 — subworkflow `postgres-named-queries.json` עם 4 שאילתות SELECT (`style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`); ללא SQL חופשי; soft-fail כש-PG חסר (jq משלב את הכלי החוצה). |
| `SYSTEM-INFO` injection ב-system prompt של unknown-agent | ✅ נשלח | Stage 108 — מחליף את `gcp_metadata_get` שלא יכול לעבוד מ-Railway (אין `metadata.google.internal`). `configure-agent-router.yml` בונה JSON עם `{system_name, n8n_domain, gcp_project_id, gcp_region:"me-west1", runtime, capabilities}` ומזריק דרך `jq gsub` של `@@SYSTEM_INFO_JSON@@`. אפס תלות-ריצה חדשה. |
| `postgres_named_query` בשני סוכנים (unknown + ops) + ניטרול persona-leaks | ✅ נשלח | Stage 110 — `postgres-named-queries.json` תוקן ל-`inputSource:"workflowInputs"` עם `values:[{name:"query_name",type:"string"}]` (קודם היה `passthrough` ו-n8n's toolWorkflow v2.1 לא העביר את ה-args של ה-LLM ל-Switch — מאומת על factory-test-tgbot12 executions 37–38 שנפלו ל-fallback). ops-agent מקבל גם הוא את הכלי + SYSTEM-INFO כדי שיוכל לענות אמיתית על שאלות `executions_summary_24h` במקום "אין לי כלי שיודע". ניטרול "You are the X sub-agent" מ-4 כל ה-personas (`ops/code/research/infra`) — Stage 106 הוסיף style_profile אבל לא נגע בשורת הזהות, וזה גרם ל-research-agent לפלוט "אני סוכן מחקר (RESEARCH sub-agent)" על שאלת מי-אתה. |

כל המסלולים soft-fail: אם PG לא נשלף בהצלחה (חוסר סוד/תקלה זמנית), `configure` מתעדת
WARN בעברית ב-job summary והבוט ממשיך לעבוד עם זיכרון-חלון בזיכרון (graceful
degradation, אותו דפוס שמפעיל את ה-jq fallback של `unknown-agent`).

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
