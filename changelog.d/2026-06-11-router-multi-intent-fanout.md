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
