## מתזמר עם fan-out מותנה (router-multi-intent-fanout) — שלב 1: תת-גרף ה-fan-out במתזמר

ה-Agent Router שכל מערכת חדשה נולדת איתו ידע עד היום לבחור מומחה **אחד** להודעה
(single-pick). השלב הזה מוסיף לו — **אדיטיבית בלבד** — מסלול fan-out מותנה שנדלק רק
לבקשות **רב-תחומיות**: הוא מריץ את המומחים הרלוונטיים (לא כולם) ומאחד את תשובותיהם
לתשובה אחת. הקול-היחיד (`tg-inbound`), תת-הסוכנים (`*-agent.json`), והדיפולט single-pick
לא נגעו. הדפוס: ניתוב דטרמיניסטי כברירת-מחדל, fan-out רק כשמוצדק (Anthropic
orchestrator-workers).

**Changes (`templates/system/workflows/n8n/agent-router.json`):**
- `Classify Intent` (system prompt) — אדיטיבי: פולט בנוסף `intents` (מערך התחומים הרלוונטיים
  מתוך ops|code|research|infra, הראשי ראשון; לעולם לא `unknown`) ו-`multi` (בוליאני, true רק
  כש-≥2 תחומים נבדלים נוכחים בבירור). אובייקט ה-JSON הקיים `{"intent","confidence","entity_mention"}`
  נשמר מילה-במילה — הטוקנים `"intent"`/`"confidence"`/`json` נותרו, כך ש-`eval_router.py --check`
  עובר ו-`parse_intent` (קורא רק `intent`) אינו מושפע → מדד ה-Macro-F1 לא נפגע.
- `Build Dispatch` (Code) — מפענח `intents[]`+`multi` עם נפילה חיננית: כשל פענוח, או פחות מ-2
  תחומי-fan-out → `multi=false` (התנהגות היום). שאר ההתנהגות (פענוח robusti, clamp ל-allowlist,
  re-attach של `sanitized`) ללא שינוי.
- שבעה צמתים חדשים: `Multi Gate` (switch אחרי Resolver Gate; `multi`→fan-out, `single`→`Route by
  Intent` הקיים ללא שינוי; קורא `multi` מ-`$('Build Dispatch')` כי `Resolve Entity` מפיל את
  השדה) → `Build Fan-out Items` (Code: פריט אחד לכל מומחה רלוונטי+מותקן, נושא `wf_id` ממפת
  `@@SUB_*_WF_ID@@` הקיימת; מדלג על placeholder לא-מוחלף; פריט סינתטי אם אין כלום — לא נתקע) →
  `Run Specialists` (`executeWorkflow` `mode:each`, `workflowId` per-item `={{ $json.wf_id }}`,
  `waitForSubWorkflow:true`, `onError:continueRegularOutput`) → `Collect Replies` (Code:
  `$input.all()` מצומת-מקור יחיד; משחזר את תווית המומחה לפי index-pairing עם `Build Fan-out
  Items`; מדלג על תשובות ריקות) → `Synthesize` (chainLlm) ← `Synthesis Model`
  (`anthropic/claude-haiku-4.5` literal — אותו מודל ש-code-agent משתמש בו, ללא placeholder חדש;
  reuse של `@@CRED_OPENROUTER_ID@@`) → `Format Synthesis` (Set: `text||output`→`reply`) →
  `Egress Validation` הקיים (לא נגע).
- `tests/golden/system/MANIFEST.sha256` — רוענן (`check-system-golden.sh --update`); רק hash של
  `agent-router.json` השתנה.

**הוכחה (offline, באותו שלב):** harness ב-node שהריץ את ה-jsCode האמיתי של `Build Dispatch`
ו-`Build Fan-out Items`/`Collect Replies` על fixtures — 23/23 עברו (רב-תחומי→`multi=true`+`intents`
תקין; חד-תחומי→single-pick; זבל→`unknown` graceful; סינון `unknown` מהמערך; מצב לא-מחווט→פריט
סינתטי; מצב מחווט→2 פריטים ops+code; איחוד עם תוויות Operations/Code; נפילת-גיבוי לשאלה המקורית).
`eval_router.py --check`, `check-agent-single-voice.sh`, `check-system-golden.sh` — ירוקים.
ההוכחה ההתנהגותית החיה (טלגרם end-to-end) היא שלב 4 (`/dev-stage-factory`).

## מתזמר עם fan-out מותנה — שלב 2: סנכרון מקור-אמת + אימות חיווט

סנכרון התיעוד/מקור-האמת ליכולת ה-fan-out (תוכן בלבד, בלי שינוי התנהגות), ואימות שהחיווט
בהקמה אינו דורש שינוי.

**Changes:**
- `templates/system/workflows/n8n/agents.manifest.json` — ל-`orchestrator` נוסף שדה `routing`
  המתאר single-pick כברירת-מחדל + ה-fan-out המותנה (Multi Gate → Build Fan-out Items →
  Run Specialists `mode:each` → Collect Replies → Synthesize), כולל הנפילה החיננית וההבהרה
  ש-`unknown` לא משתתף ב-fan-out.
