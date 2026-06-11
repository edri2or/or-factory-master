---
dev_name: מתזמר עם fan-out מותנה — ניתוב רב-תחומי
slug: router-multi-intent-fanout
opened: 2026-06-11
status: active
---

# תוכנית פיתוח — מתזמר עם fan-out מותנה (ניתוב רב-תחומי)

## מטרה

כל מערכת חדשה מהפקטורי כבר נולדת עם מתזמר קול-יחיד (Agent Router). כאן מוסיפים למתזמר
יכולת אחת ויחידה: כשבקשה נוגעת ב**כמה תחומים בו-זמנית**, המתזמר ירוץ אל המומחים
ה*רלוונטיים* (לא כולם — רק הרלוונטיים) ויאחד את תשובותיהם ל**תשובה אחת**. בקשות של
תחום-אחד ממשיכות בדיוק כמו היום. **רק מוסיפים** — לא נוגעים בקול-היחיד (`tg-inbound`),
בתת-הסוכנים (`*-agent.json`), או בשער ה-CI לקול-יחיד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מסלול fan-out מותנה במתזמר | completed | `templates/system/workflows/n8n/agent-router.json`, `tests/golden/system/**` |
| 2 | סנכרון מקור-אמת + אימות חיווט | completed | `agents.manifest.json`, `AGENTS.md.template`, `subagent.contract.md`, `tests/golden/system/**` |
| 3 | נעילת חוזה ה-classifier בבדיקות | pending | `scripts/eval_router.py` |
| 4 | הוכחה על מערכת-טסט חיה → קידום → teardown | pending | (הקמה/הרצה חיה — ללא שינוי קוד) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה שלו עובדת על קלט אמיתי *באותו שלב*, ברמה
> שבה הלבנה פועלת (שלבים 1–3 הם תבנית/בדיקות — הוכחה offline; שלב 4 הוא ההוכחה ההתנהגותית
> החיה, וזה התפקיד המתוכנן שלו לפי `/dev-stage-factory`, לא דחייה).

---

### שלב 1 — מסלול fan-out מותנה במתזמר (שינויי המחקר 1–4)

**Acceptance:**
- [x] `Classify Intent` פולט בנוסף `intents[]`+`multi` (אדיטיבי; שומר את `{"intent","confidence","entity_mention"}` מילה-במילה — הטוקנים `"intent"`/`"confidence"`/`json` נשארים).
- [x] `Build Dispatch` מפענח `intents[]`+`multi` עם נפילה חיננית (כשל פענוח / <2 תחומים → `multi=false`).
- [x] 7 צמתים חדשים + דלתות-חיווט נוספו: `Multi Gate`, `Build Fan-out Items`, `Run Specialists`, `Collect Replies`, `Synthesize`, `Synthesis Model`, `Format Synthesis`. הקול והמומחים לא נגעו (node count 19→26; `Route by Intent` עדיין 5 פלטים).
- [x] `Multi Gate` קורא `multi` מ-`$('Build Dispatch')` (כי `Resolve Entity` מפיל את השדה).
- [x] לא נוסף placeholder חדש (משתמשים ב-`@@SUB_*_WF_ID@@` + `@@CRED_OPENROUTER_ID@@`; מודל הסינתיסייזר literal).
- [x] golden עודכן (`scripts/check-system-golden.sh --update`; רק hash של agent-router.json זז).
- [ ] CI ירוק: Changelog gates, Playground tests, Battery + prompt precheck, shellcheck+yamllint, secret-scan, supply-chain. *(נאמת אחרי push + פתיחת PR)*

**הוכחה תפקודית (באותו שלב):** harness ב-node שהריץ את ה-jsCode *האמיתי* של `Build Dispatch`,
`Build Fan-out Items` ו-`Collect Replies` על fixtures — **23/23 עברו**: רב-תחומי→`multi=true`+`intents`
תקין; חד-תחומי→single-pick; זבל→`unknown` graceful; סינון `unknown` מהמערך; מצב לא-מחווט→פריט
סינתטי (לא נתקע); מצב מחווט→2 פריטים ops+code; איחוד עם תוויות Operations/Code (index-pairing);
נפילת-גיבוי לשאלה המקורית כשכל התשובות ריקות. בנוסף `jq` אישר 7 צמתים + חיווט, ו-
`eval_router.py --check` / `check-agent-single-voice.sh` / `check-system-golden.sh` ירוקים.
(ההוכחה ההתנהגותית החיה — שלב 4.)

**הערת התקדמות אחרונה:** ✅ הקוד יושם ואומת offline (23/23 + כל השערים הסטטיים ירוקים מקומית).
נותר לאמת CI אחרי push, ואז להמשיך לשלב 2.

