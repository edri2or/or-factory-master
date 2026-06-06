---
dev_name: ערוץ בקשת-משאבים מהמערכת אל ה-broker
slug: system-resource-request-channel
opened: 2026-06-06
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — ערוץ בקשת-משאבים מהמערכת אל ה-broker

## מטרה

מערכת שנוצרת מהפקטורי יכולה לרוץ, אבל לא יכולה *לבקש* משאב חדש: ה-`deploy-sa` שלה
יכול למלא סודות קיימים אבל לא ליצור סוד חדש, ואין לה שום ערוץ להגיע ל-broker. בונים
"ערוץ בקשה" מאובטח ומגודר באישור-אנושי (תאום של לולאת ה-OIL): המערכת *מבקשת* דרך
`emit-event.sh` → פנייה ב-Linear → ה-MCP מנתב → Or מאשר ב-✅ אחד בטלגרם → ה-broker
(היחיד המורשה) *מבצע* (יוצר סוד / מעניק הרשאת-IAM מרשימה-לבנה) → מאמת, מתעד, וסוגר.
v1: שני סוגי-בקשה — `secret` ו-`iam`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שער-בדיקת-בקשה דטרמיניסטי + בדיקות | completed | `scripts/validate-system-request.sh`, `scripts/tests/validate-system-request.bats` |
| 2 | סקריפט-מימוש (broker) + workflow המימוש | completed | `scripts/fulfill-system-request.sh`, `.github/workflows/fulfill-system-request.yml` |
| 3 | ניתוב MCP + מודול system-request + מסלולים + בדיקות TS | completed | `services/mcp-server/src/{oil-autofix,index,system-request}.ts`, `services/mcp-server/test/system-request.test.mjs` |
| 4 | הוכחה חיה על מערכת-טסט זמנית (עלות — אישור Or מפורש) | in-progress | — (תשתית חיה) |
| 5 | קידום (merge ל-main) + תיעוד | pending | `docs/system-resource-requests.md`, `CLAUDE.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — שער-בדיקת-בקשה דטרמיניסטי + בדיקות

שער `scripts/validate-system-request.sh` שמחליט אם בקשה לגיטימית — ללא שום נגיעה
ברשת/בענן (טהור, נבדק ב-bats). מסרב לפרויקטי-בקרה ול-`factory-test-25`, לסודות-על,
ולהרשאות מסלימות; ברירת-מחדל default-deny לתפקידי IAM (רשימה-לבנה מצומצמת).

**Acceptance:**
- [ ] מקבל בקשת `secret` תקינה ובקשת `iam` תקינה (תפקיד מהרשימה-הלבנה).
- [ ] מסרב: פרויקט-בקרה / `factory-test-25`, צורת-פרויקט/שם-מערכת לא תקינה, סוג-בקשה לא מוכר.
- [ ] מסרב סודות-על (`*-master-key`, `factory-master-broker-app-*`, שמות עם `broker/wif/private-key`).
- [ ] מסרב תפקידי-IAM מסלימים (`owner/editor/roles/iam.*/secretmanager.admin/serviceusage.*`) ותפקיד שלא ברשימה-הלבנה.
- [ ] מסרב member חיצוני; ברירת-מחדל = `deploy-sa`+`runtime-sa` של הפרויקט בלבד.
- [ ] `shellcheck` נקי + כל בדיקות ה-bats עוברות.

**הערת התקדמות אחרונה:** הושלם — `validate-system-request.sh` + 30 בדיקות bats עוברות, shellcheck נקי.

**שינוי תוכנית:** —

---

### שלב 2 — סקריפט-מימוש (broker) + workflow המימוש

`scripts/fulfill-system-request.sh` (חילוץ בלוק היצירה+הענקה מ-`provision-system.yml`,
אידמפוטנטי, לעולם לא קורא/מדפיס ערך-סוד) + `.github/workflows/fulfill-system-request.yml`
(שתי פאזות `register|fulfill`, אימות-broker ב-WIF נעול ל-main, השער מורץ בשתיהן). **לא**
מתווסף ל-`DISPATCHABLE_WORKFLOWS`.

**Acceptance:**
- [x] סקריפט המימוש אידמפוטנטי (משמר `describe`/policy); shellcheck נקי.
- [x] ה-workflow עובר yamllint/pinned-actions/permissions; פאזת register לא יוצרת כלום.

**הערת התקדמות אחרונה:** הושלם — `fulfill-system-request.sh` + `fulfill-system-request.yml` (שתי פאזות, אימות-broker, פתרון פרויקט אוטוריטטיבי ממשתנה ה-repo, השער מורץ בשתיהן). כל השערים הסטטיים ירוקים. עדיין לא הורץ חי.

**שינוי תוכנית:** ה-workflow משתמש ב-workflow_dispatch לשתי הפאזות (לא repository_dispatch) — כך גם ה-register (מ-MCP triage) וגם ה-fulfill (מקריאת ה-✅) עוברים דרך אותו ערוץ דיספּטץ' של ה-broker.

---

### שלב 3 — ניתוב MCP + מודול system-request + מסלולים + בדיקות TS

כלל-ניתוב חדש ב-`triage()` לפי תחילית `system.request.`, מודול-אח `system-request.ts`
(לא מעמיסים על `oil-approval.ts`), מסלול `POST /system-request-register` (מגודר admin),
וענף `sysreq:`/`sysno:` בנתב `/telegram-webhook`.

**Acceptance:**
- [x] בדיקות TS ירוקות (59/59, כולל 6 חדשות למפענחי ה-callback); `tsc` עובר.
- [x] כללי ה-OIL הקיימים נשארים ראשונים — ענף `system.request.` נוסף ב-handleLinearWebhook לפני triage, ולא משנה את התנהגות ה-OIL.

**הערת התקדמות אחרונה:** הושלם — `system-request.ts` (מודול-אח), כלל-ניתוב ב-`oil-autofix.ts`, מסלול `/system-request-register` + ענף `sysreq:`/`sysno:` ב-`/telegram-webhook` ב-`index.ts`, בדיקות ב-`system-request.test.mjs`. בלי import-cycle (המודול מפענח את ה-OTel מקומית). עדיין לא נפרס (deploy-mcp-server) — חלק משלב 4.

**שינוי תוכנית:** הבקשה מועלית עם `severity=info` + `action_required=true` (יוצר Linear בלי התראת-טלגרם גולמית); הניתוב תופס `system.request.` לפני כלל ה-info-skip.

---

### שלב 4 — הוכחה חיה על מערכת-טסט זמנית (עלות — אישור Or מפורש)

מערכת-טסט זמנית ב-reuse mode (`shared_gcp_project=factory-test-25`, 0 מכסה) → register →
deploy → המערכת מעלה בקשת `secret` אמיתית → Linear → MCP מנתב → ✅ בטלגרם → אימות שהסוד
נוצר חי וההרשאה הוענקה → המערכת מבצעת `versions add`. חזרה ל-`iam`. הוכחת-סירוב
(`*-master-key`/`roles/owner` → השער מסרב, אין כרטיס). פירוק דרך `decommission-test-system.yml`.

**Acceptance:**
- [ ] סבב בקשה→אישור→מימוש→אימות מלא עבר חי לשני הסוגים.
- [ ] הוכחת-סירוב עברה; המערכת-טסט פורקה ונרשמה ביומן.

**הערת התקדמות אחרונה:** #318 מוזג ל-main; ה-MCP נפרס מ-main ואומת חי (המסלול `/system-request-register` מחזיר 403). ההוכחה החיה הורצה על `tokile` (פניית Linear OIL-39) — והשרשרת Linear→MCP→דיספּטץ' עבדה, אבל ה-workflow נפל בשלב פתרון-הפרויקט (token צר מדי). תוקן ב-fast-follow (token מלא של ה-broker). ממתין למיזוג התיקון ואז הרצה חוזרת + הוכחת-סירוב.

**שינוי תוכנית:** במקום להקים מערכת-טסט חדשה — ההוכחה רצה על `tokile` הקיימת (פרויקט אמיתי `factory-test-18`, לא `factory-test-25` שהשער חוסם), עם סוד-בדיקה זמני שיימחק. חוסך פריסה + לחיצות. הוכחת מסלול ה-secret על tokile; הוכחת סירוב על בקשה אסורה.

---

### שלב 5 — קידום + תיעוד

`docs/system-resource-requests.md` חדש + מצביע ב-`CLAUDE.md`. סגירת הפיתוח.

**Acceptance:**
- [ ] תיעוד מלא; `status: completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## הגבלות ידועות (v1)

- אין חתימה פר-מערכת על הבקשה (כל המערכות חולקות `linear-api-key`), אז שם-המערכת
  בבקשה מוצהר-עצמית. ההגנה: השער חוסם פעולות מסוכנות, הפעולה מוגבלת ל-SA של המערכת
  עצמה, **ו**האישור האנושי בטלגרם מציג מערכת+יעד ותופס אי-התאמה. חתימה פר-מערכת = v2.
- ה-`iam` רשימה-לבנה מצומצמת בלבד; הרחבתה היא שינוי מגודר (PR + אישור Or).

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — נבנה "שומר הסף" שמחליט אילו בקשות לגיטימיות (30 בדיקות עוברות).
- שלב 2 הושלם — נבנה מי שמבצע בפועל (יוצר סוד / מעניק הרשאה) + ה-workflow עם אישור-אנושי.
- שלב 3 הושלם — נבנה החיווט: הבקשה מנותבת אוטומטית וכרטיס האישור נשלח לטלגרם. הכל עדיין רק קוד שעבר בדיקות — טרם הופעל חי.
