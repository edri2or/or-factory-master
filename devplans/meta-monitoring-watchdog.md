---
dev_name: שומר-העל
slug: meta-monitoring-watchdog
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — שומר-העל (Meta-Monitoring Watchdog)

## מטרה

אוטומציה אחת מעל כל האוטומציות: כל בוקר היא מוכיחה שכל תהליך אוטומטי בפקטורי באמת רץ ועבד,
ושולחת ל-Or דוח בטלגרם עם קישור ישיר להוכחה לכל שורה (אי אפשר לרמות). אם הדוח לא מגיע — זה
עצמו הסימן (שומר חיצוני ב-Better Stack תופס זאת). שער CI מכריח לרשום כל אוטומציה חדשה כדי
שהשומר לעולם לא ישכח אחת. התוכנית המלאה המאושרת: `/root/.claude/plans/atomic-doodling-rain.md`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | יסוד: פנקס + שומר-יומי (workflows מתוזמנים) + שער-CI + dead-man's-switch | completed | `monitoring/watchdog-registry.json`, `monitoring/README.md`, `monitoring/registry-exempt.txt`, `scripts/run-watchdog.sh`, `.github/workflows/meta-monitoring-watchdog.yml`, `scripts/check-watchdog-registry-updated.sh`, `scripts/create-watchdog-heartbeat.sh`, `.github/workflows/changelog-check.yml`, `scripts/tests/run-watchdog.bats`, `scripts/tests/check-watchdog-registry-updated.bats` |
| 2 | כיסוי שערי ה-CI (push/PR) עם הוכחת branch-protection | completed | `monitoring/watchdog-registry.json`, `scripts/run-watchdog.sh`, `scripts/tests/run-watchdog.bats` |
| 3 | hooks (static-integrity) + workflows מונעי-אירוע (last-real-run) | completed | `monitoring/watchdog-registry.json`, `monitoring/registry-exempt.txt`, `monitoring/README.md`, `scripts/run-watchdog.sh`, `scripts/tests/run-watchdog.bats` |
| 4 | כיסוי n8n/מערכות (n8n-execution) + provenance לדוח | in-progress | `monitoring/watchdog-registry.json`, `monitoring/README.md`, `scripts/run-watchdog.sh`, `scripts/tests/run-watchdog.bats` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — יסוד: פנקס + שומר-יומי + שער-CI + dead-man's-switch

**Acceptance:**
- [x] `monitoring/watchdog-registry.json` קיים עם 5 רשומות: 4 ה-workflows המתוזמנים
      (`bs-incidents-to-telegram`, `audit-openrouter-orphan-keys`, `factory-health-audit`,
      `system-runtime-audit`) + הרשומה-העצמית של השומר, כולם `proof_method: gh-run-freshness`.
- [x] `monitoring/README.md` מתעד את הסכמה + חוזה הרישום + בדיקת dead-man's-switch רבעונית.
- [x] `scripts/run-watchdog.sh` קורא את הפנקס, מבצע הוכחת freshness לכל רשומה, מיישם את כלל
      "2 כשלים רצופים", ובונה דוח טלגרם בעברית עם קישור ישיר לכל רשומה.
- [x] `.github/workflows/meta-monitoring-watchdog.yml` רץ `cron 0 5 * * *` + `workflow_dispatch`,
      עם WIF + broker App token, שולח טלגרם ישיר, קורא ל-`emit-event.sh`, וכותב טבלת `$GITHUB_STEP_SUMMARY`.
- [x] `scripts/check-watchdog-registry-updated.sh` (תאום `check-devplan-updated.sh`) חוסם הוספה/מחיקה
      של workflow/n8n ללא עדכון הפנקס, עם allowlist `monitoring/registry-exempt.txt`; מחווט ל-job "Changelog gates".
