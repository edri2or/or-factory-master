# Phase F handoff — מה חי, מה פתוח, איך ממשיכים

> מסמך התייחסות לסשני Claude Code עתידיים שממשיכים את Phase F (בוט שיחה טלגרם פר-מערכת). נכתב 2026-05-28 אחרי שהבוט אומת חי על `factory-test-tgbot9` ע"י **הודעת טלגרם אמיתית** מהמפעיל — לא ע"י install PASS.

## 1. סטטוס נוכחי

- **בוט חי**: `https://n8n-factory-test-tgbot9.or-infra.com`. הזרימה: טלגרם → Caddy `/webhook/telegram-in/*` → `tg-inbound` → `agent-router` → sub-agent → תשובה → `n8n_chat_histories`. אומת ב-`inspect_n8n_execution` (tg-inbound + agent-router + sub-agent, כל שלושת ה-executions `status:success`).
- **PRs**: ראה `CHANGELOG.md` Stages 95–104 לתיאורים מלאים. כל ה-Phase F PRs (140, 141, 142, 143, 144, 145, 146, 147, 149, 150) מוזגו ל-main.
- **מערכות test פעילות**: רק `factory-test-tgbot9`. tgbot2–8 פורקו דרך `decommission-test-system.yml` (לאחר Stage 104 שתיקן את הזיהוי-לפי-שם).
- **קריאה ראשונה לסשן חדש**:
  - `CHANGELOG.md` Stages 95–104 — מה התווסף, באיזה PR, איזה fix.
  - `docs/telegram-chat-bot.md` — §5 (מה הותקן) ו-§6 (טבלת סטטוס יכולות).
  - `templates/system/.github/workflows/configure-agent-router.yml` — orchestrator העיקרי. בלוקים מסומנים `# Phase F follow-up …`.

## 2. 5 הפערים הפתוחים (מול §6.2 ו-§7.5 של התכנית המקורית)

| # | פער | היכן רואים | פעולת ביצוע מומלצת |
|---|---|---|---|
| 1 | **HITL לפעולות-כתיבה** (`Send-and-Wait` + `pending_actions`) | אין tool כתיבה לאשר; הבוט עונה "היכולת לא מופעלת" | דחוי במכוון. `Send-and-Wait` של n8n תוקע webhook סינכרוני עד timeout. כשייווצר tool כתיבה: לבנות **אסינכרונית** — tool כותב שורה ל-`pending_actions` ועונה "אשר ✅/❌"; `tg-inbound` יזהה ✅/❌ כהודעה עוקבת ויפעיל/יבטל. הטבלה `pending_actions` קיימת מ-Stage 95. |
| 2 | **Style injection ב-4 sub-agents** (ops, code, research, infra) | רק `unknown-agent` מאמץ את `style_profile`. בדיקה: ראה תשובת research-agent שמזדהה "אני RESEARCH sub-agent" — system prompt לא מסתיר את הארכיטקטורה כי אין הזרקת סגנון. | בכל אחד מ-4 ה-JSONs: להוסיף node `Read Style Profile` (Postgres, `alwaysOutputData:true`, אותו דפוס מ-Stage 103) בין trigger ל-AI Agent. `systemMessage` הופך לביטוי עם ternary שמזריק `style_profile` כשקיים. `configure-agent-router.yml` כבר מבצע sed של `@@CRED_POSTGRES_ID@@` בלולאת ה-sub-agents — אין שינוי ב-configure. |
| 3 | **Tools חדשים ל-`unknown-agent`** (`postgres_named_query`, `gcp_metadata_get`, `n8n_trigger_workflow` עם requires_review) | יש רק `list_workflows` ו-`recent_errors`. אומר "אני עובד ללא כלים חיצוניים" כשבעצם יכול. | להוסיף 3 nodes `toolHttpRequest` ל-`unknown-agent.json` (דפוס זהה ל-`list_workflows` הקיים). `n8n_trigger_workflow` דורש את HITL מ-#1. `postgres_named_query` = רשימה לבנה של queries מוגדרות מראש (לא SQL חופשי — אבטחה). |
| 4 | **`templates/system/AGENTS.md.template` — עדכון** | המסמך לא משקף את שני הבוטים, 6 הטבלאות החדשות, ו-4 ה-workflows החדשים | להוסיף סעיף "Telegram Chat Bot" עם: שני הבוטים (chat vs alerts), 6 הטבלאות עם הסכמות מ-Stage 103, ארבעת ה-workflows (`db-setup`, `tg-inbound`, `tg-proactive`, `style-refresh`). |
| 5 | **Real cost tracking ב-`spend_log`** | `cost_usd` קבוע `0` ב-`tg-proactive` ובכל workflow אחר. הטבלה קיימת עם `prompt_tokens`/`completion_tokens` אבל ריקים. | בכל workflow שצורך OpenRouter דרך n8n's `lmChatOpenRouter`: להוסיף node Code/Set אחרי ה-Chat Model שמחלץ `$('OpenRouter Chat Model').last().json.usage` (אם n8n חושף את זה — לאמת) ומזין ל-`INSERT INTO spend_log`. אם n8n לא חושף — fallback: להחליף את ה-lmChat node ב-HTTP Request ישיר לכן `openrouter.ai/api/v1/chat/completions` שמחזיר `usage.cost` במלואו. |

