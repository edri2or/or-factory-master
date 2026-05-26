# OpenRouter — אינטגרציה לכל מערכת

מסמך זה מתאר כיצד כל מערכת חדשה מקבלת מפתח Inference ייעודי ומבודד של OpenRouter,
וכיצד ה-Management Key נשאר מבודד ב-`or-factory-master-control` בלבד.

## 1. מה זה OpenRouter ו-Auto Router

OpenRouter הוא שער (gateway) אחיד מול עשרות מודלים של LLM (Anthropic, OpenAI, Google,
DeepSeek ועוד) דרך API תואם-OpenAI יחיד ומפתח אחד. במקום להחזיק מפתח לכל ספק, פונים
ל-`https://openrouter.ai/api/v1` והבקשה מנותבת לספק הנכון. המודל המיוחד `openrouter/auto`
משתמש ב-NotDiamond כדי לנתב כל prompt אוטומטית למודל המתאים ביותר מבחינת איכות/עלות, כך
שאין צורך לבחור מודל ידנית. כל מערכת ב-factory מקבלת מפתח Inference משלה, ולכן השימוש
והעלות מבודדים בין מערכות.

## 2. הקמה חד-פעמית של ה-Management Key

ה-Management Key (נקרא גם Provisioning Key) הוקם **ידנית, פעם אחת** בדשבורד של OpenRouter
תחת `https://openrouter.ai/settings/provisioning-keys`, ונשמר ב-Secret Manager של פרויקט
הבקרה תחת השם `openrouter-management-key`:

- מיקום: `or-factory-master-control` SM בלבד.
- ייעוד: מינטינג / רשימה / ביטול של מפתחי Inference דרך `/api/v1/keys`.
- **אף פעם לא מועתק** למערכת — דפוס ה-EXCLUDE ב-`scripts/copy-generic-secrets.sh`
  (`*-management-key` / `*-provisioning-key` / `*-master-key`) חוסם זאת.

אין צורך בשום פעולה ידנית של מפעיל עבור מערכת חדשה — המינטינג אוטומטי לחלוטין.

## 3. מה קורה אוטומטית בכל מערכת חדשה

בזמן `provision-system.yml` (שלב `Mint per-system OpenRouter inference key`):

1. הקריאה קוראת את `openrouter-management-key` מפרויקט הבקרה.
2. בדיקת אידמפוטנטיות: אם כבר קיים `openrouter-api-key` ב-SM של המערכת — דילוג.
3. `POST https://openrouter.ai/api/v1/keys` עם גוף:
   `{"name":"<system_name>","limit":25,"limit_reset":"monthly","include_byok_in_limit":false}`.
4. נשמרים שני סודות ב-SM של המערכת:
   - `openrouter-api-key` ← המפתח החי (`sk-or-v1-…`), נגיש ל-`runtime-sa` ו-`deploy-sa`.
   - `openrouter-key-hash` ← המזהה לביטול (אינו סוד).

בזמן הפריסה (`deploy-railway-cloudflare.yml`, שלב
`Create OpenRouter credential + demo workflow in n8n`):

1. התחברות ל-n8n והקמת credential מסוג `openRouterApi` בשם `OpenRouter (factory-master)`
   (כולל `apiKey` ו-`url` — שניהם נדרשים ב-n8n 1.121.0).
2. יצירת workflow לדוגמה בשם `factory-master: OpenRouter auto-router demo`:
   `Webhook → AI Agent → OpenRouter Chat Model` עם המודל `openrouter/auto`.
3. הפעלת ה-workflow ו-test-fire אחד ל-webhook (עלות זניחה, ~$0.001) לאימות מקצה-לקצה.

כל השלבים אידמפוטנטיים (לפי שם), כך שהרצה חוזרת לא יוצרת מפתחות / credentials / workflows
כפולים. כל כשל ב-OpenRouter או ב-n8n נכשל בעדינות (אזהרה בעברית ל-`$GITHUB_STEP_SUMMARY`
ו-`exit 0`) — הוא לעולם לא מפיל את ה-provision או את הפריסה.

## 4. אבחון תקלות

- **המינטינג נכשל ב-provision**: ראה את ה-job summary של הריצה. בדוק יתרה חיובית
  (`https://openrouter.ai/credits`) ושה-Management Key תקף. הרץ מחדש את ה-step / כל
  ה-provision (אידמפוטנטי).
- **בדיקת ה-webhook נכשלה בפריסה**: ה-credential וה-workflow כן נוצרו. בדוק את ה-Activity
  log (`https://openrouter.ai/activity`) ואת היתרה, או הפעל ידנית:

  ```bash
  curl -X POST https://n8n-<system_name>.or-infra.com/webhook/<path> \
    -H 'Content-Type: application/json' -d '{"prompt":"hi"}'
  ```

- **בדיקת ה-SM של המערכת** (ערכים לעולם לא מוחזרים):

  ```bash
  gcloud secrets list --project=<system_project> --filter="name~openrouter"
  gcloud secrets versions access latest --secret=openrouter-key-hash --project=<system_project>
  ```

## 5. הוצאות

- כל מערכת מוגבלת ל-**$25 לחודש** עם איפוס חודשי (1 בחודש, שעון UTC) דרך
  `limit_reset:"monthly"`.
- OpenRouter גובה עמלת רכישת קרדיט: **5.5%** (מינימום $0.80) ברכישה שאינה קריפטו, או
  **5.0%** קבוע בקריפטו. אין תוספת מחיר (markup) על ה-Inference עצמו.
