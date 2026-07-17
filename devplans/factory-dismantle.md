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
- ה-gateway + workflows של Google + שערי-CI (changelog-check, secret-scan, supply-chain-check, protect-main, pipeline-tests, playground-tests, compile-changelog).

## אצוות (כל אחת PR נפרד, נסקר וממוזג ע"י Or)

| # | אצווה | סטטוס | תוכן |
|---|---|---|---|
| 1 | ניטור-צי + שער-E2E | **completed** (PR #600) | נמחקו system-runtime-audit, factory-health-audit, meta-monitoring-watchdog, fleet-rollup, e2e-gate, e2e-verify + עדכון watchdog-registry. פתח את מחיקת ה-GCP של or-edri-4. |
| 2 | הקמה + agent-repo + OIL | **in-progress** | provision-system, register-system-app, register-broker-app, protect-system-main, provision-youtube-data-api-key, seed-test-bot-token, create-throwaway-repo, agent-action, provision/refresh-agent-repo, bootstrap-agent-repo-identity, coordinator-mcp-smoke, oil-autofix-investigate, oil-autofix-verify, set-oil-allowlist, register-oil-approver-app. |
| 3 | טסטים/eval/smoke/probe | pending | eval-agent-router*, factory-mcp-smoke, n8n-mcp-smoke, or-router-probe, drive-*-probe/smoke, exercise-agent, deploy-verify, prove-on-test-system, bootstrap-sandbox-tester, observability-pilot, _verify-*, or-router-probe. |
| 4 | ניקוי GCP + זהויות | pending | מחיקת factory-test-21 (or-edri-4) + factory-test-25 + OIL-approver App + דלת WIF של agent-repo + repos מיותרים (Telegram-gated). |
| 5 | גיזום CI + כלים שסיימו | pending | ניקוי dispatch_workflow allowlist ב-tools.ts + מחיקת כלים אחרי Phase 3 (mirror/preserve/restore-secret, decommission-*, gcp-action). |

## הערת התקדמות אחרונה
- אצווה 1 הושלמה ואומתה (PR #600, sha fe987077; 6 workflows ירדו מ-main, CI 5/5 ירוק).
- אצווה 2 בבנייה — מחיקת 16 workflows של הקמה/agent-repo/OIL.

## יומן ל-Or (עברית)
- אצווה 1: הוסרו ניטור-הצי ושער-הבחינה (E2E). ✓ בוצע.
- אצווה 2: מסירים את מכונת ההקמה (provision), את מכונת ה-agent-repo, ואת OIL — דברים שרלוונטיים רק למפעל שמייצר מערכות. שום דבר ש-or-aios משתמש בו לא נוגע.
