---
dev_name: טלמטריה חיה ל-ops-agent (GitHub + Railway, read-only)
slug: ops-agent-live-telemetry
opened: 2026-05-30
status: active
---

# תוכנית פיתוח — טלמטריה חיה ל-ops-agent

## מטרה

מוסיפים ל-ops-agent של מערכת שהפקטורי מקים יכולת לקרוא מידע **חי, read-only** משני
מקורות: **GitHub** (CI runs, commits, open PRs לריפו של המערכת) ו-**Railway** (סטטוס
deploy + לוגים אחרונים) — במקום להישען רק על `SYSTEM_INFO_JSON` הסטטי. סקופ: **תבנית
בלבד** (`templates/system/...` + שינוי נקודתי אחד בריפו הפקטורי); מערכת חדשה שתוקם אחרי
השינוי מקבלת את היכולת, אף מערכת קיימת לא נוגעים בה. GCP מחוץ לסקופ (גל נפרד).

**כללי ברזל:** read-only מוחלט; כל ענף כשל חדש ב-`configure-agent-router.yml` הוא soft-fail
(`exit 0`) עם אזהרה בעברית; graceful degradation (secret חסר → מורידים את הכלי ב-jq);
שום ערך סודי בתוך workflow JSON (רק credential ids / placeholders); ה-GitHub token הוא
opaque — בלי אורך/regex קבוע.

## עובדות-יסוד מהקוד החי (אומתו בחקירה)

- **תבנית לחיקוי:** `postgres-named-queries.json` — `executeWorkflowTrigger` → `Normalize
  Input` (Code, מחלץ string גולמי מ-`$json.query` בכמה נתיבים) → `Switch` → ענפים →
  `Format Output`. הכלי ב-agent הוא `toolWorkflow` עם `specifyInputSchema:false`.
- **ops-agent.json:** נוד `Ops Agent` (`@n8n/n8n-nodes-langchain.agent`), שני כלים מחוברים
  ב-`ai_tool` index 0. נוסיף `@@WF_GITHUB_READONLY_ID@@` + `@@WF_RAILWAY_READONLY_ID@@`.
- **agent-router.json:** נוד `Egress Validation` — `const ALLOW =
  /(^|\.)(or-infra\.com|openrouter\.ai|n8n\.io)$/i;`. נרחיב **רק** את ה-regex.
- **configure-agent-router.yml:** עוזרי `_sm_read`/`_napi`/`_upsert_wf`, יצירת credentials
  (find-by-name → POST), התקנת postgres-named-queries לפני לולאת הסוכנים → `PG_NAMED_WF_ID`,
  הזרקת `sed`, strip ב-`jq`, ו-`_soft_exit0`. Railway secrets כבר נקראים.
- **token מ-n8n:** `generate-app-token.sh` לא נגיש בזמן ריצת n8n → JWT נחתם בתוך n8n (נוד
  JWT מובנה + credential PEM). App-id/installation-id → placeholders; private key → credential id.
- **register-system-app.yml:** שורה ~229 `APP_PERMISSIONS_JSON` (בלי `pull_requests`).
- **CI per-stage:** Playground = actionlint + shellcheck(-S error) על YAML + BATS +
  `validate-templates.sh` (קבצי n8n `.json` לא נבדקים שם → `jq .` ידני). + שער changelog
  (פתק `changelog.d/2026-05-30-ops-agent-live-telemetry.md`) + שער devplan.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | `railway-readonly.json` — sub-workflow חדש (deploy_status / recent_logs) | pending | `templates/system/workflows/n8n/railway-readonly.json` |
