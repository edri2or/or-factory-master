---
dev_name: פירוק מכונת-המפעל — קיפול ל-or-aios כמערכת יחידה
slug: factory-dismantle
opened: 2026-07-17
completed: 2026-07-18
status: completed
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
| 3 | טסטים/eval/smoke/probe | **completed** (PR #602) | 13 workflows: eval-agent-router(+precheck), factory-mcp-smoke, n8n-mcp-smoke, drive-content-edit-probe, drive-edit-smoke, exercise-agent, deploy-verify, prove-on-test-system, bootstrap-sandbox-tester, observability-pilot, _verify-bs-webhook, _verify-sentry. (or-router-probe כבר לא קיים כקובץ.) נשמר google-mcp-smoke. **הערה:** נמחקו ה-*workflows* factory-mcp-smoke.yml/n8n-mcp-smoke.yml — אבל הסקריפטים `scripts/factory-mcp-smoke.py`/`n8n-mcp-smoke.py` **נשמרו** (deploy-mcp-server מריץ אותם ב-post-deploy smoke). |
| 4 | פרישת מערכות-הוכחה מתות | **completed** (PR #605) | סריקת-אימפקט חיה: GCP (factory-test-21/25) + דלת-WIF של agent-repo **כבר נמחקו**; OIL-approver App **load-bearing** (זהות-מיזוג של ערוץ system-request→or-aios הנשמר) → נדחה לאצווה 5. שלב 1 (PR #605): הפניית ברירות-מחדל חיות מ-or-edri-4→or-aios. שלב 2: מחיקת or-edri-4 + or-edri-base דרך propose-repo-delete.yml (Telegram-gated, Or אישר ✅). אימות: get_repo(שניהם)=404, or-aios /healthz=200. |
| 5 | גיזום קוד-מת (3 תת-אצוות לפי סיכון) | **completed** (5a #606 · 5b #607 · 5c ✅) | **5a** (מוזג PR #606): מחיקת 11 workflows מתים + 5 זוגות script+bats + ~21 סקריפטים/קונפיג יתומים + ניקוי 3 רשומות watchdog-registry. ללא redeploy. **5b** (PR זה): מחיקת 3 מודולי-gateway מתים (agent-approval/coordinator-scope/oil-approval + 3 טסטים) + הסרת ה-wiring ב-index.ts (routes /oil-approval-register, /agent-action-register, /coordinator/:repo/mcp + ענפי-callback מתים) + ניקוי DISPATCHABLE_WORKFLOWS allowlist ב-tools.ts (12 מתות→4 חיות) + מחיקת decommission-test-system.yml + cleanup-orphan-linear-webhooks.yml(+.sh). **מפעיל redeploy — לאמת post-deploy.** ערוצי-האישור החיים (sysreq/gcp/repo/chat) לא נגעו. **5c** (בוצע 2026-07-18): נמחק הסוד היתום `bs-telegram-watermark` (100 גרסאות, ~22 ₪/חודש) דרך `gcp-action.yml` red→Telegram ✅. אימות: `secretCount` 53→52, הסוד נעדר. פעולה תפעולית — ללא PR/redeploy. |
| 6 | מכונת-התבנית (אחרונה) | **completed** (PR #603) | templates/system (193) + agent-repo + provision-system + fulfill-promote-request + refresh-system-agents + מכונת golden + סקריפטי-בדיקה/הקמה + מניפסטים; גיזום שלבי-CI תלויי-תבנית מ-changelog-check/playground-tests/pipeline-tests. |
| 7 | תיעוד (docs + CLAUDE.md) | **completed** | נכתבו-מחדש CLAUDE.md + README כמערכת-יחידה (persona של Or verbatim, מסגור fold, gateway/backbone/Google/CI/dev-stage, אזהרות-אבטחה). נמחקו 12 docs-מפעל מתים (e2e-*, oil-autofix, agent-repo-product, doc-drift-prevention, skills-audience, live-test-loop, master-integrity-matrix, roadmap, phase-f-handoff, reliability-layer, telegram-chat-bot ישן). נשמרו capability-first + agent-isolation-testing (מפנה מ-/dev-stage). תוקנו 4 קישורים-תלויים ב-docs נשמרים. **בנוסף: הוסרה בדיקת-החובה היתומה `E2E verification gate` מ-`protect-main`** (ה-workflow נמחק באצווה 1 אבל הדרישה נשארה → כל PR `blocked` וניתן-למיזוג רק בעקיפת-אדמין). סט-החובה עכשיו 5 שערים חיים. |

## הערת התקדמות אחרונה
- אצוות 1-3,6,7 הושלמו ואומתו (PR #600/#601/#602/#603/#604). or-edri-base + or-edri-4 + factory-test-25 GCP נמחקו (Telegram-gated).
- אצווה 4 הושלמה (PR #605): הפניית ברירות-מחדל חיות מ-or-edri-4→or-aios, ואז מחיקת or-edri-4+or-edri-base. get_repo(שניהם)=404.
- **אצווה 5א (PR זה):** גיזום קוד-מת — 11 workflows + 5 זוגות script+bats + ~21 סקריפטים/קונפיג יתומים + ניקוי 3 רשומות watchdog-registry. **תיקון-אמת מול ההנדאוף:** factory-mcp-smoke.py/n8n-mcp-smoke.py **נשמרו** (deploy-mcp-server:914 מריץ אותם post-deploy). ללא נגיעה ב-services/ → ללא redeploy.
- **אצווה 5ב (PR זה):** גיזום 3 מודולי-gateway מתים + wiring ב-index.ts + ניקוי allowlist ב-tools.ts + מחיקת 2 workflows (+סקריפט מתייתם). אומת: `npm test` 131/131, `tsc` build נקי, אפס הפניות-קוד למחוקים. **מפעיל redeploy** — לאמת post-deploy smoke מול or-aios. ערוצי-האישור החיים (system-request/gcp/repo/chat) + github-client + OIL App לא נגעו. 2 הפניות-docs ל-decommission-test-system (openrouter-integration.md, external-state.md) נדחו לניקוי-docs (הסעיף כבר מפנה ל-provision-system.yml שנמחק ב-6).
- **אצווה 5ג בוצעה (2026-07-18):** נמחק הסוד היתום `bs-telegram-watermark` (Telegram-gated). אומת: `secretCount` 53→52, הסוד נעדר, or-aios /healthz=200 (ללא נגיעה ב-runtime).
- **כל אצוות הפירוק (1–7 + 5א/5ב/5ג) הושלמו — מכונת-המפעל מפורקת. התוכנית הזו נסגרת (`status: completed`).**
- **Phase 3** (קיפול `factory-test-8`→`or-factory-master-control` כפרויקט GCP יחיד) הוא שלב-המשך **נפרד ו-Or-gated צעד-צעד** (מעביר `n8n-encryption-key` verbatim) — ייפתח ב-devplan ייעודי כשיתחיל, לא במסגרת התוכנית הזו.

## יומן ל-Or (עברית)
- אצווה 1: הוסרו ניטור-הצי ושער-הבחינה (E2E). ✓ בוצע.
- אצווה 2: מסירים הקמה + agent-repo + OIL. מכונת-התבנית המלאה (provision-system + templates) תרד באצווה אחרונה יחד. שום דבר ש-or-aios משתמש בו לא נוגע.
