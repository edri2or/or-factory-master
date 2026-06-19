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
