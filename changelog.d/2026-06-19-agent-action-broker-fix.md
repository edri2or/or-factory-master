## תיקון צינור ה-broker (agent-action-broker-fix) — שלב 1: סיווג מודע-יכולת

נוריאל לא הצליח לנתב משימת מחקר **קריאה-בלבד** דרך הברוקר. אימות מקצה-לקצה (לוגים גולמיים של
שלוש הריצות + קוד) אישר את שורש הכשל: `scripts/agent-classify.sh` עושה substring-match על טקסט-
המשימה, ומשימת ה-builder *מתארת במילים* את רשימת ה-RED ("...red כולל deploy/provision/secret/
`.github/`...") → נתפס "deploy" → סווג RED → נחסם לאישור Or. אבל החייל (`natan-research`) הוא
קריאה-בלבד (`--allowedTools Read,Grep,Glob`) — פיזית לא יכול לבצע שום פעולת-RED.

**התיקון — סיווג מודע-יכולת:** worker קריאה-בלבד → תקרת-tier אפקטיבית = **yellow** (דילוג על שער
ה-RED, שרק מוסיף חיכוך-שווא). שער ה-RED נשאר פעיל לחלוטין ל-worker כותב עתידי. fail-safe: worker
שלא במפה → ברירת-מחדל `write` → עדיין RED-gated. ללא worker → תאימות-לאחור (ללא cap).

- **`policy/agent-risk-tiers.yml`** — נוסף `default_worker_capability: write` + מפת
  `worker_capabilities:` (`nachshon`/`natan-research`/`sapi-docs` = `read-only`). מקור-אמת יחיד ליכולת.
- **`scripts/agent-classify.sh`** — מקבל worker (arg2 / `WORKER_REPO`); אחרי ה-tier-מתוכן, אם ה-worker
  read-only ו-content_tier=red → effective=yellow. פלט מורחב:
  `{"tier":<effective>,"content_tier":<from-text>,"matched_pattern":…,"worker_capability":…}`.
  ה-`"tier"` הוא הערך שהברוקר מנתב עליו; ה-sed הקיים בברוקר ממשיך לקרוא אותו ללא שינוי.
- **`scripts/test-agent-classify.sh` + `tests/agent-classify-fixtures.yml`** (חדשים) — self-test טהור-bash
  (6 fixtures): משימת-ה-builder + read-only → yellow; אותה משימה + worker לא-במפה → red; פעולת-red
  מפורשת + read-only → yellow; green נשאר green; yellow נשאר yellow; ללא worker → red (תאימות-לאחור).
- **`.github/workflows/pipeline-tests.yml`** — צעד "Agent classifier self-test" ב-job
  "shellcheck + yamllint" (ליד ה-GCP classifier self-test).
- **`.github/workflows/agent-action.yml`** — צעד "Classify" מעביר את `inputs.worker_repo` לקלסיפייר.

**הוכחה תפקודית (שלב 1):** `bash scripts/test-agent-classify.sh` → 6/6 PASS; קריאה ישירה על משימת-
ה-builder האמיתית + `natan-research` → `{"tier":"yellow","content_tier":"red",...}`. shellcheck
(`--severity=error scripts/*.sh`) + yamllint נקיים. factory-only (לא תחת `templates/**`) → אין השפעת golden.

## תיקון צינור ה-broker (agent-action-broker-fix) — שלב 2: תיקון run_id מיושן (שורש כשל 3)

שורש כשל 3 (ה"משימה התחלפה" של נוריאל) אומת כבאג **run_id מיושן בצד-ה-coordinator**, לא חור-אבטחה:
`route_to_agent` קרא `getLatestWorkflowRun` מיד אחרי `workflow_dispatch` (א-סינכרוני) → קיבל את הריצה
ה**קודמת**, וכך כל ספירת ה-run↔corr של נוריאל הוסטה ב-1 (ולכן "v3" הראה את תוכן v2, ו-v1 "הצליח בלי
תוצאה"). אותו דפוס latest-מיושן קיים גם ב-`dispatch_workflow` הכללי שב-`tools.ts`.

- **`services/mcp-server/src/github-client.ts`** — helper טהור חדש `discoverDispatchedRun(getLatest, beforeId, opts)`:
  לוכד baseline לפני dispatch, ואז poll (ברירת-מחדל 6×2ש') עד שמופיעה ריצה ש-`id !== beforeId` —
  הריצה ה**חדשה**, לעולם לא המיושנת; סובלני לשגיאות-רגע; מחזיר null אם רק המיושנת נראתה. `sleep`/`getLatest`
  מוזרקים → ניתן-לבדיקה בלי רשת.
- **`services/mcp-server/src/coordinator-scope.ts`** — `route_to_agent` לוכד `beforeId` לפני ה-dispatch
  ומחזיר את הריצה החדשה דרך ה-helper; note מעודכן כשהריצה עוד לא נראית ("מצא לפי correlation_id / קרא results").
- **`services/mcp-server/src/tools.ts`** — `dispatch_workflow` (אותו באג) עבר לאותו helper עם baseline.
- **`services/mcp-server/test/discover-dispatched-run.test.mjs`** (חדש) — 4 מקרים: מיושן→חדש מחזיר את החדש;
  baseline null → הריצה הראשונה; לא-משתנה → null; שגיאת-רגע → עדיין מוצא את החדש.

**הוכחה תפקודית (שלב 2):** `cd services/mcp-server && npm test` → 138/138 PASS (כולל 4 החדשים + שמירת
ה-exact-set של ה-coordinator 6/6); `tsc` נקי (מאמת את טיפוסיות שלוש העריכות). `COORDINATOR_SCOPED_TOOL_NAMES`
ללא שינוי. אין השפעת golden (קוד-MCP, לא תחת `templates/**`).

## תיקון צינור ה-broker (agent-action-broker-fix) — שלב 3: כשל-רך לכרטיס-אישור גדול מדי

כשמשימת-RED ארוכה מדי לכרטיס-טלגרם, `agent-approval.ts` מחזיר HTTP 413 `task_too_large_for_card`,
וה-step "Send Telegram approval card" ב-`agent-action.yml` עשה `exit 1` — הריצה נפלה **ו-Or לא קיבל
שום הודעה** (כשל שקט). מעכשיו הכישלון רועש: Or מקבל הודעת-טלגרם ברורה.

- **`scripts/notify-card-failure.sh`** (חדש) — מקבל `<corr> <http_code> [reason]`, מרכיב הודעת-עברית אחת
  (שם ה-corr; ל-`task_too_large_for_card` → "ארוכה מדי — קצר/פצל"; אחרת מצרף את הסיבה; תמיד "לא נכנסה
  לתור"), מדפיס ללוג, ואם יש creds — שולח דרך בוט-הטלגרם. רך (`exit 0` תמיד; הוורקפלו עושה את ה-exit הקשה).
  זו ההתראה האנושית המותאמת, **בנפרד** מה-Telegram הגנרי של `emit-event.sh` (כדי למנוע שליחה-כפולה — אותה
  הפרדה כמו ב-`workspace-token-audit.yml`).
- **`scripts/tests/notify-card-failure.bats`** (חדש) — מקפיא `curl` ב-PATH ובודק 3 מקרים: 413 → הודעה עם
  ה-corr + "ארוכה מדי" וקריאת curl ל-`…/bot<token>/sendMessage`; בלי creds → נרשם ללוג, curl לא נקרא, exit 0;
  סיבה גנרית → מצורפת. נאסף אוטומטית ע"י `bats scripts/tests/*.bats` ב-Playground.
- **`.github/workflows/agent-action.yml`** — ענף הכישלון של ה-step קורא את ה-creds מ-SM (ה-step כבר מאומת),
  קורא ל-`notify-card-failure.sh`, פולט `factory.agent_action.card_failed` ב-`severity=info`
  (Axiom-בלבד → בלי Telegram כפול / רעש-Linear), ואז `exit 1` (הריצה האדומה כנה — העבודה לא נכנסה לתור).

**הוכחה תפקודית (שלב 3):** `bats scripts/tests/notify-card-failure.bats` → 3/3; כל חבילת ה-bats → 224/224;
shellcheck (`--severity=error scripts/*.sh`) + yamllint נקיים. (נתיב ה-413→Telegram החי דורש worker כותב עם
משימה ענקית — לא קיים אחרי Fix 1; הענף מוכח ביחידת-bats + lint, ונתיב-ההצלחה לא השתנה.)

## תיקון צינור ה-broker (agent-action-broker-fix) — שלב 4: הקשחת קשירת correlation_id בברוקר

הליבה הלגיטימית של "כשל 3" (קשירה מקצה-לקצה). ב-step "Broker the work" של `agent-action.yml` גילוי
ריצת-ה-worker לקח `.[0]` של הריצות (לא קשור ל-corr), וההורדה נפלה ל-`find dl -name '*.json' | head -1` —
כך ששני dispatch מקבילים לאותו worker יכלו לכתוב תוצאה של משימה אחת תחת שם של אחרת. הוקשח בשתי שכבות:

- **(א) גילוי-ריצה high-water-mark:** לוכדים את ה-run-id האחרון של ה-worker **לפני** ה-dispatch (`BEFORE_RID`),
  ובוחרים את הריצה החדשה ביותר עם `databaseId > BEFORE_RID` (run-ids מונוטוניים → הריצה החדשה היא הראשונה
  מעל הסף, לעולם לא ריצה קודמת/מקבילה). `export GH_TOKEN` הוקדם כדי לקרוא את ה-baseline.
- **(ב) הורדה corr-strict** — **`scripts/select-result-file.sh`** (חדש): דורש בדיוק `dl/<corr>.json`
  (ה-worker כבר ממנה `result/<corr>.json`); הוסר ה-fallback ל"json הראשון". קובץ-corr חסר = כישלון **רועש**,
  לעולם לא כתיבה שגויה — גם אם הגילוי תפס בטעות ריצה אחרת, אסור שתיכתב תוצאה לא-תואמת.
- **`scripts/tests/select-result-file.bats`** (חדש) — 5 מקרים, כולל **רק `bbb.json` + corr=aaa → נכשל**
  (מקרה אנטי-אי-ההתאמה), ושמירת ה-corr כשיש json נוסף-רעש.

**הוכחה תפקודית (שלב 4):** `bats scripts/tests/select-result-file.bats` → 5/5; כל חבילת bats → 229/229;
לוגיקת ה-jq של ה-high-water אומתה עצמאית (ריצה חדשה→מוחזרת; אין-חדשה→empty/ממשיך לסקור; אין-קודמת→החדשה ביותר;
baseline ריק→0); shellcheck + yamllint נקיים. שכבה (ב) — ערובת-הנכונות (לעולם לא תוצאה לא-תואמת) — מוכחת ב-bats;
שכבה (א) נבדקת חי בשלב 5.

## תיקון צינור ה-broker (agent-action-broker-fix) — שלב 5: תיעוד + קבלה live + סגירה

- **`docs/agent-repo-product.md`** — עודכן לארבעת התיקונים: cap מודע-יכולת (read-only → תקרת yellow,
  עם `content_tier`/`worker_capability`), כשל-רך לכרטיס-413 (Telegram אנושי + emit info), וקשירת
  correlation_id בברוקר (גילוי high-water + הורדה corr-strict ללא fallback). שורת ה-MVP על false-positive
  עודכנה. (שינוי-דוק וולונטרי; שער ה-binding לא נדרס — הוא חד-כיווני: artifact→doc, לא doc→artifact.)
- **קבלה live (post-merge) — ✅ עברה:** #538 מוזג ל-main (squash 421724a); `deploy-mcp-server.yml`
  (run 27805830546) הסתיים בהצלחה. דיספאצ' חי של משימת מחקר קריאה-בלבד שמזכירה "deploy" ל-`natan-research`
  (run 27805997979, corr=`broker-fix-accept-1`): הלוג מראה
  `classifier: {"tier":"yellow","content_tier":"red","matched_pattern":"deploy","worker_capability":"read-only"}`,
  כרטיס-ה-RED **דולג**, "Broker the work" רץ, גילוי high-water (`BEFORE_RID=27801114839` → ריצה חדשה `27806011943`),
  הורדה corr-strict, ו-`PASS: wrote result to edri2or/nuriel/results/broker-fix-accept-1.json` (התוכן אומת — נכון).
  בדיוק מקרה-האירוע שחסם את נוריאל — עכשיו נוסע. Fixes 1+4 מוכחים live; Fix 3 מוכח-יחידה + ה-MCP נפרס;
  Fix 2 מוכח-יחידה (נתיב ה-413 החי דורש worker כותב, שלא קיים).
