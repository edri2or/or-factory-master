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