**שינוי תוכנית:** —

---

### שלב 2 — סנכרון מקור-אמת + אימות חיווט (שינויי המחקר 5–6)

**Acceptance:**
- [x] `configure-agent-router.yml` נבדק — אין צורך בשורת `sed` חדשה (אומת תוכנתית: כל placeholder שהמתזמר משתמש בו מכוסה ע"י בלוק ה-sed של הראוטר).
- [x] `agents.manifest.json` — ל-orchestrator נוסף שדה `routing` שמתאר את ה-fan-out המותנה.
- [x] `templates/system/AGENTS.md.template` — הערה בכותרת + פסקה ייעודית על ה-fan-out הרב-תחומי.
- [x] `templates/system/templates/n8n/subagent.contract.md` — סעיף חדש (orchestrator fan-out ≠ composite).
- [x] golden עודכן (`MANIFEST.sha256` + `rendered/AGENTS.md`). CI — נאמת אחרי push.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד/מקור-אמת) + אימות סטטי: `jq` על המניפסט (valid),
`check-system-golden` ירוק, ואימות תוכנתי שכל placeholder ב-agent-router.json עדיין מכוסה ע"י
בלוק ה-sed של הראוטר ב-`configure-agent-router.yml` (אין placeholder חדש → אין שורת sed חדשה).

**הערת התקדמות אחרונה:** ✅ הושלם ואומת offline. נותר לאמת CI אחרי push, ואז שלב 3.

**שינוי תוכנית:** —

---

### שלב 3 — נעילת חוזה ה-classifier בבדיקות (שינוי המחקר 7) + השלמת golden (8)

**Acceptance:**
- [ ] `scripts/eval_router.py` (`validate_prompt`) נועל גם `"intents"`+`"multi"` בפרומפט (חוזה חדש, offline, ללא סוד, שער PR).
- [ ] `tests/router_battery.yaml` **לא** שונה (נשמר 250/50-לכל-מחלקה → מדד Macro-F1 שלם).
- [ ] `check-agent-single-voice.sh` עובר ללא שינוי. golden מאומת בסנכרון (ללא `--update`).
- [ ] CI ירוק.

**הוכחה תפקודית (באותו שלב):** `python3 scripts/eval_router.py --check` עובר עם הנעילה החדשה;
ובדיקה שלילית — שינוי זמני שמסיר `"multi"` מהפרומפט גורם ל-`--check` ליפול (מוכיח שהנעילה תופסת רגרסיה),
ואז החזרה.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — הוכחה על מערכת-טסט חיה → קידום → teardown ledger (השיניים של /dev-stage-factory)

**Acceptance:**
- [ ] **אישור Or מפורש** לפני המהלך הכרוך בעלות (מערכת זמנית ב-Railway + DNS; 0 מכסת-GCP).
- [ ] הוקמה מערכת-טסט חד-פעמית ב-reuse mode (`shared_gcp_project=factory-test-25`).
- [ ] השינוי מהענף הוחל חי דרך `prove-on-test-system.yml` (`ref=<branch>`, `post_apply_workflow=configure-agent-router.yml`).
- [ ] הוכחה חיה: (א) הודעה חד-תחומית עדיין single-pick; (ב) הודעה רב-תחומית → fan-out → תשובה אחת מאוחדת.
- [ ] קידום = מיזוג ל-main; מעקב אחרי `eval-agent-router.yml` (Macro-F1 ≥ 0.85) — fix-forward אם צריך.
- [ ] שורת Teardown ledger נרשמה (torn-down / left-alive by user decision).

**הוכחה תפקודית (באותו שלב):** שתי הלוך-ושוב אמיתיות בטלגרם על המערכת החיה (לעיל) + `probe_endpoint`
(`/healthz`, ה-UI). איטרציה fix→apply→verify עד ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

<!-- שורה חיה אחת: torn-down — <date/session> | left-alive by user decision — <date/session>. מתמלא בשלב 4. -->

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הוספנו למתזמר מסלול שמזהה בקשה רב-תחומית, מריץ את המומחים הרלוונטיים ומאחד את תשובותיהם לתשובה אחת. בקשות רגילות ממשיכות כרגיל. בדקנו את הלוגיקה על דוגמאות (23 מתוך 23 עברו).
- שלב 2 הושלם — עדכנו את התיעוד הפנימי שיתאר את היכולת החדשה, ואימתנו שההתקנה האוטומטית של המערכת לא צריכה שום שינוי כדי לתמוך בזה. בלי שינוי התנהגות.
