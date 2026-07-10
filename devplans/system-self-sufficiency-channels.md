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
| C | `merge` request_type (card-free, יוצר≠מאשר ללולאת התיקון-העצמי של or-aios) | in-progress | `system-request.ts`, `test/system-request.test.mjs`, `docs/system-resource-requests.md` |

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

**הערת התקדמות אחרונה:** קוד מוזג (PR #581), MCP נפרס. הוכחה חיה ראשונה תפסה באג: הברוקר לא הצליח
לדחוף לפקטורי כי `checkout` שמר את `GITHUB_TOKEN` והתנגש ב-token של הברוקר. תוקן (`persist-credentials: false`
+ חשיפת השגיאה). ממתין למיזוג התיקון + הוכחה חוזרת.

**שינוי תוכנית:** —

---

### שלב C — `merge` request_type (card-free, יוצר≠מאשר)

הצד-הפקטורי של C2b-2 בלולאת התיקון-העצמי של or-aios. or-aios כבר מקבלת את ה-✅ שלך על **הבוט שלה**;
אחרי זה היא מבקשת מ**מאשר-הפקטורי** (App נפרד מזה שכתב את ה-PR) לבצע את המיזוג — כך שהמזג אינו מי
שכתב את הקוד (יוצר≠מאשר). אין כרטיס טלגרם חדש כאן.

**Acceptance:**
- [x] `system-request.ts`: ענף `merge` card-free ב-`dispatchSystemRequest` שחוזר **לפני** מסלול-הכרטיס
      (merge לעולם לא מגיע ל-`registerSystemRequest` / ל-fulfiller). קורא PR דרך הברוקר (`apiGet`),
      מאמת דרך הפרדיקט הטהור `isMergeableSelffixPr`, וממזג דרך `mergePullRequestAsApprover` הקיים.
- [x] פינים fail-closed: מערכת=or-aios, base=main, head=`oil-(selffix|autofix)/*`, PR פתוח, יוצר=App
      של המערכת (`EXPECTED_SELFFIX_AUTHOR`). קריאה=ברוקר, מיזוג=מאשר — שני Apps נפרדים.
- [x] בדיקות: 6 מקרי `isMergeableSelffixPr` ב-`test/system-request.test.mjs` (tsc נקי, 156/156 mcp).
- [x] `docs/system-resource-requests.md`: שורת `merge` (מתועד כ-internal/card-free).
- [ ] הוכחה חיה: or-aios מזהה באג → PR-טיוטה ע"י `or-aios-app[bot]` → ✅ שלך → `oil-selfmerge` פולט
      `system.request.merge` → מאשר-הפקטורי ממזג. אימות: actor-המיזוג = `oil-autofix-approver[bot]`,
      **שונה** מיוצר ה-PR `or-aios-app[bot]`.

**הוכחה תפקודית (באותו שלב):** round-trip חי אחרי מיזוג (ה-MCP חייב redeploy דרך ה-push trigger).
שער ה-CI (tsc + mcp tests) = הוכחה סטטית.

**הערת התקדמות אחרונה:** קוד + בדיקות ירוקות מקומית (tsc נקי, 156/156). ממתין למיזוג + redeploy + הוכחה חיה.

**שינוי תוכנית:** ה-`merge` נשאר לגמרי בתוך `dispatchSystemRequest` וחוזר לפני שער-הכרטיס — fail-closed
חזק יותר מהוספתו ל-type-guards של `parseRequestFromDescription`/`registerSystemRequest` (merge לעולם
לא נוגע במסלול הכרטיס או ה-fulfiller). ניתוב = Option B1: `oil-selfmerge.yml` של or-aios הופך לפולט-בקשה.

---

## יומן ל-Or (עברית)

- שלב A (קוד) הושלם — נבנה ערוץ שבו or-aios יכולה לבקש למשוך סוד-משותף מעודכן, באישורך.
