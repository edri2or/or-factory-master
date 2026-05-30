---
dev_name: טלמטריה חיה ל-ops-agent (GitHub + Railway, read-only)
slug: ops-agent-live-telemetry
opened: 2026-05-30
status: completed
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
| 1 | `railway-readonly.json` — sub-workflow חדש (deploy_status / recent_logs) | completed | `templates/system/workflows/n8n/railway-readonly.json` |
| 2 | `github-readonly.json` — sub-workflow חדש (ci_runs / recent_commits / open_prs) + JWT mint | completed | `templates/system/workflows/n8n/github-readonly.json` |
| 3 | חיווט ל-`ops-agent.json` — שני כלי toolWorkflow + systemMessage | completed | `templates/system/workflows/n8n/ops-agent.json` |
| 4 | התקנה ב-`configure-agent-router.yml` — creds + install + sed + graceful degradation | completed | `templates/system/.github/workflows/configure-agent-router.yml` |
| 5 | הרשאת PRs + הרחבת Egress allow-list | completed | `.github/workflows/register-system-app.yml`, `templates/system/workflows/n8n/agent-router.json` |
| 6 | תיעוד מערכת — CHANGELOG של התבנית + AGENTS.md.template | completed | `templates/system/CHANGELOG.md`, `templates/system/changelog.d/`, `templates/system/AGENTS.md.template` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`. כל שלב = commit אחד ל-PR,
> כולל עדכון התוכנית + פתק ה-changelog של הפקטורי, ועוצר לאישור Or לפני השלב הבא.

---

### שלב 1 — railway-readonly.json

`toolWorkflow` חדש בשם `factory-master: railway-readonly`, במבנה של postgres-named-queries.

**Acceptance:**
- [ ] `jq . railway-readonly.json` עובר.
- [x] `executeWorkflowTrigger` → `Normalize Input` (Code, string גולמי; `deploy_status` |
      `recent_logs`, דפוס חילוץ defensive כמו postgres) → `Switch`.
- [x] ענף `deploy_status`: HTTP POST ל-`https://backboard.railway.com/graphql/v2` עם status
      query, משתנה `{pid:"@@RAILWAY_PROJECT_ID@@"}`, auth דרך credential Bearer (`@@CRED_RAILWAY_ID@@`).
- [x] ענף `recent_logs`: resolve של deployment id אחרון (`Pick Latest Deployment`) → POST של `deploymentLogs`.
- [x] `Format Output` (Code) → `{ ok, command, data }`, משאיר `staticUrl`/URLs.
- [x] שום ערך סודי ב-JSON — רק `@@RAILWAY_PROJECT_ID@@` + `@@CRED_RAILWAY_ID@@`.
- [x] `jq .` עובר; שלושת ה-Code nodes עוברים `node --check`; ה-GraphQL body תקין כ-JSON.
- [ ] Playground ירוק (JSON בלבד) — ייבדק ב-CI אחרי push.

**הערת התקדמות אחרונה:** הקובץ נבנה בדיוק לפי שלד postgres-named-queries (trigger →
Normalize → Switch → ענפים → Format Output). recent_logs עושה שתי קפיצות: status query →
חילוץ deployment id אחרון → deploymentLogs. auth דרך credential Bearer (placeholder),
project id placeholder. אומת מקומית: JSON תקין + JS תקין + body תקין.
**שינוי תוכנית:** —

---

### שלב 2 — github-readonly.json

`toolWorkflow` חדש בשם `factory-master: github-readonly`, אותו שלד + שלב הנפקת token.

**Acceptance:**
- [ ] `jq . github-readonly.json` עובר.
- [x] `Normalize Input` (string גולמי; `ci_runs` | `recent_commits` | `open_prs`) → `Switch`.
- [x] שלב mint משותף: JWT RS256 (iat≈now−60s, exp+540s, iss=App ID) דרך נוד JWT מובנה
      (`n8n-nodes-base.jwt`, operation=sign) עם credential `jwtAuth` PEM (`@@CRED_GITHUB_JWT_ID@@`)
      → POST ל-`/app/installations/@@GITHUB_INSTALLATION_ID@@/access_tokens` → token לשעה.
- [x] caching ב-`$getStaticData('global').github_token_cache` לפי `exp` (refresh רק כשפחות מ-300s
      לפקיעה, דרך נוד `Token Cache Check` + IF `Token Valid?`); token כ-opaque (בלי אורך/regex).
- [x] כל ענף קורא ל-REST עם `owner=edri2or`, `repo=@@SYSTEM_NAME@@`:
      `actions/runs?per_page=10` / `commits?per_page=10` / `pulls?state=open&per_page=10`,
      Authorization: Bearer דרך header דינמי (לא credential — הטוקן runtime).
