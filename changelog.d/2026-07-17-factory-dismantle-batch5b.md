## פירוק מכונת-המפעל — אצווה 5ב (גיזום קוד-מת ב-gateway + ניקוי allowlist)

אצווה 5ב מגזמת **קוד-מת בתוך ה-gateway** (`services/mcp-server/`): מודולי-אישור שה-producers שלהם
נמחקו, ה-wiring שלהם ב-`index.ts`, ומחרוזות-מתות ב-allowlist של `dispatch_workflow`. **נוגע ב-`services/`
→ המיזוג מפעיל redeploy אוטומטי של ה-gateway** (`deploy-mcp-server.yml`, path-filter).

- **נמחקו 3 מודולי-src מתים + 3 טסטים:** `agent-approval.ts`, `coordinator-scope.ts`, `oil-approval.ts`
  (+ `test/{agent-approval,coordinator-scope,oil-approval}.test.mjs`). רק `index.ts` ייבא אותם; ה-producers
  שלהם (`agent-action.yml`, `oil-autofix-investigate.yml`, `coordinator-mcp-smoke.yml`) כבר נמחקו.
- **`index.ts`:** הוסרו 3 בלוקי-import; 3 routes — `/oil-approval-register`, `/agent-action-register`,
  `/coordinator/:repo/mcp`; וענפי-ה-callback המתים (`oilapprove:`/`oilreject:`, `agentok:`/`agentno:`)
  ב-`/telegram-webhook`. **ערוצי-האישור החיים לא נגעו** — system-request, gcp-approval, repo-approval,
  ו-chat נשארים ב-dispatch לפי prefix עצמאי.
- **`tools.ts`:** נוקו 12 מחרוזות-מתות מ-`DISPATCHABLE_WORKFLOWS` (נשארות 4 חיות: `deploy-railway-cloudflare.yml`,
  `configure-agent-router.yml`, `deploy-mcp-server.yml`, `publish-static-site.yml`) + הוסר הבלוק המת של
  `agent-action.yml phase=execute` + עודכנו מחרוזת-התיאור וההערות.
- **נמחקו 2 workflows:** `decommission-test-system.yml` + `cleanup-orphan-linear-webhooks.yml` (שניהם כבר
  tombstones ב-`registry-exempt.txt`) + הסקריפט המתייתם `scripts/cleanup-orphan-linear-webhooks.sh`
  (`generate-app-token.sh` נשמר — משותף).
- **לא נגעו (load-bearing):** `github-client.ts` (merge-channel של system-request→or-aios), `gcp-approval.ts`,
  `repo-approval.ts`, `system-request.ts`, `oil-autofix.ts`, מסלול Google/n8n/telegram-chat, ה-OIL App.
- אומת: `tsc` build נקי + `npm test` 131/131, ואפס הפניות-קוד למודולים המחוקים.
