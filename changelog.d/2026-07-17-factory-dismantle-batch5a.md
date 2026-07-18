## פירוק מכונת-המפעל — אצווה 5א (גיזום קוד-מת: workflows + סקריפטים + קונפיג)

אצווה 5א מגזמת את שאריות "הקוד המת" של המפעל — workflows לשירות מערכות שכבר לא קיימות, סקריפטים
יתומים שיעדם נמחק, וקבצי-קונפיג/דאטה מתים. **PR רגיל ל-main, ללא נגיעה ב-`services/` → ללא redeploy
של ה-gateway.** (5ב יגזום את קוד-ה-gateway המת + ה-allowlist; 5ג ימחק את הסוד bs-telegram-watermark.)

- **נמחקו 11 workflows:** `mirror-secret-to-system`, `preserve-secret-to-control`,
  `restore-secret-from-control`, `grant-secret-accessor`, `trigger-system-workflow`,
  `remove-system-n8n-workflow`, `decommission-railway-projects`, `list-recoverable-projects`,
  `archive-old-repos`, `tail-mcp-logs`, `bs-incidents-to-telegram`.
- **נמחקו 5 זוגות script+bats (אטומית):** `run-watchdog`, `runtime-audit-targets`,
  `select-result-file`, `notify-card-failure`, `oil-changelog-fragment` (כל אחד `.sh` + `.bats`).
- **נמחקו ~21 סקריפטים/hooks יתומים:** `check-e2e-proof`, `e2e-verify-inbound`, `deploy-verify`,
  `oil-autofix-validate`, `builder-apply`, `bootstrap-agent-repo-identity`, `bootstrap-sandbox-tester`,
  `create-watchdog-heartbeat`, `create-uptime-monitor`, `emit-deploy`, `fleet-rollup`,
  `build-agent-readme`, `eval_router.py`, `coordinator-mcp-smoke.py`, `probe-drive-content-edit.mjs`,
  `drive-edit-smoke.mjs`, `capability-session-start-hook`, `language-session-start-hook`,
  `oil-verify-passmode`, `oil-verify-failmode`, `test-watchdog-registry-daily-tolerance`.
- **נמחק קונפיג/דאטה מת:** `e2e-surfaces.json`, `e2e-proofs/*.json` (15), `policy/agent-risk-tiers.yml`,
  `tests/agent-classify-{policy,fixtures}.yml`, `tests/router_battery.yaml`, `tests/fixtures/drive-content-edit/`.
- **`monitoring/watchdog-registry.json`:** הוסרו 3 רשומות שיעדן נמחק — הקרון `bs-incidents-to-telegram`,
  וה-hooks `hook-capability-session-start` + `hook-language-session-start` (ה-`wired_in` שלהם,
  `templates/system/`, ממילא נמחק באצווה 6).
- **נשמרו (load-bearing, לא נמחקו):** `scripts/factory-mcp-smoke.py` + `scripts/n8n-mcp-smoke.py` —
  `deploy-mcp-server.yml` מריץ אותם ב-post-deploy smoke gate; מחיקתם הייתה שוברת כל פריסת-gateway.
  כן נשמרו `google-mcp-smoke.py`, `oil-verify.sh` + `oil-verify-selftest.sh`, `gcp-classify`/`test-gcp-classify`,
  `policy/gcp-risk-tiers.yml`, `tests/gcp-classify-fixtures.yml`.
- ה-backbone (broker/WIF/SA), ה-gateway, מסלול Google, ושערי-ה-CI — לא נגעו.
