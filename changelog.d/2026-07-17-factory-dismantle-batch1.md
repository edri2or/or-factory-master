## פירוק מכונת-המפעל — אצווה 1 (ניטור-צי + שער-E2E)

התחלת פיתוח `factory-dismantle` (קיפול or-factory-master למערכת אישית אחת). אצווה 1 מסירה את
מכונת ניטור-הצי ושער-ה-E2E:

- **נמחקו 6 workflows:** `system-runtime-audit.yml`, `factory-health-audit.yml`,
  `meta-monitoring-watchdog.yml`, `fleet-rollup.yml`, `e2e-gate.yml`, `e2e-verify.yml`.
- **`monitoring/watchdog-registry.json`:** הוסרו 4 הרשומות של ה-workflows המנוטרים שנמחקו
  (`factory-health-audit`, `system-runtime-audit`, `fleet-reliability-rollup`, `meta-monitoring-watchdog`).
- נשמר ה-backbone (broker/WIF/SA), ה-gateway, מסלול Google, ושערי-ה-CI.
- פותח את מחיקת ה-GCP של or-edri-4 (factory-test-21) — הוסר השער שדרש ממנו הוכחה חיה.

סקריפטים מיותמים (`check-e2e-proof.sh`, `runtime-audit-targets.sh`, `e2e-surfaces.json`,
`e2e-proofs/`) יוסרו באצווה מאוחרת.
