## פירוק מכונת-המפעל — אצווה 2 (הקמה + agent-repo + OIL)

אצווה 2 של `factory-dismantle`. נמחקו 16 workflows של מכונת ייצור-הצי:

- **הקמה:** `provision-system.yml`, `register-system-app.yml`, `register-broker-app.yml`,
  `protect-system-main.yml`, `provision-youtube-data-api-key.yml`, `seed-test-bot-token.yml`, `create-throwaway-repo.yml`.
- **agent-repo:** `agent-action.yml`, `provision-agent-repo.yml`, `refresh-agent-repo.yml`,
  `bootstrap-agent-repo-identity.yml`, `coordinator-mcp-smoke.yml`.
- **OIL:** `oil-autofix-investigate.yml`, `oil-autofix-verify.yml`, `set-oil-allowlist.yml`, `register-oil-approver-app.yml`.

נשמר ה-backbone (broker/WIF/SA), ה-gateway, מסלול Google, ושערי-ה-CI. ניקוי allowlist ה-dispatch_workflow
ב-`services/mcp-server/src/tools.ts` ומחיקת ה-OIL-approver App נדחים לאצווה מאוחרת (שינוי-קוד/console).
