---
dev_name: טוקן Gmail משותף לכל המערכות
slug: shared-gmail-token
opened: 2026-06-06
status: completed
---

# תוכנית פיתוח — טוקן Gmail משותף

## מטרה

מפתח Gmail אחד מרכזי שכל מערכת חדשה מהפקטורי תשתמש בו (כולן מצביעות לאותו חשבון של אור).
הטוקן מחולץ מ-or-adhd-agent ל-SM שלו, מורם ל-control, ומשם מופץ אוטומטית לכל מערכת חדשה
(`copy-generic-secrets.sh`). מערכות חדשות יטענו אותו ל-n8n בלי קליק (או בקליק אחד כ-fallback).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | copy-gmail-oauth-to-control מעתיק refresh-token כערך כשקיים | completed | `.github/workflows/copy-gmail-oauth-to-control.yml` |
| 2 | תבנית מערכת: bootstrap-gmail-oauth שמחבר מהטוקן המשותף | completed | `templates/system/.github/workflows/bootstrap-gmail-oauth.yml`, `.github/workflows/provision-system.yml` |
| 3 | ניקוי הודעה: ללא קישור consent במסלול האוטומטי | completed | `templates/system/.github/workflows/bootstrap-gmail-oauth.yml` |

> **סגירה (2026-06-10, נקפל לתוך mcp-birth-bundle PR-A):** קוד שלב 3 כבר מוזג ב-2026-06-06
> (fragment ‏`2026-06-06-shared-gmail-token-msg-cleanup.md`; המסלול האוטומטי שולח הודעת
> "מחובר אוטומטית ✅" בלי קישור consent — שורות 155–170 בתבנית), והתוכנית פשוט לא נסגרה.
> ההוכחה החיה של המסלול האוטומטי רכבה על פיתוח google-mcp-systems (מערכת factory-test-045
> התחברה מהטוקן המשותף). הערה צופה-פני-עתיד: scope התבנית הורחב עכשיו ל-6
> (drive+documents) במסגרת mcp-birth-bundle שלב 4 — אותו עיקרון "ללא קליק" נשמר.

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — copy workflow: value-when-present

עדכון `copy-gmail-oauth-to-control.yml` כך ש-`gmail-oauth-refresh-token` מועתק כערך
ל-control כשהמקור (factory-test-7) כבר מכיל אותו (אחרי הרצת
`extract-gmail-refresh-token.yml` בצד or-adhd-agent), ונשאר מעטפה ריקה (no-op) לפני כן.
ברגע שיש ערך ב-control, ההפצה למערכות חדשות אוטומטית (אין שינוי ב-copy-generic-secrets).

**Acceptance:**
- [ ] re-run של ה-workflow מעתיק את הערך כש-factory-test-7 מכיל אותו.
- [ ] לפני החילוץ — no-op (מעטפה בלבד), בלי כשל.
- [ ] `gmail-oauth-refresh-token` ב-control מקבל גרסה (0→1).

### שלב 2 — תבנית: bootstrap-gmail-oauth למערכות חדשות

הוספת workflow לתבנית המערכת שטוען קרדנציאל googleOAuth2Api עם `oauthTokenData`
מהסוד המשותף (ללא קליק consent), עם fallback לזרימת ה-consent בקליק אחד אם הטעינה
המוקדמת לא מאשרת. כולל רענון golden + רישום ב-registry-exempt. נבדק על מערכת בדיקה זמנית.

**Acceptance:**
- [ ] מערכת בדיקה זמנית מתחברת ל-Gmail (בלי קליק, או קליק אחד כ-fallback).
- [ ] golden מסונכרן, registry-exempt מעודכן.
