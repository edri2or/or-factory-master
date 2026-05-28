# Phase F handoff — מה חי, מה פתוח, איך ממשיכים

> מסמך התייחסות לסשני Claude Code עתידיים שממשיכים את Phase F (בוט שיחה טלגרם פר-מערכת). נכתב 2026-05-28; **רענון שני** באותו יום אחרי סגירת Gap 3 (Stages 108-113) ואימות חי על `factory-test-tgbot16` ב-2026-05-28 ע"י 3 הודעות טלגרם אמיתיות מהמפעיל. הסשן הזה כלל מסע דיאגנוסטי בן 4 שלבים על באג עמוק ב-n8n's `toolWorkflow` v2.1 → `executeWorkflowTrigger` שפענוח שלו דרש Telegram-debug-node ברפו של מערכת test ייעודית (tgbot14 + tgbot15) — ראה §3 כלל 6 לתבנית הדיאגנוסטית.

## 1. סטטוס נוכחי

- **בוט חי**: `https://n8n-factory-test-tgbot16.or-infra.com`. הזרימה: טלגרם → Caddy `/webhook/telegram-in/*` → `tg-inbound` → `agent-router` → sub-agent (`unknown-agent` או `ops-agent`, שני אלה כעת מצוידים ב-`postgres_named_query` + SYSTEM-INFO) → תשובה → `n8n_chat_histories`. אומת ב-`inspect_n8n_execution` כשכל ה-postgres-named-queries executions מסתיימים ב-`Format Output` (לא `Unknown Query`).
- **PRs מהסשן הזה**: 153 (handoff refresh), 154 (Stage 108), 155 (Stage 109), 156 (Stage 110), 157 (Stage 111), 158 (Stage 112), 159 (Stage 113). כולם מוזגו ל-main.
- **PRs מאז (רענון 2026-05-28)**: #161 (Stage 114 — Gap 4 סגור: `AGENTS.md.template`), ו-Stage 115 (Gap 5 סגור: `spend-track` — מעקב עלות OpenRouter אמיתי ב-`spend_log`). **כל הפערים הלא-דחויים של Phase F נסגרו; נותר רק Gap 1 (HITL), שדחוי במכוון.**
- **מערכות test פעילות**: רק `factory-test-tgbot16` (מערכת חיה קבועה — לא לפרק). tgbot11-15 פורקו במהלך הסשן הזה (tgbot10 פורק בעבר). אם נדרשת מערכת test ייעודית ליישום שינוי-template בסשן הבא — להקים tgbot17 ולא לגעת ב-16.
- **קריאה ראשונה לסשן חדש**:
  - `CHANGELOG.md` Stages 95–113 — מה התווסף, באיזה PR, איזה fix.
  - `docs/telegram-chat-bot.md` — §5 (מה הותקן) ו-§6 (טבלת סטטוס יכולות).
  - `templates/system/.github/workflows/configure-agent-router.yml` — orchestrator העיקרי. בלוקים מסומנים `# Phase F follow-up …`.

## 2. 5 הפערים הפתוחים (מול §6.2 ו-§7.5 של התכנית המקורית)

