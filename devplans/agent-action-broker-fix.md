---
dev_name: תיקון צינור ה-broker (agent-action)
slug: agent-action-broker-fix
opened: 2026-06-19
status: active
---

# תוכנית פיתוח — תיקון צינור ה-broker (agent-action)

## מטרה

נוריאל לא הצליח לנתב משימת מחקר קריאה-בלבד דרך הברוקר. אימתתי מקצה-לקצה (לוגים גולמיים + קוד)
ומצאתי 3 כשלים אמיתיים + סיכון-נכונות אחד. מתקנים את הצינור כך שמשימת קריאה-בלבד לא תיחסם
לשווא, כישלון-כרטיס לא יהיה שקט, ומספרי-המעקב והתוצאות יהיו קשורים נכון לכל בקשה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | סיווג מודע-יכולת (Fix 1) | completed | `policy/agent-risk-tiers.yml`, `scripts/agent-classify.sh`, `scripts/test-agent-classify.sh`, `tests/agent-classify-fixtures.yml`, `.github/workflows/pipeline-tests.yml`, `.github/workflows/agent-action.yml` |
| 2 | תיקון run_id ב-coordinator (Fix 3) | completed | `services/mcp-server/src/github-client.ts`, `coordinator-scope.ts`, `tools.ts`, `services/mcp-server/test/*` |
| 3 | כשל-רך + טלגרם לכרטיס גדול (Fix 2) | completed | `scripts/notify-card-failure.sh`, `.github/workflows/agent-action.yml`, `scripts/tests/*.bats` |
| 4 | קשירת correlation_id בברוקר (Fix 4) | completed | `scripts/select-result-file.sh`, `.github/workflows/agent-action.yml`, `scripts/tests/*.bats` |
| 5 | קבלה live + תיעוד + סגירה | pending | `docs/agent-repo-product.md`, devplan, changelog |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה pre/post-merge:** `agent-action.yml` רץ רק על `main` וה-MCP נטען-מחדש רק אחרי push ל-main.
> לכן שלבים 1–4 מוכיחים כל לבנה בבדיקות דטרמיניסטיות (CI/locally, pre-merge); שלב 5 הוא קבלת-אינטגרציה
> live (post-merge, Or-gated). כל לבנה מוכחת בשלב שלה — שלב 5 רק מאשר את החיבור.

---

### שלב 1 — סיווג מודע-יכולת (Fix 1)

**Acceptance:**
- [x] `policy/agent-risk-tiers.yml` כולל `worker_capabilities:` + `default_worker_capability: write`
- [x] `scripts/agent-classify.sh` מקבל worker; read-only → תקרת tier = yellow; פלט כולל `content_tier` + `worker_capability`; ללא worker = תאימות-לאחור (ללא cap)
- [x] `agent-action.yml` מעביר `$WORKER` לקלסיפייר
- [x] `scripts/test-agent-classify.sh` + fixtures ירוקים, מחווטים ל-`pipeline-tests.yml`

**הוכחה תפקודית (באותו שלב):** הרצת `bash scripts/test-agent-classify.sh` על fixtures: (א) משימת
ה-builder האמיתית + worker=`natan-research` → `tier=yellow` (לא red); (ב) אותה משימה + worker כותב
היפותטי → `tier=red`; (ג) משימת "delete the production secret" + read-only worker → yellow (content_tier=red,
capped). פלט מצופה מודפס ונבדק.

**הוכחת E2E (artifact):** לא-התנהגותי (אינו נוגע ב-`workflows/n8n/*.json`/`configure-agent-router.yml`).

**הערת התקדמות אחרונה:** ✅ הושלם 2026-06-19. self-test 6/6 PASS (כולל מקרה-האירוע: builder+natan-research→yellow,
ו-fail-safe: worker-לא-במפה→red). קריאה ישירה על משימת-ה-builder האמיתית החזירה `{"tier":"yellow","content_tier":"red",...}`.
shellcheck (`--severity=error scripts/*.sh`) + yamllint (כל ה-workflow dirs) נקיים. ממתין ל-CI על ה-PR.

**שינוי תוכנית:** —

---

### שלב 2 — תיקון run_id ב-coordinator (Fix 3)

**Acceptance:**
- [x] helper טהור `discoverDispatchedRun(getLatest, beforeId, opts)` ב-`github-client.ts`
- [x] `route_to_agent` לוכד `beforeId` לפני dispatch ומחזיר רק ריצה חדשה (`id !== beforeId`)
- [x] אותו helper מוחל על `tools.ts` `dispatch_workflow`
- [x] `COORDINATOR_SCOPED_TOOL_NAMES` ללא שינוי (exact-set test ירוק)

