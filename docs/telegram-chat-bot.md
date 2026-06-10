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
  • Extract & Normalize — מזהה גם תמונה: msg.photo (הגדול) או msg.document עם mime image/*
  • Route Update — ניתוב לפי סוג ההודעה:
        ↓
מסלול טקסט / לחיצת-אישור:
  Call Agent Router — POST פנימי ל-http://localhost:5678/webhook/agent-router
    (עוקף את Caddy; הקריאה דרך הדומיין הציבורי הייתה נחסמת ב-HMAC → 401)
  → Agent Router הקיים (ללא שינוי): classify → sub-agent מתאים
    • unknown-agent = צ'אט כללי חכם + מודעות-מערכת + פעולות-כתיבה מאושרות (HITL)
מסלול תמונה:
  tg-vision (sub-workflow): getFile → המרת base64 חסינה → OpenRouter VLM
    (qwen/qwen3-vl-30b-a3b-instruct, prompt הגנתי; fallback ל-google/gemini-2.5-flash)
    → OCR + תיאור בעברית → ולידציית-egress (כמו L5)   [בלם 20MB; טקסט-בתמונה = לא-מהימן]
        ↓
tg-inbound → Telegram sendMessage (קידומת 🤖) → חזרה למשתמש
```

**ה-`unknown-agent` המשודרג:** AI Agent על `anthropic/claude-haiku-4.5`, עם זיכרון
חלון (Window Buffer Memory, מפתח `tg:<chat_id>`) ו-2 כלי קריאה ל-n8n API שלו עצמו
(`list_workflows`, `recent_errors`). טון ידידותי, עברית כברירת מחדל. אם מבקשים ממנו
פעולת **כתיבה** (להפעיל/לכבות אוטומציה ב-n8n, או להריץ workflow ב-GitHub) — הוא קורא לכלי
`request_write_action`, ששולח ל-Or כפתורי ✅/❌ בטלגרם; הפעולה מתבצעת רק אחרי אישור (ראה §6).
הבוט לעולם לא מבצע כתיבה ישירות ולא מתיימר שביצע לפני אישור.

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
- `templates/system/workflows/n8n/tg-vision.json` — sub-workflow "הבנת תמונה" (כבוי;
  Execute-Workflow-Trigger). `configure-agent-router.yml` מתקין אותו ומחליף לתוך
  `tg-inbound` את `@@WF_TG_VISION_ID@@`. אם ההתקנה נכשלת — פס-בטיחות מסיר את ענף-התמונה
  ו-`tg-inbound` ממשיך לעבוד רגיל (טקסט/אישורים) ללא הפניה ל-sub-workflow חסר.

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
חדשה ובלי סוד חדש. **Stage 115** הוסיף את `spend-track` (שעתי) — מתעד עלות OpenRouter
אמיתית ל-`spend_log` דרך `GET /api/v1/key` (חילוץ per-call token לא אפשרי ב-n8n). ראה §6 לסטטוס מלא.

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
| כתיבת עלות OpenRouter אמיתית ל-`spend_log` | ✅ נשלח | Stage 115 — `spend-track.json` (cron `0 * * * *`) קורא את `GET /api/v1/key` של OpenRouter (`data.usage` המצטבר; קרדיטים 1:1 USD) ומזין את ה-delta מאז הקריאה הקודמת ל-`spend_log` כ-`model='openrouter-key'` (טבלת `spend_track_state` משמשת עוגן). חילוץ per-call token מ-n8n's `lmChatOpenRouter` לא אפשרי (`tokenUsage` נשמט — n8n#26302/#21673), לכן הגישה האותנטית של מד-המונה. ה-"Log Spend" המזויף (`cost_usd=0`) הוסר מ-tg-proactive. |
| HITL לפעולות-כתיבה (`pending_actions`) | ✅ נשלח | פיתוח `hitl-write-actions` — הבוט מבקש פעולות-כתיבה מאושרות, אסינכרוני state-free מגובה-Postgres (**לא** `Send-and-Wait`): הכלי `request_write_action` רושם שורת `pending_actions` (`expires_at`=+2h, `idempotency_key`) ושולח כפתורי ✅/❌; `tg-inbound` קולט את הלחיצה (אימות `from.id` דרך `chat_id==@@CHAT_ID@@`, `answerCallbackQuery` מיידי, סגירת כפתורים) → `pending-actions-executor` (נעילה אטומית `WHERE id=… AND status='pending' AND expires_at>now()`) מבצע: n8n activate/deactivate דרך ה-Public API, או GitHub `workflow_dispatch` (token מוגבל-repo, `actions:write` בלבד, inputs כ-strings). `pending-actions-cleanup` (cron שעתי) מסמן בקשות שפג תוקפן. רינדור כפתורי ה-inline-keyboard מאומת חי על מערכת מותקנת. |
| `postgres_named_query` ב-unknown-agent (whitelist) | ✅ נשלח | Stage 108 — subworkflow `postgres-named-queries.json` עם 4 שאילתות SELECT (`style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`); ללא SQL חופשי; soft-fail כש-PG חסר (jq משלב את הכלי החוצה). |
| `SYSTEM-INFO` injection ב-system prompt של unknown-agent | ✅ נשלח | Stage 108 — מחליף את `gcp_metadata_get` שלא יכול לעבוד מ-Railway (אין `metadata.google.internal`). `configure-agent-router.yml` בונה JSON עם `{system_name, n8n_domain, gcp_project_id, gcp_region:"me-west1", runtime, capabilities}` ומזריק דרך `jq gsub` של `@@SYSTEM_INFO_JSON@@`. אפס תלות-ריצה חדשה. |
| `postgres_named_query` בשני סוכנים (unknown + ops) + ניטרול persona-leaks | ✅ נשלח | Stage 110 — `postgres-named-queries.json` תוקן ל-`inputSource:"workflowInputs"` עם `values:[{name:"query_name",type:"string"}]` (קודם היה `passthrough` ו-n8n's toolWorkflow v2.1 לא העביר את ה-args של ה-LLM ל-Switch — מאומת על factory-test-tgbot12 executions 37–38 שנפלו ל-fallback). ops-agent מקבל גם הוא את הכלי + SYSTEM-INFO כדי שיוכל לענות אמיתית על שאלות `executions_summary_24h` במקום "אין לי כלי שיודע". ניטרול "You are the X sub-agent" מ-4 כל ה-personas (`ops/code/research/infra`) — Stage 106 הוסיף style_profile אבל לא נגע בשורת הזהות, וזה גרם ל-research-agent לפלוט "אני סוכן מחקר (RESEARCH sub-agent)" על שאלת מי-אתה. |
| חיפוש ומחקר-אינטרנט (Tavily) ב-research-agent **וגם** unknown-agent | ✅ נשלח | פיתוח `research-web-search` — שני כלי `toolHttpRequest`: `web_search_quick` (Tavily `search_depth=basic`) ו-`web_search_extended` (`advanced`), מאומתים דרך credential httpHeaderAuth `Tavily (factory-master)` (`@@CRED_TAVILY_ID@@`, נוצר ב-`configure-agent-router.yml` מ-`tavily-api-key` שב-SM). מותקנים גם ב-`research-agent` (מומר ל-`agent` v2.2, מודל `claude-sonnet-4.5`) וגם ב-`unknown-agent` (סוכן-השיחה הכללי — מונע "פיצול אישיות" כשה-classifier מנתב בקשת-חיפוש לשיחה רגילה). מקורות מוחזרים בבלוק `[[SOURCES]]` ש-"Egress Validation" ב-`agent-router.json` פוטר מ-redaction (קישורים מלאים, dedup, עד 10) — שאר התשובה עדיין נחסמת ע"י ה-allowlist. ה-prompts מהודקים: לא לחשוף שמות-כלים, לעולם לא "אין לי גלישה", להיצמד לתוצאות. soft-fail: בלי `tavily-api-key` הכלים נחתכים (jq strip) והבוט עונה מהידע הפנימי. כלי תומך: `refresh-system-agents.yml` מחיל את הסוכנים על מערכת חיה קיימת בלי re-provision. מאומת חי על `factory-test-tavily2`. מערכות חדשות בלבד. |
| מחקר-אינטרנט **אסינכרוני** ארוך (deep research) | ✅ נשלח | פיתוח `async-deep-research` — מילת-הפעלה מפורשת ("תחקור לעומק"/"מחקר עמוק"/"deep research") מפעילה מחקר-רקע ארוך. הראוטר: `Detect Deep Research`→`Deep Gate`→`Kick Deep Research` (`executeWorkflow` עם `waitForSubWorkflow:false` = fire-and-forget) מחזיר **ack מיידי** ("🔎 מתחיל מחקר מעמיק…") בקו הסינכרוני, ואז וורקפלו `deep-research.json` (Claude `sonnet-4.5`, `maxIterations:20`, שני כלי Tavily) רץ דקות ברקע ו**שולח את הדוח לטלגרם בעצמו** (כמו `tg-proactive`) — egress-validated (אותו gate כמו הראוטר) ומחולק להודעות ≤3500 תווים, עם בלוק `[[SOURCES]]` שתמיד נשלח אחרון. אפס סוד/ספק/עלות חדשים (reuse של Tavily+OpenRouter+Telegram). soft-fail: בלי Tavily/Telegram/chat-id כל נתיב ה-deep מוסר מהראוטר (jq) ומילת-ההפעלה נופלת לזרימה הרגילה. הותר ע"י `n8n-2x-upgrade` (2.25.7). **מאומת חי מקצה-לקצה על `factory-test-053`**: ack מיידי → execution רקע עצמאי → דוח עברי מלא ב-4 הודעות עם 10 מקורות. (האימות החי גם תפס+תיקן באג Day-0: ב-2.x `tg-inbound` לא התפרסם בעוד תתי-ה-`executeWorkflow` שלו לא-מפורסמים — `tg-vision`/`tg-voice-stt`/`pending-actions-executor` עברו ל-published.) מערכות חדשות בלבד. |

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

## 10. הבנת תמונה (tg-vision)

מ-Stage tg-vision והלאה **כל מערכת חדשה** מקבלת ברירת-מחדל "הבנת תמונה" בבוט. כשהמפעיל
שולח תמונה (כתמונה או כקובץ-תמונה), `tg-inbound` מזהה אותה ב-`Extract & Normalize`
(`msg.photo` הגדול / `msg.document` עם mime `image/*`) ומנתב ל-sub-workflow `tg-vision`
(במקום לזרוק תמונה ללא כיתוב, כפי שהיה).

**הזרימה ב-tg-vision:** קלט `{file_id, chat_id, file_size, mime}` → **בלם-20MB** (תמונה
גדולה יותר עוצרת עם הודעת-עברית) → Telegram getFile (הורדה) → המרת base64 חסינה עם MIME
דינמי → HTTP ל-`https://openrouter.ai/api/v1/chat/completions` (מודל ראשי
`qwen/qwen3-vl-30b-a3b-instruct`, **prompt הגנתי**; ב-error/timeout fallback ל-`google/gemini-2.5-flash`)
→ OCR + תיאור ויזואלי בעברית → ולידציית-egress (כמו L5 של ה-router) → התשובה חוזרת ל-`Send Reply`
של `tg-inbound`.

**אבטחה (OWASP LLM01):** טקסט בתוך תמונה מטופל כ**נתון לא-מהימן** — ה-system prompt מורה
למודל לעולם לא לציית להוראות שכתובות בתמונה, רק לתאר אותן. אפס כלים במסלול; הפלט עובר
ולידציית-egress לפני שמגיע למשתמש.

**עלות וסוד:** משתמש ב-credential ה-OpenRouter הקיים (`OpenRouter (factory-master)`) — אין
ספק/סוד חדש. cap ההוצאה הקיים ($25/חודש פר-מערכת) חל גם על קריאות הראייה.

**עמידוּת:** אם `tg-vision` לא הותקן (קובץ חסר / כשל upsert), `configure-agent-router.yml`
מסיר אוטומטית את ענף-התמונה מ-`tg-inbound`, וזה ממשיך לעבוד רגיל לטקסט ואישורים.