## 3. דיסציפלינת אימות — קריאת חובה לפני המשך

**"PASS של install ≠ הוכחה שהבוט עובד."** ב-Stages 95–103 הצהרתי "הבוט עובד" על בסיס install markers בלבד, מבלי שהמפעיל שלח הודעה אמיתית. ב-Stage 104 התגלו 3 באגים מקושרים שכולם הסתתרו מאחורי PASS-של-install אבל נחשפו ברגע ההודעה האמיתית הראשונה.

**כללי האימות לסשנים הבאים:**

1. **לקרוא כל `WARN:` בלוגי deploy/configure לפני להצהיר PASS** — soft-fail דוחפת אזהרות ל-job summary; קל להחמיץ. ב-`get_run_jobs` עם `fetch_logs_for_job_id` ו-grep ספציפי.
2. **אחרי configure: לוודא את שורת `PASS: OpenRouter credential live-tested (HTTP 200 from chat/completions)`** (הוסף ב-Stage 104). אם 4xx — הבוט יחזיר רק fallback ואין טעם להגיד שעובד.
3. **לפני להצהיר "הבוט עובד"**: לבקש מהמפעיל לשלוח **הודעה אמיתית** דרך טלגרם, ואז לקרוא ב-`inspect_n8n_execution` (workflowId של tg-inbound + agent-router + sub-agent הרלוונטי). לוודא כל השלושה `status:success` **וגם** שהתשובה היא לא ה-fallback `אין לי תשובה כרגע — נסה שוב בעוד רגע.` (אפשר לקרוא את ה-data של Send Reply node או לבקש מהמפעיל לאמת ויזואלית).
4. **שלב decommission ב-reuse mode**: Stage 104 תיקן את הזיהוי-לפי-שם של מפתח OpenRouter (היה bug שהשורש שלו: `openrouter-key-hash` ב-shared SM תמיד שייך ל-system שהוקם אחרון). אם תזהה decommission ישן שלא דרך הקוד הנוכחי — חשד מיד שהמפתח של מערכת אחרת בוטל.

## 4. הפניות

- **התכנית המקורית** `factory-research-context.md` (1047 שורות, v1.0 2026-05-27 — §1 מטרות, §6.2 מיפוי לפעולה, §7.5 פירוט PRs, §7.7 12 קריטריוני קבלה). **לא בריפו** במכוון (החלטת מפעיל). נמצאת כ-upload אצל המפעיל; אם הסשן זקוק — שיבקש ממנו.
- **`CHANGELOG.md`** Stages 95–104 — היסטוריה מלאה של ה-PRs (95–103) + תיקוני באגים (97–99, 104).
- **`docs/telegram-chat-bot.md`** — סטטוס יכולות מעודכן (§6).

## 5. הפרומפט לסשן חדש

המפעיל יכתוב **שורה אחת**:

> קרא `docs/phase-f-handoff.md` ב-`edri2or/or-factory-master` והמשך משם. הקובץ `factory-research-context.md` נמצא אצלי כ-upload — תגיד אם תזדקק לו לפני שאני אצרף אותו.

ועל הסשן החדש לפני שיציע פעולה: לקרוא את ההנדאוף הזה (§1–§5), את `CHANGELOG.md` Stages 95–104, ואת `docs/telegram-chat-bot.md` §5–§6. רק אחרי זה לבחור אחד מ-5 הפערים ב-§2 ולהציע תכנית.