**הוכחה תפקודית (באותו שלב):** node unit test ל-`discoverDispatchedRun`: getLatest מחזיר תחילה beforeId
ואז newId → ה-helper מחזיר newId; getLatest שלא משתנה → מחזיר null. `npm test` ירוק (כולל exact-set).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם 2026-06-19. `npm test` → 138/138 PASS (4 חדשים ל-discoverDispatchedRun
+ exact-set של coordinator 6/6); `tsc` נקי. שני call-sites (coordinator route_to_agent + tools.ts dispatch_workflow)
עברו ל-helper המשותף עם baseline לפני dispatch. ממתין ל-CI על ה-PR.

**שינוי תוכנית:** —

---

### שלב 3 — כשל-רך + טלגרם לכרטיס גדול (Fix 2)

**Acceptance:**
- [x] `scripts/notify-card-failure.sh` בונה הודעת-טלגרם ברורה (corr + סיבה) ושולח דרך bot-token
- [x] `agent-action.yml` קורא לו כש-POST לכרטיס מחזיר non-200, מוסיף `emit-event --severity=info` (Axiom-בלבד), ואז `exit 1`
- [x] bats test ירוק

**הוכחה תפקודית (באותו שלב):** bats עם curl-מוקפא: קלט (corr, reason, bot, chat) → ההודעה מורכבת
נכון (מכילה את ה-corr ואת ה-reason), curl נקרא עם ה-URL הנכון. (הסקריפט עצמו רך `exit 0`; ה-exit≠0 נעשה
בוורקפלו אחרי הקריאה — הופרד כדי שהשליחה לעולם לא תפיל את הריצה.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם 2026-06-19. bats notify-card-failure 3/3; כל חבילת bats 224/224; shellcheck+yamllint נקיים.
ענף-הכישלון: notify-card-failure.sh (Telegram אנושי) + emit info (Axiom-audit, בלי Telegram כפול) + exit 1. ממתין ל-CI.

**שינוי תוכנית:** —

---

### שלב 4 — קשירת correlation_id בברוקר (Fix 4)

**Acceptance:**
- [x] `scripts/select-result-file.sh`: dl-dir + corr → מחזיר `dl/<corr>.json` או נכשל (ללא fallback ל-json הראשון)
- [x] `agent-action.yml` לוכד high-water-mark של ריצות ה-worker ובוחר ריצה חדשה (id>before) במקום `.[0]`
- [x] `agent-action.yml` משתמש ב-`select-result-file.sh` במקום ה-fallback
- [x] bats test ירוק

**הוכחה תפקודית (באותו שלב):** bats ל-`select-result-file.sh`: dir עם רק `B.json` + CORR=A → נכשל
(קוד≠0); dir עם `A.json` → מודפס הנתיב הנכון. (גילוי-ריצה ה-high-water-mark נבדק חי בשלב 5.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם 2026-06-19. bats select-result-file 5/5; כל חבילת bats 229/229; לוגיקת ה-jq של
ה-high-water אומתה עצמאית; shellcheck+yamllint נקיים. שתי שכבות: גילוי id>BEFORE_RID + הורדה corr-strict (בלי fallback). ממתין ל-CI.

**שינוי תוכנית:** —

---

### שלב 5 — קבלה live + תיעוד + סגירה

**Acceptance:**
- [ ] `docs/agent-repo-product.md` מתאר: cap מודע-יכולת, כשל-רך לכרטיס, תיקון run_id
- [ ] (post-merge) `deploy-mcp-server.yml` רץ והסתיים בהצלחה
- [ ] ניתוב-מחדש live של משימת קריאה-בלבד → classifier=yellow, worker רץ, תוצאה ל-`nuriel/results/<corr>.json`, run_id נכון
- [ ] devplan `status: completed`, changelog fragment מלא

**הוכחה תפקודית (באותו שלב):** ריצת `agent-action.yml` חיה על משימת מחקר קריאה-בלבד אמיתית: בלוג —
`classifier: {"tier":"yellow",...}` (לא red), "Broker the work" רץ, תוצאה נכתבת, וה-run_id ש-route_to_agent
החזיר תואם את הריצה שבאמת רצה. Or-gated (dispatch live זול).

**הוכחת E2E (artifact):** לא-התנהגותי (הצינור הוא broker/MCP, לא בוט-n8n).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — מעכשיו, סוכן קריאה-בלבד לא ייחסם לאישור שלך סתם בגלל מילה "מסוכנת" בטקסט. שער-האישור נשמר לסוכנים שבאמת כותבים/בונים.
- שלב 2 הושלם — תיקנו את "מספר-המעקב הקודם". מעכשיו נוריאל תמיד מקבל את המספר של הריצה הנכונה, אז הוא לא יתבלבל יותר בין משימות.
- שלב 3 הושלם — אם משימה גדולה מדי לכרטיס-האישור, מעכשיו תקבל הודעת-טלגרם ברורה במקום שהכל ייפול בשקט בלי שתדע.
- שלב 4 הושלם — הברוקר חוזק כך שלעולם לא יכתוב תוצאה של משימה אחת תחת שם של אחרת, גם אם שתי משימות רצות בו-זמנית. כל ארבעת התיקונים בקוד הושלמו.
