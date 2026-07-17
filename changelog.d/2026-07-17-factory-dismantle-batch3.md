## פירוק מכונת-המפעל — אצווה 3 (טסטים/eval/smoke/probe)

אצווה 3 של `factory-dismantle`. נמחקו 13 workflows של אימות/הוכחה של המפעל (dev-verification):

- **eval:** `eval-agent-router.yml`, `eval-agent-router-precheck.yml`.
- **smoke:** `factory-mcp-smoke.yml`, `n8n-mcp-smoke.yml`.
- **probe/verify:** `drive-content-edit-probe.yml`, `drive-edit-smoke.yml`, `exercise-agent.yml`,
  `deploy-verify.yml`, `prove-on-test-system.yml`, `bootstrap-sandbox-tester.yml`,
  `observability-pilot.yml`, `_verify-bs-webhook.yml`, `_verify-sentry.yml`.
- `monitoring/registry-exempt.txt`: tombstone ל-`eval-agent-router.yml` (event-workflow שהיה ברישום).

נשמר `google-mcp-smoke.yml` (הוכחת Google — חמצן). נשמר ה-backbone, ה-gateway, ושערי-ה-CI.