- [x] `Format Output` → `{ ok, command, data }`, משאיר `html_url`.
- [x] private key אף פעם לא ב-JSON — רק credential id. placeholders: `@@SYSTEM_NAME@@`,
      `@@GITHUB_APP_ID@@`, `@@GITHUB_INSTALLATION_ID@@`, `@@CRED_GITHUB_JWT_ID@@`.
- [x] `jq .` עובר; כל 5 ה-Code nodes עוברים `node --check`; אין מפתח/אורך-token בקובץ.
- [ ] Playground ירוק (JSON בלבד) — ייבדק ב-CI אחרי push.

**הערת התקדמות אחרונה:** נבנה בדיוק לפי שלד postgres. החתימה דרך נוד ה-JWT המובנה (לא Code+crypto)
כדי להימנע מ-`NODE_FUNCTION_ALLOW_BUILTIN=crypto`. cache לטוקן ב-static data עם IF שמדלג על mint
כשהטוקן עדיין בתוקף. אומת מקומית. **לאימות חי בשלב מאוחר:** שמות הפרמטרים של נוד ה-JWT
(`useJson`/`jsonPayload`) ושמבנה תשובת ה-REST (array vs object) — מטופלים אבל דורשים אימות במערכת test.
**שינוי תוכנית:** —

---

### שלב 3 — חיווט ל-ops-agent.json

**Acceptance:**
- [x] שני נודי `@n8n/n8n-nodes-langchain.toolWorkflow`: `github_readonly`
      (`@@WF_GITHUB_READONLY_ID@@`) + `railway_readonly` (`@@WF_RAILWAY_READONLY_ID@@`), כל אחד
      עם `description` שמסביר ל-LLM איזו פקודת-string לשלוח ומתי.
- [x] שניהם מחוברים ל-`Ops Agent` ב-`ai_tool` (אותה צורה כמו `postgres_named_query`).
- [x] `systemMessage` עודכן: 4 כלים + הפקודות שלהם, ומציין שמותר להחזיר קישורי GitHub/Railway.
- [x] `jq .` עובר; שמות הנודים `github_readonly`/`railway_readonly` תואמים בדיוק את ה-jq-strip
      שייכתב בשלב 4 (graceful degradation).
- [ ] Playground ירוק — ייבדק ב-CI אחרי push.

**הערת התקדמות אחרונה:** הוספתי שני נודים + חיבורי `ai_tool` + עדכנתי systemMessage לארבעה כלים.
שמות הנודים נבחרו במדויק כך שה-`jq`-strip בשלב 4 יוכל להוריד אותם בחן אם secret חסר.
**שינוי תוכנית:** —

---

### שלב 4 — configure-agent-router.yml (creds + install + graceful degradation)

מראה את לוגיקת ההתקנה של postgres-named-queries לשני ה-sub-workflows החדשים.

**Acceptance:**
- [x] קריאת secrets: `github-app-id`/`github-app-private-key`/`github-app-installation-id`
      (Railway כבר נקרא; ה-PEM ממוסך ב-`::add-mask::`).
- [x] יצירת credentials (find-by-name → POST, מול `/tmp/ar-creds.json` הקיים): Bearer ל-Railway
      (`httpHeaderAuth` Authorization) → `CRED_RAILWAY_ID`; `jwtAuth` PEM RS256 ל-GitHub → `CRED_GITHUB_JWT_ID`.
- [x] התקנת `railway-readonly.json` + `github-readonly.json` **לפני** לולאת הסוכנים עם
      `_upsert_wf`, לכידת `WF_RAILWAY_READONLY_ID` + `WF_GITHUB_READONLY_ID`, והזרקת placeholders
      ב-`sed` (`@@RAILWAY_PROJECT_ID@@`/`@@CRED_RAILWAY_ID@@`; `@@SYSTEM_NAME@@`/`@@GITHUB_APP_ID@@`/`@@GITHUB_INSTALLATION_ID@@`/`@@CRED_GITHUB_JWT_ID@@`).
- [x] בלולאת הסוכנים: `sed` מזריק את שני ה-WF ids ל-ops-agent (שתי שורות `-e` חדשות).
- [x] graceful degradation (jq strip, רק על ops-agent.json): WF id ריק → מורידים את נוד
      `github_readonly`/`railway_readonly` + ה-connection. אומת מקומית בשני המצבים → JSON תקין.
