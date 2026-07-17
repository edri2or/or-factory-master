## פירוק מכונת-המפעל — אצווה 2 (הקמה + agent-repo + OIL)

אצווה 2 של `factory-dismantle`. נמחקו 15 workflows של מכונת ייצור-הצי:

- **הקמה/רישום:** `register-system-app.yml`, `register-broker-app.yml` (bootstrap חד-פעמי),
  `protect-system-main.yml`, `provision-youtube-data-api-key.yml`, `seed-test-bot-token.yml`, `create-throwaway-repo.yml`.
- **agent-repo:** `agent-action.yml`, `provision-agent-repo.yml`, `refresh-agent-repo.yml`,
  `bootstrap-agent-repo-identity.yml`, `coordinator-mcp-smoke.yml`.
- **OIL:** `oil-autofix-investigate.yml`, `oil-autofix-verify.yml`, `set-oil-allowlist.yml`, `register-oil-approver-app.yml`.
- `monitoring/registry-exempt.txt`: הוספו tombstones ל-`oil-autofix-investigate`/`oil-autofix-verify` (event-workflows שהיו ברישום).

**נדחה (תלות):** `provision-system.yml` **לא נמחק כאן** — הוא מזין את רשימת ה-envsubst ALLOWLIST
ש-`check-golden-sync.sh` משווה, והוא כבול לכל מכונת-התבנית. יימחק באצווה ייעודית (6) של מכונת-התבנית:
provision-system + golden (render/check-golden-sync/check-system-golden/validate-templates + tests/golden) + templates/system + השערים התלויים — יחד.

נשמר ה-backbone (broker/WIF/SA), ה-gateway, מסלול Google, ושערי-ה-CI. ניקוי allowlist ה-dispatch_workflow
ב-`tools.ts` ומחיקת ה-OIL-approver App נדחים לאצווה מאוחרת (שינוי-קוד/console).
