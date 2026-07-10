---
dev_name: עצמאות מערכת מול הפקטורי — ערוצי בקשה חדשים
slug: system-self-sufficiency-channels
opened: 2026-07-10
status: active
---

# תוכנית פיתוח — ערוצי עצמאות מערכת (צד הפקטורי)

## מטרה

הצד-הפקטורי של מהלך "עצמאות or-aios מול הפקטורי". מרחיב את ערוץ הבקשות המוכח
(`request-factory-resource` → Linear → MCP triage → Telegram ✅ → broker) בשני סוגי-בקשה
חדשים: **`sync`** (משיכה-יזומה של ערך סוד-משותף מ-control ל-SM של המערכת) ו-**`promote`**
(קידום artifact לתבנית `templates/system/**` דרך PR-טיוטה שהברוקר פותח בפקטורי). כל פעולה
מסוכנת נשארת broker-מבוצעת + Or-מאושרת. תיעוד הרקע: `devplans` בצד or-aios + התוכנית בסשן.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| A | `sync` request_type (משיכת סוד-משותף) | in-progress | `scripts/validate-system-request.sh`, `scripts/fulfill-system-request.sh` (ללא שינוי — sync לא עובר דרכו), `.github/workflows/fulfill-system-request.yml`, `services/mcp-server/src/system-request.ts`, `scripts/tests/validate-system-request.bats`, `docs/system-resource-requests.md` |
| B | `promote` request_type + מבצע-PR חדש | pending | `scripts/fulfill-promote-request.sh` (חדש), `.github/workflows/fulfill-promote-request.yml` (חדש), `scripts/validate-system-request.sh`, `services/mcp-server/src/system-request.ts` |

> הוכחה בכל שלב: שלב נסגר רק אחרי הוכחה חיה (round-trip אמיתי עם ✅ של Or), לא "CI ירוק" בלבד.

---

### שלב A — `sync` request_type

**Acceptance:**
- [x] `validate-system-request.sh`: `sync` case עם `SYNC_ALLOWLIST` (default-deny) + כל סירובי
      ה-super-credential/privileged-keyword כמו ב-secret.
- [x] `fulfill-system-request.yml`: `sync` בוולידציה; צעד-העתקה ייעודי (control→system, ערך piped,
      never logged), המבצע הקיים מוגבל ל-secret/iam.
- [x] `system-request.ts`: `sync` בשלושת ה-type-guards + actionLine ייעודי בכרטיס.
- [x] בדיקות: 8 מקרי `sync` ב-bats (allow-allowlisted / refuse-non-allowlisted / super-cred / כו').
- [ ] הוכחה חיה: מ-or-aios `request_type=sync` על סוד מותר → Telegram ✅ → גרסה חדשה נוחתת ב-SM של or-aios.

**הוכחה תפקודית (באותו שלב):** ההוכחה החיה מתבצעת אחרי מיזוג (ה-MCP חייב redeploy), עם round-trip
טלגרם אמיתי. שער ה-CI (bats + tsc + shellcheck) הוא ההוכחה הסטטית.

**הערת התקדמות אחרונה:** קוד + בדיקות סטטיות ירוקות מקומית (bats 38/38, mcp 6/6, tsc נקי). ממתין למיזוג + הוכחה חיה.

**שינוי תוכנית:** `sync` לא נותב דרך `fulfill-system-request.sh` (ששומר על "לעולם לא ערך") אלא כצעד-broker נפרד ב-workflow — החלטת-תכן להימנע מהחלשת האינוריאנט.

---

### שלב B — `promote` request_type

**Acceptance:**
- [ ] מבצע-PR חדש שמביא artifact לתבנית + מרענן golden + פותח PR-טיוטה בפקטורי (דפוס OIL).
- [ ] הוכחה חיה: מ-or-aios `promote` → Telegram ✅ → PR-טיוטה נפתח בפקטורי עם ה-artifact + golden מרוענן.

**הוכחה תפקודית (באותו שלב):** round-trip חי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב A (קוד) הושלם — נבנה ערוץ שבו or-aios יכולה לבקש למשוך סוד-משותף מעודכן, באישורך.