- מכיוון שכל מערכת מקבלת מפתח נפרד, העלות והשימוש מבודדים ונספרים בנפרד בדשבורד.

> הערה למערכות **בדיקה** (reuse mode): ה-SM המשותף נמחק ונזרע מחדש בכל סבב provision, ולכן
> `openrouter-key-hash` אינו נשמר בין סבבים — מפתחות Inference ישנים של סבבי בדיקה עלולים
> להישאר "יתומים" ב-OpenRouter. זו התנהגות מקובלת למערכות בדיקה זמניות; ניתן לבטל ידנית.

## 6. ביטול ידני של מפתח

הביטול האוטומטי קורה ב-`decommission-test-system.yml` (שלב `Revoke OpenRouter inference key`)
לפני הריסת המערכת. לביטול ידני, השג את ה-hash מה-SM של המערכת ובטל מול ה-Management Key:

```bash
HASH=$(gcloud secrets versions access latest --secret=openrouter-key-hash --project=<system_project>)
MGMT=$(gcloud secrets versions access latest --secret=openrouter-management-key --project=or-factory-master-control)
curl -X DELETE "https://openrouter.ai/api/v1/keys/${HASH}" -H "Authorization: Bearer ${MGMT}"
# תגובה תקינה: {"deleted": true}
```

## 7. Agent Router (Stage 51 — מעבר ל-demo workflow)

מעבר ל-demo workflow הבסיסי שכל מערכת מקבלת, המפעל מקים גם תבנית **Agent Router**
מרובת-סוכנים. ה-router מסווג קלט משתמש לפי כוונה (`ops`/`code`/`research`/`infra`/
`unknown`) ומנתב ל-sub-workflow ייעודי. **ה-demo workflow הקיים
(`factory-master: OpenRouter auto-router demo`) לא משתנה ונשאר ה-baseline.**

Stage 51a הקים את הבסיס: router + sub-agents של `ops` ו-`unknown`. Stage 51b מוסיף
את `code`/`research`/`infra` (חמישה sub-agents בסך הכל; ה-router מנתב את כל חמש
הכוונות). ה-`code`/`research`/`infra` הם tool-less בשלב זה (`chainLlm` + `Set`,
כמו `unknown-agent`) — נקודת הבדיקה היא נכונות הניתוב (4/4 smoke probe), לא כלים
ייעודיים. כלים ל-sub-agent (web_search ל-research; קריאה-בלבד ל-Railway/Cloudflare
ל-infra) הם המשך נפרד; כתיבה ל-infra דורשת HITL ונדחתה. Stage 51c הוסיף את שער
ה-Macro-F1 ב-CI — **פעיל** (לאחר ש-51b אומת חי על `factory-test-61`: ניתוב 4/4).
השער מגן על ה-prompt של ה-classifier מפני רגרסיה: `tests/router_battery.yaml`
(250 מקרים מתויגים, 50 לכל כוונה), `scripts/eval_router.py` (קורא את ה-prompt+model
המדויקים מ-`agent-router.json`, מחשב macro-F1 ≥ 0.85 דרך scikit-learn), ושני
workflows ב-`.github/workflows/eval-agent-router*.yml` (היברידי WIF-only:
`eval-agent-router-precheck.yml` דטרמיניסטי על כל PR + `eval-agent-router.yml` מלא
LLM ב-dispatch/push-to-main).

**קבצים** (נדחפים לכל מערכת חדשה ע"י `provision-system.yml`):
- `workflows/n8n/{agent-router,ops-agent,code-agent,research-agent,infra-agent,unknown-agent}.json` — ה-workflows של n8n.
- `.github/workflows/configure-agent-router.yml` — workflow ב-manual dispatch שטוען
  אותם ל-n8n דרך ה-REST API. אידמפוטנטי: הרצה חוזרת מעדכנת את ה-workflows הקיימים
  לפי שם.

**הפעלה על מערכת קיימת:** הפעל את `configure-agent-router.yml` מלשונית ה-Actions של
המערכת (לאחר ש-`deploy-railway-cloudflare.yml` רץ פעם אחת — הוא יוצר את ה-credential
‏`OpenRouter (factory-master)` שה-router משתמש בו מחדש לפי שם).

**החלטות ארכיטקטוניות** (מאומתות במחקר, מתועדות ב-factory-research-context.md):
- ה-classifier מפונן ל-`openai/gpt-5-nano` (לא `openrouter/auto` — דטרמיניזם ל-CI).
- ה-sub-agents: `anthropic/claude-haiku-4.5` (ops, code, research) או
  `openai/gpt-5-mini` (infra). ה-fallback (`unknown`) על `gpt-5-nano`.
- ה-sub-agents מופעלים דרך `Execute Sub-workflow`, לא `agentTool` (n8n issue #22489
  שובר אותו עם מודלי GPT-5/Responses API נכון למאי 2026).
- Defense-in-depth: סניטיזציה של קלט (L2), classifier שמחזיר רק `{intent, confidence}`
  (L3), סף ביטחון 0.7 (L4), ואימות egress עם allowlist ל-URL (L5).
- כל שלב soft-fail: כשל ב-router לעולם לא מפיל את ה-run; אזהרה בעברית ב-job summary
  ו-`exit 0` (זהה לעיקרון ה-OpenRouter בכל המפעל).
