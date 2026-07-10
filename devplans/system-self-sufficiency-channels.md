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
| A | `sync` request_type (משיכת סוד-משותף) | completed | `validate-system-request.sh`, `fulfill-system-request.yml`, `system-request.ts`, bats, docs |
| B | `promote` request_type + מבצע-PR חדש | in-progress | `.github/workflows/fulfill-promote-request.yml` (חדש), `validate-system-request.sh`, `system-request.ts`, bats, `docs/system-resource-requests.md`, `monitoring/registry-exempt.txt` |

> הוכחה בכל שלב: שלב נסגר רק אחרי הוכחה חיה (round-trip אמיתי עם ✅ של Or), לא "CI ירוק" בלבד.

---

### שלב A — `sync` request_type ✅ הושלם ואומת חי

**Acceptance:**
- [x] `validate-system-request.sh`: `sync` case עם `SYNC_ALLOWLIST` (default-deny) + כל הסירובים.
- [x] `fulfill-system-request.yml`: `sync` בוולידציה + צעד-העתקה ייעודי; המבצע הקיים מוגבל ל-secret/iam.
- [x] `system-request.ts`: `sync` ב-type-guards + actionLine.
- [x] בדיקות: 8 מקרי `sync` ב-bats.
- [x] הוכחה חיה: PR #580 מוזג, MCP נפרס, or-aios ביקשה `sync` על tavily-api-key → Or ✅ → הועתק
      (run 29100856081, step "Sync" success); OIL-81 סגור.

**הוכחה תפקודית (באותו שלב):** ההוכחה החיה מתבצעת אחרי מיזוג (ה-MCP חייב redeploy), עם round-trip
טלגרם אמיתי. שער ה-CI (bats + tsc + shellcheck) הוא ההוכחה הסטטית.

**הערת התקדמות אחרונה:** קוד + בדיקות סטטיות ירוקות מקומית (bats 38/38, mcp 6/6, tsc נקי). ממתין למיזוג + הוכחה חיה.

**שינוי תוכנית:** `sync` לא נותב דרך `fulfill-system-request.sh` (ששומר על "לעולם לא ערך") אלא כצעד-broker נפרד ב-workflow — החלטת-תכן להימנע מהחלשת האינוריאנט.

---

### שלב B — `promote` request_type (צינור הפוך)

**Acceptance:**
- [x] `validate-system-request.sh`: `promote` case (docs-only MVP, target תחת templates/system, בלי traversal); GCP-checks מדולגים ל-promote.
- [x] `.github/workflows/fulfill-promote-request.yml` (חדש): register=שער+כרטיס; fulfill=מושך doc מריפו המערכת → כותב לתבנית → מרענן golden → fragment+devplan → PR-טיוטה (דפוס OIL, שני tokens ממוקדים).
- [x] `system-request.ts`: `promote` ב-type-guards + ניתוב לפי-סוג (`fulfillWorkflowFor`) + inputs ייעודיים + actionLine.
- [x] בדיקות: 9 מקרי `promote` ב-bats (allow doc / refuse traversal / refuse .sh / refuse outside-template / כו'); tsc נקי; MCP 6/6.
- [x] `monitoring/registry-exempt.txt` + `docs/system-resource-requests.md` עודכנו.
- [ ] הוכחה חיה: מ-or-aios `promote` של מסמך → Telegram ✅ → PR-טיוטה נפתח בפקטורי עם המסמך + golden מרוענן.

**הוכחה תפקודית (באותו שלב):** round-trip חי אחרי מיזוג (ה-MCP חייב redeploy). שער ה-CI = הוכחה סטטית.

**הערת התקדמות אחרונה:** קוד + בדיקות סטטיות ירוקות מקומית. ממתין למיזוג (deploy) + הוכחה חיה.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב A (קוד) הושלם — נבנה ערוץ שבו or-aios יכולה לבקש למשוך סוד-משותף מעודכן, באישורך.
