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
| 1 | יסוד: פנקס + שומר-יומי (workflows מתוזמנים) + שער-CI + dead-man's-switch | in-progress | `monitoring/watchdog-registry.json`, `monitoring/README.md`, `monitoring/registry-exempt.txt`, `scripts/run-watchdog.sh`, `.github/workflows/meta-monitoring-watchdog.yml`, `scripts/check-watchdog-registry-updated.sh`, `scripts/create-watchdog-heartbeat.sh`, `.github/workflows/changelog-check.yml`, `scripts/tests/run-watchdog.bats`, `scripts/tests/check-watchdog-registry-updated.bats` |
| 2 | כיסוי שערי ה-CI (push/PR) עם הוכחת branch-protection | pending | `monitoring/watchdog-registry.json`, `scripts/run-watchdog.sh` |
| 3 | hooks (static-integrity) + workflows מונעי-אירוע (last-real-run) | pending | `monitoring/watchdog-registry.json`, `scripts/run-watchdog.sh` |
| 4 | כיסוי n8n/מערכות (n8n-execution) + provenance לדוח | pending | `monitoring/watchdog-registry.json`, `scripts/run-watchdog.sh` |

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
- [ ] Playground + שאר שערי ה-CI ירוקים על ה-PR.

**הערת התקדמות אחרונה:** מומש מלא ונבדק מקומית — shellcheck (severity=error), yamllint, actionlint, ו-12 בדיקות bats חדשות (לוגיקת freshness + שער הפנקס) ירוקות; כל חבילת ה-bats (44) עוברת; ריצת-עשן של `run-watchdog.sh` מול הפנקס האמיתי מסתיימת ב-exit 0. נותר: לאמת ירוק על ה-PR, ואז הקמת ה-heartbeat האמיתי (dispatch עם `setup_heartbeat=true`) באישור Or.

**שינוי תוכנית:** —

---

### שלב 2 — כיסוי שערי ה-CI (push/PR)

**Acceptance:**
- [ ] רשומות לפנקס עבור 5 שערי ה-CI (`changelog-check`, `pipeline-tests`, `secret-scan`,
      `supply-chain-check`, `playground-tests`) עם `proof_method: gh-branch-protection`.
- [ ] `run-watchdog.sh` מאמת שכל context עדיין נדרש ב-branch-protection + הריצה האחרונה על main ירוקה.
- [ ] שער שהוסר מ-branch-protection מסומן 🚨 גם אם הקובץ קיים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — hooks + workflows מונעי-אירוע

**Acceptance:**
- [ ] רשומות `static-integrity` לשני ה-hooks (`scripts/devplan-session-start-hook.sh`, `.claude/hooks/session-start.sh`).
- [ ] רשומות last-real-run ל-`protect-main`, `oil-autofix-verify`, `oil-autofix-investigate`,
      `deploy-mcp-server`, `eval-agent-router(-precheck)`.
- [ ] hook קיים-אך-לא-מחווט מסומן 🚨; כל שורה עם קישור blob/run.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — כיסוי n8n/מערכות + provenance

**Acceptance:**
- [ ] `run-watchdog.sh` מאמת ביצועי n8n דרך ה-REST API per-system; רשומות ה-n8n עוברות ל-`enabled:true`.
- [ ] מערכות שלא ניתן לפתור מסומנות "❓" ולא 🚨 (reuse-mode לא ב-folder).
- [ ] הדוח היומי כולל את כתובת הריצה של השומר עצמו + SHA (green ניתן-למעקב).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- <מתמלא תוך כדי>
