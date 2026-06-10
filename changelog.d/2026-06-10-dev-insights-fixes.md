## תיקוני dev-insights (מהפיתוח async-deep-research)

### שער-CI: executeWorkflow-published gate (factory-only)

- **`scripts/check-executeworkflow-published.sh`** (חדש) — שער סטטי שמונע הישנות של באג ה-publish
  שתפסנו חי (factory-test-053): ב-n8n 2.x workflow מפורסם שקורא לתת-workflow דרך `executeWorkflow`
  (חיבור ראשי) לא יתפרסם אם התת מותקן לא-מפורסם (HTTP 400 → השער נשאר כבוי בשקט). השער אוסף את כל
  ה-`executeWorkflow` placeholders מ-`$WF_DIR/*.json`, ממפה כל אחד למשתנה ה-shell דרך ה-`s#@@…@@#${VAR}#g`
  של `configure-agent-router.yml`, ונכשל אם המשתנה מותקן ב-`_upsert_wf … no`. תתי-`toolWorkflow`
  (ai_tool, למשל `request_write_action`) **פטורים** — לא נאספים. רובוסטי ללולאת-הסוכנים (אין assignment
  ישיר → אין `no` → PASS). תומך `${VAR}` ו-`${VAR:-}`.
- **`scripts/tests/check-executeworkflow-published.bats`** (חדש) — 5 מקרים: PASS על התבנית; FAIL כשתת
  נקרא-executeWorkflow מותקן `no`; FAIL על placeholder בלי מיפוי sed; PASS שתת-toolWorkflow לא-מפורסם
  לא מסומן; PASS על תיקייה ריקה.
- **`.github/workflows/playground-tests.yml`** — צעד "executeWorkflow-published gate (mould)" אחרי
  ה-single-voice gate, מריץ על `templates/system/workflows/n8n` מול ה-configure של התבנית.
- Scope: factory-only (לא נשלח למערכות, אין golden/provision churn). אומת מקומית: PASS על התבנית
  (9 קריאות executeWorkflow), FAIL על שתי בדיקות-נגד, shellcheck נקי, 5/5 BATS ירוקים.

### SessionStart hook: התקנת envsubst

- **`.claude/hooks/session-start.sh`** — נוסף בלוק התקנת `gettext-base` (`envsubst`, חבילת-בסיס דרך apt)
  שרינדור ה-golden (`scripts/render-system-golden.sh` + `scripts/tests/validate-templates.sh`) דורש —
  מסיר חיכוך של "envsubst: command not found" בכל סשן web. כותרת-הדוק וה-echo הסופי עודכנו.