- [x] `scripts/create-watchdog-heartbeat.sh` מקים heartbeat ב-Better Stack (אידמפוטנטי), והשומר פינג אליו בכל ריצה.
- [x] Playground + שאר שערי ה-CI ירוקים על ה-PR.
- [x] PR #237 מוזג ל-main (squash) — קוד שלב 1 חי; ה-cron של השומר פעיל.
- [x] `meta-monitoring-watchdog.yml` נוסף ל-allowlist של `dispatch_workflow` ב-`services/mcp-server/src/tools.ts` (PR נפרד) — מאפשר לסוכן להריץ את הקמת ה-heartbeat + ריצות אד-הוק ללא לחיצת אופרטור.
- [x] הקמת ה-heartbeat האמיתי: dispatch `meta-monitoring-watchdog.yml` עם `setup_heartbeat=true` רץ בהצלחה — `action='created' sm='secret_created'`, `telegram='ok'`, `heartbeat='ok'`. הסוד `watchdog-heartbeat-url` קיים ב-SM (אומת ב-`list_secret_metadata`). Or אישר שהדוח הגיע בטלגרם.

**הערת התקדמות אחרונה:** שלב 1 **הושלם ואומת מקצה-לקצה** — השומר רץ, הדוח הגיע ל-Or בטלגרם (4 אוטומציות ✅, 1 ❓ עצמית שתסתדר בריצת ה-cron הבאה), וה-heartbeat החיצוני הוקם ב-Better Stack + נשמר ב-SM. בדרך התגלה שה-workflow לא היה ב-allowlist של `dispatch_workflow`; נפתר אוטונומית (PR #241 → CI → מיזוג → redeploy של ה-MCP → dispatch).

**שינוי תוכנית:** —

---

### שלב 2 — כיסוי שערי ה-CI (push/PR)

**Acceptance:**
- [x] רשומות לפנקס עבור 5 שערי ה-CI (`changelog-check`, `pipeline-tests`, `secret-scan`,
      `supply-chain-check`, `playground-tests`) עם `proof_method: gh-branch-protection` — ה-contexts נלקחו מ-ground-truth ב-`scripts/ensure-protect-main-ruleset.sh` (Changelog gates / shellcheck + yamllint / Scan for committed secrets / Supply chain gates / Playground tests).
- [x] `run-watchdog.sh` מאמת שכל context עדיין נדרש ב-branch-protection (דרך `GET /repos/.../rules/branches/main`) + הריצה האחרונה על main ירוקה.
- [x] שער שהוסר מ-branch-protection מסומן 🚨 גם אם הקובץ קיים (נבדק ב-bats: `bp red: context dropped...`).
- [x] CI ירוק על ה-PR (#243) + ריצה אמיתית של השומר אומתה: `done ok=10 warn=0 red=0 unknown=0`, 5 השערים ✅, `telegram='ok'`.

**הערת התקדמות אחרונה:** **שלב 2 הושלם ואומת** — PR #243 מוזג, וריצת השומר על main החזירה `ok=10` (כל 5 שערי ה-CI ירוקים: נדרשים בהגנת-הענף + ריצה אחרונה ירוקה). הדוח נשלח לטלגרם.

**שינוי תוכנית:** —

---

### שלב 3 — hooks + workflows מונעי-אירוע

**Acceptance:**
- [x] רשומות `static-integrity` לשני ה-hooks (`scripts/devplan-session-start-hook.sh`, `.claude/hooks/session-start.sh`) — בודקות קיום + הרשאת-הרצה + חיווט ב-`.claude/settings.json`.
- [x] רשומות `gh-last-run` ל-`protect-main`, `oil-autofix-verify`, `oil-autofix-investigate`,
      `deploy-mcp-server`, `eval-agent-router`. `eval-agent-router-precheck` (רק על PR, אין ריצות main) הוצא ל-`registry-exempt.txt` כהחלטה מודעת.
- [x] hook קיים-אך-לא-מחווט מסומן 🚨 (נבדק ב-bats); כל שורה עם קישור blob (hook) / workflow (event).
- [x] CI ירוק על ה-PR (#244) + ריצה אמיתית של השומר (17 רשומות). הריצה הראשונה תפסה false-positive (ראה תיקון למטה); אחרי התיקון מצופה `ok=17`.

**הערת התקדמות אחרונה:** שלב 3 מומש ומוזג (PR #244). **הריצה האמיתית הראשונה תפסה באג בקוד שלי** (לא באוטומציה): `oil-autofix-verify` רץ על כל push ל-main אבל מדלג (`skipped`) כשהקומיט אינו מיזוג-OIL — וזו התנהגות תקינה. הקוד שלי התייחס לכל תוצאה שאינה `success` ככשל, אז סימן `skipped` רצוף כ-🚨 (`ok=16 red=1` + `factory.watchdog.degraded` שגוי + כרטיס Linear שגוי). **תוקן** ב-PR נפרד: helper `_conclusion_is_failing` שמסווג `skipped`/`neutral` כתקין, מיושם בכל שלוש שיטות ההוכחה מבוססות-הריצות + 3 בדיקות bats. נותר: למזג את התיקון, לאמת `ok=17`, ולסגור את כרטיס ה-Linear השגוי.

**שינוי תוכנית:** `eval-agent-router-precheck` הוצא להיתר (PR-only) במקום רשומה — שיטת `gh-last-run` בודקת main, ול-precheck אין ריצות main; זו החלטה מתועדת בקובץ ההיתר.

---

### שלב 4 — כיסוי n8n/מערכות + provenance

**Acceptance:**
- [x] `run-watchdog.sh` מאמת ביצועי n8n דרך ה-REST API per-system (`gh` proof `n8n-execution`, fan-out דינמי): קורא `n8n-api-key` מ-SM של כל מערכת ושואל `GET /api/v1/executions?limit=1`. רשומת `system-n8n-executions` ב-`enabled:true`.
- [x] מערכות שלא ניתן לפתור מסומנות "❓" ולא 🚨 (אין-מפתח/אין-ביצוע/לא-פרוס; 0 מערכות → ❓). `factory-test-25` המשותף מדולג.
- [x] הדוח היומי (טלגרם + step-summary) כולל שורת provenance: כתובת ריצת השומר + SHA קצר.
- [ ] CI ירוק על ה-PR + ריצה אמיתית של השומר (18 רשומות) באישור Or. (E2E של ✅/🚨 per-system יתאפשר רק כשתיפרס מערכת אמיתית — עד אז שורת n8n = ❓.)

**הערת התקדמות אחרונה:** מומש: שיטת `n8n-execution` (fan-out דינמי כמו `system-runtime-audit`) + helper `_n8n_latest_status` + רשומת `system-n8n-executions` בפנקס + שורת provenance בדוח + עדכון README. שדרגתי `CURRENT_STAGE` ל-4. אימות מקומי: shellcheck נקי, כל 27 בדיקות ה-bats עוברות (6 חדשות ל-n8n), וסמוק-ראן על הפנקס המלא (18 רשומות) מסתיים ב-exit 0 עם שורת n8n=❓ ("אין מערכות פרוסות") ושורת provenance תקינה. נותר: מיזוג + ריצה אמיתית.

**שינוי תוכנית:** במקום רשומה-לכל-מערכת (סטטית), נבחר **fan-out דינמי** — רשומה אחת שמונה את המערכות בזמן-ריצה (מערכות נוצרות/נמחקות דינמית; זהה לדפוס `system-runtime-audit.yml`). מאחר שאין כרגע מערכת אמיתית פרוסה, הוכחת ✅/🚨 per-system תאומת מול n8n חי רק בעתיד; v1 מאומת ביוניט-טסטים + ריצה אמיתית שמראה ❓.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- **שלב 1** — הקמנו את "השומר-העל": כל בוקר הוא בודק שכל אוטומציה רצה, שולח לך דוח בטלגרם, ויש שומר חיצוני שתופס אם השומר עצמו מת.
- **שלב 2** — השומר מוודא שכל 5 שערי הבטיחות של ה-CI עדיין נאכפים באמת (לא רק שהקובץ קיים).
- **שלב 3** — נוספו ה-hooks וה-workflows מונעי-האירוע. כאן נתפס באג קטן שלי (התייחס ל"דילוג" תקין ככשל) — תוקן מיד.
- **שלב 4** — השומר יודע לבדוק גם את ה-n8n של כל מערכת עתידית, וכל דוח חתום בקישור לריצה שהפיקה אותו (אי אפשר לזייף).
