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
| 1 | ניטור-צי + שער-E2E | **completed** (PR #600) | נמחקו system-runtime-audit, factory-health-audit, meta-monitoring-watchdog, fleet-rollup, e2e-gate, e2e-verify + עדכון watchdog-registry. |
| 2 | הקמה + agent-repo + OIL | **completed** (PR #601) | 15 workflows. **provision-system.yml הוחזר** (תלות golden — אצווה 6). |
| 3 | טסטים/eval/smoke/probe | **in-progress** | 13 workflows: eval-agent-router(+precheck), factory-mcp-smoke, n8n-mcp-smoke, drive-content-edit-probe, drive-edit-smoke, exercise-agent, deploy-verify, prove-on-test-system, bootstrap-sandbox-tester, observability-pilot, _verify-bs-webhook, _verify-sentry. (or-router-probe כבר לא קיים כקובץ.) נשמר google-mcp-smoke. |
| 4 | ניקוי GCP + זהויות | pending | מחיקת factory-test-21 (or-edri-4) + factory-test-25 + OIL-approver App + דלת WIF של agent-repo + repos מיותרים (Telegram-gated). |
| 5 | גיזום CI + כלים שסיימו | pending | ניקוי dispatch_workflow allowlist ב-tools.ts + מחיקת כלים אחרי Phase 3 (mirror/preserve/restore-secret, decommission-*, gcp-action). |
| 6 | מכונת-התבנית (אחרונה) | **in-progress** | templates/system (193) + agent-repo + provision-system + fulfill-promote-request + refresh-system-agents + מכונת golden + סקריפטי-בדיקה/הקמה + מניפסטים; גיזום שלבי-CI תלויי-תבנית מ-changelog-check/playground-tests/pipeline-tests. |
| 7 | תיעוד (docs + CLAUDE.md) | **completed** | נכתבו-מחדש CLAUDE.md + README כמערכת-יחידה (persona של Or verbatim, מסגור fold, gateway/backbone/Google/CI/dev-stage, אזהרות-אבטחה). נמחקו 12 docs-מפעל מתים (e2e-*, oil-autofix, agent-repo-product, doc-drift-prevention, skills-audience, live-test-loop, master-integrity-matrix, roadmap, phase-f-handoff, reliability-layer, telegram-chat-bot ישן). נשמרו capability-first + agent-isolation-testing (מפנה מ-/dev-stage). תוקנו 4 קישורים-תלויים ב-docs נשמרים. .md בלבד — CI לא-נוגע. |

## הערת התקדמות אחרונה
- אצוות 1-3+6 הושלמו ואומתו (PR #600/#601/#602/#603). or-edri-base + or-edri-4 + factory-test-25 GCP נמחקו (Telegram-gated).
- אצווה 6 מוזגה: מחיקת כל מכונת-התבנית (259 קבצים) + גיזום 3 קבצי-CI. CI ירוק.
- אצווה 7 (תיעוד): CLAUDE.md + README נכתבו-מחדש כמערכת-יחידה; 12 docs-מפעל מתים נמחקו. .md בלבד.
- **נותרו אצוות 4 (ניקוי GCP + זהויות) ו-5 (גיזום CI/כלים + dispatch_workflow allowlist). Phase 3 (קיפול factory-test-8→control) נפרד ו-Or-gated.**

## יומן ל-Or (עברית)
- אצווה 1: הוסרו ניטור-הצי ושער-הבחינה (E2E). ✓ בוצע.
- אצווה 2: מסירים הקמה + agent-repo + OIL. מכונת-התבנית המלאה (provision-system + templates) תרד באצווה אחרונה יחד. שום דבר ש-or-aios משתמש בו לא נוגע.
