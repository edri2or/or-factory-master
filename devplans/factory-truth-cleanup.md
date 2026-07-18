<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל ע"י /dev-stage. הזיכרון/המצפן של הסוכן, לא חומר קריאה ל-Or.
-->
---
dev_name: ניקוי-אמת סופי של הקיפול
slug: factory-truth-cleanup
opened: 2026-07-18
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — ניקוי-אמת סופי של הקיפול

## מטרה

הקיפול של or-factory-master (devplan `factory-dismantle`, שנסגר) נותר עם שאריות אמיתיות של
"מכונת-הייצור" ועם סחף-תיעוד — בניגוד להנדאוף שטען "אין קצוות פתוחים". פיתוח זה מוכיח את המצב,
מנקה את השאריות, ומיישר את התיעוד למציאות, כך שהריפו נקי בפועל ותיעודו מדויק. (or-aios נמצא נקי.)

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | Tier A — מחיקת 5 skills-מפעל מתות + יישור תיעוד (README/CLAUDE/8 docs + מחיקת capability-cards) | done | `skills/{build-system,register-system-app,decommission-system,decommission-test-system,health-check}`, `README.md`, `CLAUDE.md`, `docs/*` |
| 2 | Tier B — הסרת ערוץ fulfill-system-request מקצה-לקצה (workflow+scripts+bats+doc+gateway-wiring) | pending | `.github/workflows/fulfill-system-request.yml`, `scripts/{fulfill,validate}-system-request.sh`, `scripts/tests/validate-system-request.bats`, `services/mcp-server/src/{system-request.ts,index.ts,oil-autofix.ts,telegram-chat*.ts}`, `docs/system-resource-requests.md` |
| 3 | הוכחה חיה מקצה-לקצה (Google/GitHub/n8n/תשתית/invariants) + דוח-הוכחה | pending | (בדיקות חיות; דוח) |

## החלטות

- **OIL נשאר.** `oil-autofix.ts` שזור עמוק ב-gateway וסומן load-bearing (הנדאוף). לא נמחק; רק תוקן
  תיאור-האמת ב-CLAUDE.md (הוא לא "כבר נמחק" כפי שנטען). ענף ה-`system.request.` בלבד יוסר ב-Tier B.
- **allowlist תקין.** `deploy-railway-cloudflare.yml`/`configure-agent-router.yml` קיימים ב-or-aios
  (workflows של מערכת-יעד) — לא שאריות.
- **Tier B = פריסת gateway מנדטורי.** מיזוגו מפעיל `deploy-mcp-server.yml`; עצירה לאישור מפורש של Or
  לפני מיזוג, ואימות בשער ה-smoke התלת-משטחי + `google-mcp-smoke` חי.
