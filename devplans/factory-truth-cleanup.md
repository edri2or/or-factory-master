<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל ע"י /dev-stage. הזיכרון/המצפן של הסוכן, לא חומר קריאה ל-Or.
-->
---
dev_name: ניקוי-אמת סופי של הקיפול
slug: factory-truth-cleanup
opened: 2026-07-18
completed: 2026-07-18
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 2 | Tier B — הסרת ערוץ fulfill-system-request מקצה-לקצה (workflow+scripts+bats+doc+gateway-wiring) | done (PR ממתין ל-✅ פריסה) | `.github/workflows/fulfill-system-request.yml`, `scripts/{fulfill,validate}-system-request.sh`, `scripts/tests/validate-system-request.bats`, `services/mcp-server/src/{system-request.ts,index.ts,oil-autofix.ts,gcp-approval.ts,repo-approval.ts}`, `docs/system-resource-requests.md` |
| 3 | הוכחה חיה מקצה-לקצה (Google/GitHub/n8n/תשתית/invariants) + דוח-הוכחה | done | (בדיקות חיות; דוח-Artifact) |

## סגירה (2026-07-18)

הפיתוח הושלם ואומת חי. Tier A (#615) ו-Tier B (#616) מוזגו. פריסת ה-gateway אחרי Tier B עברה
במלואה כולל שער ה-smoke התלת-משטחי (run 29640862429, כל 34 השלבים SUCCESS), ו-`google-mcp-smoke`
עצמאי אחרי-פריסה = SUCCESS (run 29640973836) — מסלול גוגל של or-aios שלם. הוכחה חיה מלאה בוצעה:
גוגל (Gmail read+send אמיתי, יומן CRUD, Drive), GitHub (מחזור PR), n8n (health + 64 workflows +
dev-write בשער ה-smoke), תשתית (GCP 11/11, Railway, TLS), ושערי-האמת של or-aios (invariants/drift PASS).
**ממצא פתוח (החלטת Or):** or-aios הוא ריפו ציבורי (`private=false`) — הובא לידיעת Or, לא שונה.

## הערות ביצוע (Tier B)

- **ההסרה יצאה נקייה ותחומה** (לא כמו החשש הראשוני): `isMergeableSelffixPr` היה פנימי ל-system-request.ts
  בלבד (השם מטעה — שומר-מיזוג של הערוץ, לא של OIL); `repo-approval.ts`/`gcp-approval.ts` הזכירו את הערוץ
  ב**הערות בלבד** (לא imports); ענף ה-`system.request.` ב-oil-autofix היה if-בלוק מבודד.
- הוסר: המודול `system-request.ts` + הבדיקה שלו; ה-import וה-route `/system-request-register` ב-index.ts;
  ענף ה-callback ב-`/telegram-webhook`; ענף ה-`system.request.` ב-oil-autofix.ts. תוקנו הערות מיושנות
  (כולל הפניה ל-`oil-approval.ts` שנמחק ב-batch 5b) ב-gcp-approval/repo-approval/gcp-action.yml.
- **אומת מקומית לפני PR:** `tsc` build ✅, `npm test` → 119/119 ✅. שתי רשתות-ביטחון לפני חי: playground-tests
  (build+unit) ושער ה-smoke התלת-משטחי בפריסה.
- **גבול:** מיזוג ה-PR מפעיל פריסת gateway מנדטורי → ממתין ל-✅ מפורש של Or לפני מיזוג.

## החלטות

- **OIL נשאר.** `oil-autofix.ts` שזור עמוק ב-gateway וסומן load-bearing (הנדאוף). לא נמחק; רק תוקן
  תיאור-האמת ב-CLAUDE.md (הוא לא "כבר נמחק" כפי שנטען). ענף ה-`system.request.` בלבד יוסר ב-Tier B.
- **allowlist תקין.** `deploy-railway-cloudflare.yml`/`configure-agent-router.yml` קיימים ב-or-aios
  (workflows של מערכת-יעד) — לא שאריות.
- **Tier B = פריסת gateway מנדטורי.** מיזוגו מפעיל `deploy-mcp-server.yml`; עצירה לאישור מפורש של Or
  לפני מיזוג, ואימות בשער ה-smoke התלת-משטחי + `google-mcp-smoke` חי.