- [x] כל ענף כשל חדש = `WARN`/soft (אין `exit 1` חדש; הקיים `_soft_exit0` נשמר) + שורות summary לשני הכלים.
- [x] `yamllint` עובר; `shellcheck -S error` נקי; `bash -n` נקי; YAML עדיין job אחד (3 צעדים).
- [ ] Playground (actionlint) ירוק — ייבדק ב-CI אחרי push.

**הערת התקדמות אחרונה:** 5 עריכות נקודתיות: (א) שני credentials, (ב) התקנת שני ה-sub-workflows לפני
הלולאה, (ג) שתי שורות sed בלולאה, (ד) שני jq-strips ל-degradation, (ה) שתי שורות summary. הכל additive
ו-soft. סימולציה מקומית של sed+strip על ops-agent הוכיחה JSON תקין גם כששני הכלים קיימים וגם כששניהם יורדים.
**לאימות חי:** סכמת ה-credential של `jwtAuth` (keyType/privateKey/algorithm) — דורשת אימות במערכת test.
**שינוי תוכנית:** —

---

### שלב 5 — הרשאת PRs + הרחבת Egress

**Acceptance:**
- [x] `.github/workflows/register-system-app.yml`: הוספת `"pull_requests":"read"` ל-
      `APP_PERMISSIONS_JSON` + הערה שמערכת קיימת דורשת מחיקת App + רישום מחדש, חדשה מקבלת מההתחלה.
- [x] `agent-router.json`: הרחבת **רק** ה-`ALLOW` regex ל-`github.com`, `railway.app`,
      `railway.com`. אומת ש-3 ההגנות האחרות (withheld policy / script strip / 4000-cap) נשמרו.
- [x] `jq . agent-router.json` עובר; ה-JS של Egress עובר `node --check`; `shellcheck -S error`
      + `yamllint` על register-system-app נקיים.

**הערת התקדמות אחרונה:** שתי עריכות שורה-אחת: הרשאת PRs באפליקציית גיטהאב (מקור אמת יחיד —
ה-receiver קורא משם), והרחבת ה-allow-list ב-router. נגעתי רק ב-regex עצמו.
**שינוי תוכנית:** —

---

### שלב 6 — תיעוד מערכת

**Acceptance:**
- [x] `templates/system/CHANGELOG.md` (שורת feat ל-Initial) + פתק
      `templates/system/changelog.d/2026-05-30-ops-agent-live-telemetry.md` בפורמט הקיים.
- [x] `templates/system/AGENTS.md.template` — הערות עובדתיות על github_readonly/railway_readonly
      (כלים + sub-workflows + soft-fail), בלי placeholder `${...}` חדש.
- [x] `validate-templates.sh` עובר (AGENTS.md.template + CLAUDE.md.template מתרנדרים נקי).

**הערת התקדמות אחרונה:** תיעדתי את היכולת בשלושה מקומות בתבנית. ה-`validate-templates` רץ נקי.
**שינוי תוכנית:** —

---

## אימות חי (דורש אישור Or — צעד נפרד, לא חלק מכתיבת הקוד)

הקמת מערכת test טרייה → הודעת טלגרם "מה קרה בגיטהאב הלילה?" / "מה סטטוס ה-deploy האחרון?"
מחזירה תשובה אמיתית מנתונים חיים. לאמת שם גם: אם Code node חותם JWT — `NODE_FUNCTION_ALLOW_BUILTIN=crypto`
מוגדר (עדיף נוד JWT שלא דורש), וששאילתות הלוגים של Railway מחזירות נתונים.

## יומן ל-Or (עברית)

- שלב 1 הושלם — בניתי את הכלי שקורא מ-Railway: סטטוס ה-deploy האחרון ולוגים אחרונים, קריאה בלבד.
- שלב 2 הושלם — בניתי את הכלי שקורא מגיטהאב (CI, commits, PRs). n8n מייצר לעצמו טוקן זמני ושומר אותו בזיכרון.
- שלב 3 הושלם — חיברתי את שני הכלים החדשים למוח של ה-ops-agent ועדכנתי לו את ההוראות (כולל: מותר לתת קישורים).
- שלב 4 הושלם — workflow ההקמה יודע עכשיו להרכיב את שני הכלים אוטומטית, ואם חסר סוד — הכלי יורד בחן בלי לשבור כלום.
- שלב 5 הושלם — הוספתי לאפליקציית גיטהאב הרשאה לקרוא PRs, והרשיתי קישורי גיטהאב/Railway לחזור בתשובה.
- שלב 6 הושלם — תיעדתי את היכולת החדשה בתבנית (CHANGELOG + AGENTS). **הפיתוח הקודי הושלם.**
- נותר רק אימות חי (הקמת מערכת test ושליחת הודעה לבוט) — צעד נפרד שדורש אישור שלך, לא חלק מהקוד.