- `templates/system/AGENTS.md.template` — הוזכר ה-fan-out בכותרת "Agent Router" שב-"What was
  provisioned", ונוספה פסקה ייעודית תחת תיאור חמשת תת-הסוכנים.
- `templates/system/templates/n8n/subagent.contract.md` — נוסף סעיף "Multi-intent fan-out
  (the orchestrator, not a composite)" המבחין בין fan-out של המתזמר לבין agent מורכב; חוזה
  תת-הסוכן (executeWorkflowTrigger נכנס, `{reply}` יחיד יוצא) ללא שינוי.
- **אימות חיווט (offline):** כל placeholder שהמתזמר משתמש בו (`@@SUB_*_WF_ID@@`,
  `@@CRED_OPENROUTER_ID@@`, ...) עדיין מכוסה ע"י בלוק ה-sed של הראוטר ב-`configure-agent-router.yml`
  → **אין צורך בשורת sed חדשה** (מודל הסינתיסייזר literal, לא placeholder). `golden` רוענן
  (`MANIFEST.sha256` + `rendered/AGENTS.md`); `eval_router.py --check` ו-`check-agent-single-voice.sh`
  ירוקים (לא הושפעו).

## מתזמר עם fan-out מותנה — שלב 3: נעילת חוזה ה-classifier בבדיקות

נעילת הפורמט החדש של ה-classifier בשער ה-PR הדטרמיניסטי (`eval-agent-router-precheck.yml`),
בלי לגעת בסוללת 250 המקרים.

**Changes:**
- `scripts/eval_router.py` (`validate_prompt`) — נוסף ל-tokens הנדרשים `"intents"` ו-`"multi"`
  (לצד `"intent"`/`"confidence"`/`json`). שובר-חוזה — הסרת הוראת ה-fan-out מהפרומפט — נופל כעת
  אדום כבר ב-PR (offline, ללא סוד). הערה בדוקסטרינג: `"intent"` הוא השדה הראשי העצמאי ואינו
  נתפס בתוך `"intents"`, לכן שניהם נבדקים בנפרד.
- `tests/router_battery.yaml` — **לא שונה** (250 מקרים, 50/מחלקה) → מדד ה-Macro-F1 נשמר;
  `parse_intent` קורא רק את `intent`/`confidence` ולכן השדות החדשים אינם משפיעים על הציון.

**הוכחה (offline, באותו שלב):** `eval_router.py --check` עובר על הקובץ האמיתי; **בדיקה שלילית** —
קובץ-בדיקה זמני שהוסר ממנו `"multi"` (ובנפרד `"intents"`) הפיל את `--check` (exit 1) עם ההודעה
הנכונה — מוכיח שהנעילה תופסת רגרסיה. `router_battery.yaml` לא נגע, `check-agent-single-voice.sh`
ו-`check-system-golden.sh` ירוקים.

## מתזמר עם fan-out מותנה — שלב 4: הוכחה על מערכת-טסט חיה (prove → merge)

הוכחת ה-fan-out **חי** על מערכת-טסט זמנית, לפני הקידום ל-main — השיניים של `/dev-stage-factory`.

**מה נעשה:**
- הוקמה מערכת-טסט חד-פעמית `factory-test-054` ב-reuse mode (`shared_gcp_project=factory-test-25`,
  0 מכסת-GCP): `provision-system.yml` → `register-system-app.yml` → `deploy-railway-cloudflare.yml`
  (n8n 2.25.7 + Caddy + Cloudflare), `/healthz`=200.
- השינוי מענף ה-PR הוחל חי דרך `prove-on-test-system.yml` (זהות ה-sandbox, לא הברוקר): העתקת
  `templates/system/workflows/n8n` → PR + CI + squash-merge בריפו-הטסט עצמו → `configure-agent-router.yml`
  ייבא ופרסם את הראוטר (עם ה-fan-out) + 5 תת-הסוכנים ל-n8n החי.
- **הוכחה חיה** (`probe_endpoint` POST ל-`/webhook/agent-router`): בקשה רב-תחומית (ops+code) החזירה
  `reply` יחיד מאוחד בשני מקטעים (בדיקת שרתים + פונקציית פייתון), ~36ש'; בקשה חד-תחומית (code) החזירה
  תשובת code יחידה, ~12ש'. הפרש הזמן + התוכן מאשרים: fan-out נדלק רק לרב-תחומי, single-pick שלם.

**שינוי תוכנית שתועד:** הריצה הראשונה (שם `or-test-fanout`) נכשלה ב-`deploy` בשלב ה-WIF
(`unauthorized_client` — תנאי ה-CEL של ה-test_pool המשותף מאשר רק `factory-test-*`). הוקמה מחדש
כ-`factory-test-054`. אחרי הקידום מערכת-הטסט פורקה (`decommission-test-system.yml`) + נוקתה שארית
`or-test-fanout` (ראה Teardown ledger בתוכנית הפיתוח).