| 2 | `github-readonly.json` — sub-workflow חדש (ci_runs / recent_commits / open_prs) + JWT mint | pending | `templates/system/workflows/n8n/github-readonly.json` |
| 3 | חיווט ל-`ops-agent.json` — שני כלי toolWorkflow + systemMessage | pending | `templates/system/workflows/n8n/ops-agent.json` |
| 4 | התקנה ב-`configure-agent-router.yml` — creds + install + sed + graceful degradation | pending | `templates/system/.github/workflows/configure-agent-router.yml` |
| 5 | הרשאת PRs + הרחבת Egress allow-list | pending | `.github/workflows/register-system-app.yml`, `templates/system/workflows/n8n/agent-router.json` |
| 6 | תיעוד מערכת — CHANGELOG של התבנית + AGENTS.md.template | pending | `templates/system/CHANGELOG.md`, `templates/system/changelog.d/`, `templates/system/AGENTS.md.template` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`. כל שלב = commit אחד ל-PR,
> כולל עדכון התוכנית + פתק ה-changelog של הפקטורי, ועוצר לאישור Or לפני השלב הבא.

---

### שלב 1 — railway-readonly.json

`toolWorkflow` חדש בשם `factory-master: railway-readonly`, במבנה של postgres-named-queries.

**Acceptance:**
- [ ] `jq . railway-readonly.json` עובר.
- [ ] `executeWorkflowTrigger` → `Normalize Input` (Code, string גולמי; `deploy_status` |
      `recent_logs`, דפוס חילוץ defensive כמו postgres) → `Switch`.
- [ ] ענף `deploy_status`: HTTP POST ל-`https://backboard.railway.com/graphql/v2` עם status
      query, משתנה `{pid:"@@RAILWAY_PROJECT_ID@@"}`, auth דרך credential Bearer (`@@CRED_RAILWAY_ID@@`).
- [ ] ענף `recent_logs`: resolve של deployment id אחרון → POST של `deploymentLogs`.
- [ ] `Format Output` (Code) → `{ ok, command, data }`, משאיר `staticUrl`/URLs.
- [ ] שום ערך סודי ב-JSON — רק `@@RAILWAY_PROJECT_ID@@` + `@@CRED_RAILWAY_ID@@`.
- [ ] Playground ירוק (JSON בלבד).

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

### שלב 2 — github-readonly.json

`toolWorkflow` חדש בשם `factory-master: github-readonly`, אותו שלד + שלב הנפקת token.