| # | פער | היכן רואים | פעולת ביצוע מומלצת |
|---|---|---|---|
| 1 | **HITL לפעולות-כתיבה** (`Send-and-Wait` + `pending_actions`) | אין tool כתיבה לאשר; הבוט עונה "היכולת לא מופעלת" | דחוי במכוון. `Send-and-Wait` של n8n תוקע webhook סינכרוני עד timeout. כשייווצר tool כתיבה: לבנות **אסינכרונית** — tool כותב שורה ל-`pending_actions` ועונה "אשר ✅/❌"; `tg-inbound` יזהה ✅/❌ כהודעה עוקבת ויפעיל/יבטל. הטבלה `pending_actions` קיימת מ-Stage 95. |
| 2 | ✅ **Style injection ב-4 sub-agents** + **ניטרול persona leaks** | — | **סגור ב-Stage 106 / PR #152 (style injection) ו-Stage 110 / PR #156 (persona neutralization).** ההיסטוריה: Stage 106 הוסיף `Read Style Profile` ל-4 ה-personas אבל לא מחק את "You are the X sub-agent" שלהם; ההנדאוף הקודם הכריז סגירה על בסיס 4 הודעות tgbot10 שלא שאלו "מי אתה" ספציפית. Stage 110 חשף את הבאג כשמשתמש שאל "מה אתה יודע על המערכת" ב-tgbot12 ו-research-agent ענה "אני סוכן מחקר (RESEARCH sub-agent)"; אז 4 ה-personas נשכתבו לתיאורי יכולת בלי הזהות ("You provide..." / "You help with..."), וכל אחד קיבל הוראה מפורשת לא לחשוף את שם הסוכן או את הארכיטקטורה. tgbot16 לא חשף leak במסר 1. |
| 3 | ✅ **Tools חדשים ל-`unknown-agent` + `ops-agent`** (`postgres_named_query` + SYSTEM-INFO injection) | — | **סגור ב-Stages 108-113**. 108 הוסיף `postgres_named_query` toolWorkflow ל-unknown-agent + subworkflow עם whitelist של 4 שאילתות SELECT (`style_profile_get`, `recent_audit_log`, `pending_actions_open`, `executions_summary_24h`) + SYSTEM-INFO injection ל-system prompt (מחליף את `gcp_metadata_get` שלא יכול לעבוד מ-Railway). 110 הרחיב את הכלי + SYSTEM-INFO ל-ops-agent (אחרי שראינו ש-classifier מנתב לשם שאלות `executions_summary_24h`). **113 פתר את הבאג העמוק**: עם `specifyInputSchema` בכל צורה (manual JSON Schema with enum, OR fromJson example) + trigger `workflowInputs`, n8n 1.121's bridge בין LLM args ל-`$json` של ה-trigger לא מעביר את הערך — ה-LLM מגיע עם `query_name: null` בכל פעם (אומת חי על tgbot14 + tgbot15 דרך Telegram-debug-node). הפתרון = **drop `specifyInputSchema` + trigger `passthrough`**: ה-LLM מעביר מחרוזת בודדת ב-`$json.query`, ו-`Normalize Input` Code node במיקרו-subworkflow מחלץ את ה-`query_name` מול ה-whitelist. `n8n_trigger_workflow` נשאר דחוי (דורש HITL מ-Gap 1). |
| 4 | ✅ **`templates/system/AGENTS.md.template` — עדכון** | — | **סגור ב-PR #161 / Stage 114.** ה-template קיבל סעיף ייעודי "Telegram Chat Bot": שני הבוטים (chat `n8n-telegram-bot-token` vs alerts `telegram-bot-token`, chat_id משותף), 7 טבלאות Postgres עם עמודות מפתח, חמשת ה-workflows (`tg-inbound`, `tg-proactive`, `style-refresh`, `postgres-named-queries`, `db-setup`), ה-whitelist של `postgres_named_query` + הזרקת SYSTEM-INFO, ושני הפריטים שהיו דחויים (Gap 5 ו-Gap 1). תיעוד בלבד — אין שינוי runtime. |
| 5 | ✅ **Real cost tracking ב-`spend_log`** | — | **סגור ב-Stage 115.** הגישה שהוצעה כאן (Code node שקורא `$('OpenRouter Chat Model').last().json.usage`) **לא אפשרית** — n8n מבליע את `tokenUsage` של ה-sub-node ולא ניתן לשלוף אותו ל-node במורד הזרם (n8n#26302/#21673, `"No path back to the referenced node"`; נכון ל-`chainLlm` ול-`agent` כאחד). במקום זה: workflow חדש `spend-track.json` (שעתי, `0 * * * *`) קורא את `GET /api/v1/key` של OpenRouter — `data.usage` = סך הדולרים המצטבר על המפתח (קרדיטים 1:1 USD; מאומת ע"י מפתח ה-inference עצמו, בלי management key) — ומזין את ה-delta מאז הקריאה הקודמת ל-`spend_log` כ-`model='openrouter-key'` (טבלת `spend_track_state` עוגן; first-run seed בלי לוג היסטוריה; delta שלילי → 0). ה-reader של tg-proactive (`SUM(cost_usd)` 24ש') לא השתנה ועכשיו משקף עלות אמיתית; ה-"Log Spend" המזויף (`cost_usd=0`) הוסר. |

## 3. דיסציפלינת אימות — קריאת חובה לפני המשך

**"PASS של install ≠ הוכחה שהבוט עובד."** ב-Stages 95–103 הצהרתי "הבוט עובד" על בסיס install markers בלבד, מבלי שהמפעיל שלח הודעה אמיתית. ב-Stage 104 התגלו 3 באגים מקושרים שכולם הסתתרו מאחורי PASS-של-install אבל נחשפו ברגע ההודעה האמיתית הראשונה. ב-Stages 108-113 נחשפו עוד 3 (ראה Stage 110 CHANGELOG entry) + הבאג העמוק של n8n toolWorkflow שדרש 4 איטרציות לפתור.

**כללי האימות לסשנים הבאים:**

1. **לקרוא כל `WARN:` בלוגי deploy/configure לפני להצהיר PASS** — soft-fail דוחפת אזהרות ל-job summary; קל להחמיץ. ב-`get_run_jobs` עם `fetch_logs_for_job_id` ו-grep ספציפי.
2. **אחרי configure: לוודא את שורת `PASS: OpenRouter credential live-tested (HTTP 200 from chat/completions)`** (הוסף ב-Stage 104). אם 4xx — הבוט יחזיר רק fallback ואין טעם להגיד שעובד.
3. **לפני להצהיר "הבוט עובד"**: לבקש מהמפעיל לשלוח **הודעה אמיתית** דרך טלגרם, ואז לקרוא ב-`inspect_n8n_execution` (workflowId של tg-inbound + agent-router + sub-agent הרלוונטי). לוודא כל השלושה `status:success` **וגם** שהתשובה היא לא ה-fallback `אין לי תשובה כרגע — נסה שוב בעוד רגע.` (אפשר לקרוא את ה-data של Send Reply node או לבקש מהמפעיל לאמת ויזואלית).
4. **שלב decommission ב-reuse mode**: Stage 104 תיקן את הזיהוי-לפי-שם של מפתח OpenRouter (היה bug שהשורש שלו: `openrouter-key-hash` ב-shared SM תמיד שייך ל-system שהוקם אחרון). אם תזהה decommission ישן שלא דרך הקוד הנוכחי — חשד מיד שהמפתח של מערכת אחרת בוטל.
5. **שינויים ב-`templates/system/` חלים רק על מערכות חדשות** — לא על מערכות קיימות (snapshot בזמן ה-provision). כדי לאמת שינוי לאחר merge, יש להריץ את ה-flow המלא על מערכת test חדשה: `provision-system.yml` (reuse mode, 0 quota) → `register-system-app.yml` (2-click) → `deploy-railway-cloudflare.yml` (ברפו של המערכת) → `configure-agent-router.yml` (ברפו של המערכת) → 3-4 הודעות אמיתיות לטלגרם. סה"כ ~15-20 דקות. **שיטה זו הוכחה ב-Stages 106 + 110 + 113 כדרך הנכונה לאימות end-to-end של שינויי template.**
6. **כשבוט עונה תשובה סובייקטיבית** (דוגמת "בעיה טכנית עם השאילתה" / "הדאטהבייס לא מחזיר") וזה לא ברור אם ה-tool עבד או לא — **לא לסמוך על סיכום של ה-LLM**. להריץ דיאגנוסטיקה ישירה: לדחוף גרסה זמנית של ה-subworkflow לרפו של המערכת (דרך GitHub API `create_or_update_file` עם ה-SHA הקיים) עם **Telegram-debug-node שמשלח את ה-`$json` הגולמי ישירות לטלגרם של המפעיל** (לעקוף את ה-LLM), ואז re-run של `configure-agent-router.yml` כדי שתתקין את הגרסה הזמנית. הוכח חיוני ב-Stages 111-113 — בלעדיו ה-fix היה גישוש, ועם זה תוך 3 איטרציות נמצאה הסיבה האמיתית (n8n 1.121's `toolWorkflow` v2.1 + trigger `workflowInputs` + `specifyInputSchema` בכל צורה מציב את ה-LLM's args ל-`null` ב-`$json` של ה-trigger). דפוס ה-Telegram-debug-node:
   - `n8n-nodes-base.telegram` node, sendMessage, אחרי הנקודה החשודה ב-flow.
   - chatId = `@@CHAT_ID@@` (יוחלף ב-configure).
   - credential id = hardcoded (לפרק זמנית מתוך `INFO: Telegram credential id=...` שבלוג של configure).
   - text expression שמתחיל ב-`🔍 DEBUG` ומכיל `JSON.stringify($('SuspectNode').first().json, null, 2)`.
   - `onError: continueRegularOutput` כדי שלא ישבר את ה-flow אם לא מצליח לשלוח.

## 4. הפניות

- **התכנית המקורית** `factory-research-context.md` (1047 שורות, v1.0 2026-05-27 — §1 מטרות, §6.2 מיפוי לפעולה, §7.5 פירוט PRs, §7.7 12 קריטריוני קבלה). **לא בריפו** במכוון (החלטת מפעיל). נמצאת כ-upload אצל המפעיל; אם הסשן זקוק — שיבקש ממנו.
- **`CHANGELOG.md`** Stages 95–113 — היסטוריה מלאה של ה-PRs (95–103, 105–106, 108, 110, 111, 112, 113) + תיקוני באגים (97–99, 104, 109).
- **`docs/telegram-chat-bot.md`** — סטטוס יכולות מעודכן (§6).

## 5. הפרומפט לסשן חדש

המפעיל יכתוב **שורה אחת**:

> קרא `docs/phase-f-handoff.md` ב-`edri2or/or-factory-master` והמשך משם. הקובץ `factory-research-context.md` נמצא אצלי כ-upload — תגיד אם תזדקק לו לפני שאני אצרף אותו.

ועל הסשן החדש לפני שיציע פעולה: לקרוא את ההנדאוף הזה (§1–§5), את `CHANGELOG.md` Stages 95–115, ואת `docs/telegram-chat-bot.md` §5–§6. **הפער היחיד שנותר פתוח הוא Gap 1 (HITL לפעולות-כתיבה, §2 שורה 1)** — והוא דחוי במכוון עד שתתווסף לבוט יכולת כתיבה (אז ה-`Send-and-Wait` ייבנה אסינכרונית מול טבלת `pending_actions`). כלומר Phase F הושלם מבחינת כל היכולות הלא-דחויות; הצעד הבא המהותי הוא הוספת יכולת כתיבה + Gap 1 יחד.
