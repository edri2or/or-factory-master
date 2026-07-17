---
dev_name: פירוק מכונת-המפעל — קיפול ל-or-aios כמערכת יחידה
slug: factory-dismantle
opened: 2026-07-17
status: active
---

# תוכנית פיתוח — פירוק מכונת-המפעל (factory-dismantle)

## מטרה
לקפל את or-factory-master ממפעל-שמייצר-מערכות למערכת אישית אחת (or-aios). מסירים את מכונת
ייצור-הצי בכמה אצוות הפיכות ומתועדות, תוך שמירה על ה-backbone שעליו רץ or-aios: ה-broker App
+ github-pool WIF + broker SA, ה-gateway (Cloud Run), מסלול Google, ושערי-CI ההיגייניים.

## מה נשמר (לא נמחק)
- **broker App + github-pool WIF + broker SA** — התשתית של ה-gateway וכל ה-workflows הנשמרים.
- **factory-test-7** — בית ה-OAuth client של Google (email+ops). אסור למחוק.
- **factory-test-8** — or-aios (עד השלב האחרון של הקיפול).
- ה-gateway + workflows של Google (deploy-mcp-server, request-workspace-scopes-consent,
  workspace-token-audit, google-mcp-smoke) + שערי-CI (changelog-check, secret-scan,
  supply-chain-check, protect-main, pipeline-tests, playground-tests, compile-changelog).

## אצוות (כל אחת PR נפרד, נסקר וממוזג ע"י Or)

| # | אצווה | סטטוס | תוכן |
|---|---|---|---|
| 1 | ניטור-צי + שער-E2E | in-progress | מחיקת system-runtime-audit, factory-health-audit, meta-monitoring-watchdog, fleet-rollup, e2e-gate, e2e-verify + עדכון watchdog-registry. פותח את מחיקת ה-GCP של or-edri-4. |
| 2 | הקמה + agent-repo + OIL | pending | provision-*, register-*, bootstrap-*, agent-action, provision/refresh-agent-repo, coordinator-mcp-smoke, oil-autofix-*, set-oil-allowlist. |
| 3 | טסטים/eval/smoke/probe | pending | eval-agent-router*, factory-mcp-smoke, n8n-mcp-smoke, or-router-probe, drive-*-probe/smoke, exercise-agent, deploy-verify, prove-on-test-system. |
| 4 | ניקוי GCP + זהויות | pending | מחיקת factory-test-21 (or-edri-4) + factory-test-25 + OIL-approver App + דלת WIF של agent-repo + repos מיותרים. |
| 5 | גיזום CI + כלים שסיימו | pending | הסרת הקשרי-CI מיותרים + מחיקת כלים אחרי קיפול-הסודות (mirror/preserve/restore-secret, decommission-*). |

## אצווה 1 — ניטור-צי + שער-E2E

**נמחק:** `system-runtime-audit.yml`, `factory-health-audit.yml`, `meta-monitoring-watchdog.yml`,
`fleet-rollup.yml`, `e2e-gate.yml`, `e2e-verify.yml`.

**מניפסט:** `watchdog-registry.json` — הוסרו 4 רשומות (factory-health-audit, system-runtime-audit,
fleet-reliability-rollup, meta-monitoring-watchdog); e2e-gate/e2e-verify אינם מנוטרים שם.

**סקריפטים מיותמים** (`check-e2e-proof.sh`, `runtime-audit-targets.sh`, `e2e-surfaces.json`,
`e2e-proofs/`) — נשארים כרגע, יוסרו באצווה מאוחרת (אינם שוברים דבר; ה-bats שלהם עדיין עובר).

**הוכחה:** CI ירוק על ה-PR. אחרי מיזוג — or-edri-4 מפסיק להיות מנוטר (אין רעש), ומחיקת ה-GCP
שלו (factory-test-21) נפתחת (אין עוד שער שדורש ממנו הוכחה חיה).

**הערת התקדמות אחרונה:** אצווה 1 בבנייה — PR נפתח, ממתין ל-CI ולסקירת Or.

## יומן ל-Or (עברית)
- מתחילים לפרק את מכונת-המפעל בזהירות, אצווה-אצווה. אצווה 1 מסירה את ניטור-הצי ואת שער-הבחינה
  (E2E) — מה שגם פותח את הדרך למחוק את ה-GCP של or-edri-4. שום דבר שאתה משתמש בו לא נגעתי.