**Acceptance:**
- [ ] `jq . github-readonly.json` עובר.
- [ ] `Normalize Input` (string גולמי; `ci_runs` | `recent_commits` | `open_prs`) → `Switch`.
- [ ] שלב mint משותף: JWT RS256 (iat≈now−60s, exp≤10ד', iss=App ID) דרך נוד JWT מובנה עם
      credential PEM (`@@CRED_GITHUB_JWT_ID@@`) → POST ל-
      `/app/installations/@@GITHUB_INSTALLATION_ID@@/access_tokens` → token לשעה.
- [ ] caching ב-`$getStaticData('github_token_cache')` לפי expiry (refresh ~5ד' לפני פקיעה);
      token כ-opaque (בלי אורך/regex קבוע).
- [ ] כל ענף קורא ל-REST עם `owner=edri2or`, `repo=@@SYSTEM_NAME@@`:
      `actions/runs?per_page=10` / `commits?per_page=10` / `pulls?state=open&per_page=10`.
- [ ] `Format Output` → `{ ok, command, data }`, משאיר `html_url`.
- [ ] private key אף פעם לא ב-JSON — רק credential id. placeholders: `@@SYSTEM_NAME@@`,
      `@@GITHUB_APP_ID@@`, `@@GITHUB_INSTALLATION_ID@@`, `@@CRED_GITHUB_JWT_ID@@`.
- [ ] Playground ירוק (JSON בלבד).

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

### שלב 3 — חיווט ל-ops-agent.json

**Acceptance:**
- [ ] שני נודי `@n8n/n8n-nodes-langchain.toolWorkflow`: `github_readonly`
      (`@@WF_GITHUB_READONLY_ID@@`) + `railway_readonly` (`@@WF_RAILWAY_READONLY_ID@@`), כל אחד
      עם `description` שמסביר ל-LLM איזו פקודת-string לשלוח ומתי.
- [ ] שניהם מחוברים ל-`Ops Agent` ב-`ai_tool` (אותה צורה כמו `postgres_named_query`).
- [ ] `systemMessage` עודכן: מתאר את שני הכלים + הפקודות, ומציין שמותר להחזיר קישורי
      GitHub/Railway ישירים.
- [ ] `jq . ops-agent.json` עובר. Playground ירוק.

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

### שלב 4 — configure-agent-router.yml (creds + install + graceful degradation)

מראה את לוגיקת ההתקנה של postgres-named-queries לשני ה-sub-workflows החדשים.

**Acceptance:**
- [ ] קריאת secrets: `github-app-id`/`github-app-private-key`/`github-app-installation-id`
      (Railway כבר נקרא).
- [ ] יצירת credentials (find-by-name → POST): Bearer ל-Railway → `CRED_RAILWAY_ID`;
      PEM ל-JWT של GitHub → `CRED_GITHUB_JWT_ID`.
- [ ] התקנת `railway-readonly.json` + `github-readonly.json` **לפני** לולאת הסוכנים עם
      `_upsert_wf`, לכידת `WF_RAILWAY_READONLY_ID` + `WF_GITHUB_READONLY_ID`, והזרקת placeholders
      ב-`sed` (`@@RAILWAY_PROJECT_ID@@`/`@@SYSTEM_NAME@@`/`@@GITHUB_APP_ID@@`/`@@GITHUB_INSTALLATION_ID@@`).
- [ ] בלולאת הסוכנים: `sed` מזריק את שני ה-WF ids ל-ops-agent.
- [ ] graceful degradation (jq strip): GitHub App secrets חסרים → לא מתקינים github-readonly +
      מורידים את נוד `github_readonly` + ה-connection מ-ops-agent. אותו דבר ל-Railway.
- [ ] כל ענף כשל חדש = soft-fail `exit 0` עם אזהרה בעברית ל-`$GITHUB_STEP_SUMMARY` + שורות summary.
- [ ] actionlint + shellcheck(-S error) + yamllint עוברים (Playground ירוק).

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

### שלב 5 — הרשאת PRs + הרחבת Egress

**Acceptance:**
- [ ] `.github/workflows/register-system-app.yml`: הוספת `"pull_requests":"read"` ל-
      `APP_PERMISSIONS_JSON` + הערה שמערכת קיימת דורשת מחיקת App + רישום מחדש.
- [ ] `agent-router.json`: הרחבת **רק** ה-`ALLOW` regex ל-`github.com`, `railway.app`,
      `railway.com`. לא נוגעים ב-strip script / exec-eval block / 4000-char cap.
- [ ] `jq . agent-router.json` עובר. actionlint/yamllint על register-system-app עוברים.

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

### שלב 6 — תיעוד מערכת

**Acceptance:**
- [ ] `templates/system/CHANGELOG.md` + פתק ב-`templates/system/changelog.d/` בפורמט הקיים.
- [ ] `templates/system/AGENTS.md.template` — הערה עובדתית קצרה על הקריאה החיה החדשה, בלי
      placeholder `${...}` חדש שאינו ב-allow-list.
- [ ] Playground ירוק (כולל רינדור AGENTS.md.template).

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

## אימות חי (דורש אישור Or — צעד נפרד, לא חלק מכתיבת הקוד)

הקמת מערכת test טרייה → הודעת טלגרם "מה קרה בגיטהאב הלילה?" / "מה סטטוס ה-deploy האחרון?"
מחזירה תשובה אמיתית מנתונים חיים. לאמת שם גם: אם Code node חותם JWT — `NODE_FUNCTION_ALLOW_BUILTIN=crypto`
מוגדר (עדיף נוד JWT שלא דורש), וששאילתות הלוגים של Railway מחזירות נתונים.

## יומן ל-Or (עברית)

- (יתמלא תוך כדי.)
