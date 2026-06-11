<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: בלם אימות E2E אכיף
slug: e2e-verification-gate
opened: 2026-06-11
status: active
---

# תוכנית פיתוח — בלם אימות E2E אכיף

## מטרה

לבנות "בלם טכני" אכיף ברמת השרת (כמו `protect-main`) שחוסם מיזוג והכרזת "done" עד
שקיים ועבר artifact של אימות E2E אמיתי — כזה ששולח באמת הודעה דרך מסלול ה-inbound
(Telegram→agent-router) ובודק את התשובה בפועל. המטרה: לסגור את הפער שבו "ריצה ירוקה"
או "קונפיג יובא" מתחזים ל"הפיצ'ר עובד", ולמנוע את דפוס ה"כשל השקט" שגרם לבאג המקורי.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מחקר + תיעוד הפער והסטנדרט | completed | `docs/e2e-verification-gate.md` |
| 2 | ה-driver: הרצת התנהגות אמיתית דרך ה-inbound | completed | `scripts/e2e-verify-inbound.sh` |
| 3 | workflow שמייצר הוכחה חתומה | pending | `.github/workflows/e2e-verify.yml`, `templates/system/.github/workflows/e2e-verify.yml` |
| 4 | השער האכיף + חיווט ל-ruleset + פרופגציה | pending | `scripts/check-e2e-proof.sh`, `*/e2e-gate.yml`, `ensure-protect-main-ruleset.sh`, `provision-system.yml`, golden |
| 5 | חיבור /dev-stage (שדה הוכחת-E2E + טקסט סגירה) | pending | `templates/devplan/DEVPLAN.template.md`, `.claude/commands/dev-stage*.md` |
| 6 | הוכחה חיה מקצה-לקצה על מערכת-טסט זרוקה | pending | (ריצות חיות; teardown ledger) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 1 — מחקר + תיעוד הפער והסטנדרט

**Acceptance:**
- [ ] `docs/e2e-verification-gate.md` ממפה היכן "ירוק מתחזה לעובד" (עם ציטוטי קבצים)
- [ ] מתעד את הסטנדרט המקצועי עם מקורות מתוארכים ודירוג להקשר
- [ ] מתאר את ארכיטקטורת הבלם (driver / proof / gate) ואת מבחן-העל

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד).

**הוכחת E2E (artifact):** לא-התנהגותי (שלב תוכן; לא נוגע בקבצי-התנהגות n8n).

**הערת התקדמות אחרונה:** הושלם — `docs/e2e-verification-gate.md` + התוכנית.

**שינוי תוכנית:** —

---

### שלב 2 — ה-driver: הרצת התנהגות אמיתית דרך ה-inbound

**Acceptance:**
- [ ] `scripts/e2e-verify-inbound.sh`: POST update סינתטי ל-inbound האמיתי, poll executions, assert התנהגות
- [ ] assert תופס "כשל שקט" (node errored / תשובה ריקה)
- [ ] shellcheck נקי

**הוכחה תפקודית (באותו שלב):** הרצה ידנית מול מערכת-טסט חיה — אדום כשהבוט שבור, ירוק
כשתקין. (חלק מההוכחה החיה מתבצע בשלב 6 כשמערכת-הטסט קמה; כאן: בדיקת לוגיקה + shellcheck.)

**הוכחת E2E (artifact):** הסקריפט עצמו אינו קובץ-התנהגות n8n; הוכחתו החיה היא שלב 6.

**הערת התקדמות אחרונה:** הושלם — shellcheck נקי; נבדק מקומית על execution סינתטי:
(א) קורלציה לפי nonce מוצאת את הריצה הנכונה ומחלצת את התשובה האמיתית; (ב) "כשל שקט"
(node עם `error` / `status=error`) נתפס ומפיל. אימות חי מלא בשלב 6.

**שינוי תוכנית:** ה-driver אינו קורא SM בעצמו — ה-workflow (שלב 3) מזרים סודות ב-env
(הפרדת אחריות, ומאפשר בדיקה מקומית). חישוב `content_hash`/חתימה עבר ל-workflow.

---

### שלב 3 — workflow שמייצר הוכחה חתומה

**Acceptance:**
- [ ] `e2e-verify.yml` (פקטורי) + תאומה במערכת: apply→drive→sign→commit→upload artifact
- [ ] proof JSON עם `content_hash`, `run_id`, `result`, `signature`
- [ ] yamllint/actionlint נקי

**הוכחה תפקודית (באותו שלב):** ריצה חיה מפיקה `e2e-proofs/*.json` תקין (שלב 6).

**הוכחת E2E (artifact):** מיוצר ע"י ה-workflow עצמו (שלב 6).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — השער האכיף + חיווט ל-ruleset + פרופגציה

**Acceptance:**
- [ ] `scripts/check-e2e-proof.sh`: no-op בלי קבצי-התנהגות; דורש proof תקף אחרת
- [ ] `e2e-gate.yml` (פקטורי + תבנית) עם `name: E2E verification gate`
- [ ] context נוסף ל-`ensure-protect-main-ruleset.sh` ול-`REQUIRED_CONTEXTS_JSON`
- [ ] scaffold loop + golden `--update`
- [ ] בדיקת לוגיקה מקומית: דיף עם קובץ-התנהגות בלי proof → exit 1; עם proof תואם → exit 0

**הוכחה תפקודית (באותו שלב):** הרצת `check-e2e-proof.sh` מקומית על fixtures (proof חסר/לא-תואם/תואם) → תוצאות נכונות.

**הוכחת E2E (artifact):** הסקריפט הוא תשתית-שער, לא קובץ-התנהגות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — חיבור /dev-stage

**Acceptance:**
- [ ] שדה `הוכחת E2E (artifact)` בתבנית devplan
- [ ] טקסט סגירת-שלב ב-`dev-stage-factory.md` + `dev-stage.md`
- [ ] sync-skills-mirror אם צריך

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — הוכחה חיה מקצה-לקצה (לב המשימה)

**Acceptance:**
- [ ] מערכת-טסט זרוקה (reuse, 0-quota) הוקמה באישור Or
- [ ] (א) כלי שבור → `e2e-verify` נכשל → אין proof → השער חוסם
- [ ] (ב) תיקון → `e2e-verify` עובר → proof תואם → השער מעביר
- [ ] קידום ל-main + teardown + Teardown ledger

**הוכחה תפקודית (באותו שלב):** הלולאה החיה למעלה — חוסם בכשל, מעביר בהצלחה.

**הוכחת E2E (artifact):** `e2e-proofs/e2e-verification-gate.json` מריצה חיה.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> ימולא בשלב 6: `torn-down — <date/session>` או `left-alive by user decision — <date/session>`.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — מסמך ייחוס שממפה איפה "ירוק" מתחזה ל"עובד" + הסטנדרט המקצועי + התוכנית.
- שלב 2 הושלם — נכתב המנוע ששולח הודעה אמיתית דרך מסלול הבוט ובודק את התשובה בפועל;
  נבדק שהוא תופס "כלי שמת בשקט".
