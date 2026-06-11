---
dev_name: היגיינת רובוט-התיקונים
slug: robot-hygiene
opened: 2026-06-10
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — היגיינת רובוט-התיקונים

## מטרה

שלושה תיקוני־היגיינה קטנים ועצמאיים לאוטומציה של הפקטורי (follow-ups #6/#8/#9 מתוך
סגירת `mcp-birth-bundle`): (1) שער־הפיתוח יפסיק לחסום את ה־PR של רובוט־התיקונים
(`oil-autofix/*`); (2) שער־הסיכונים של GCP יתפוס פקודת `gcloud gcloud` כפולה לפני
שליחה לאישור; (3) רובוט־התיקונים יכתוב פתית `changelog.d/` במקום להדביק לראש
`CHANGELOG.md` (מה ששבר את שער־הגודל ב-PR #374).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | פטור ל-`oil-autofix/*` בשער-הפיתוח (#9) | completed | `scripts/check-devplan-updated.sh`, `scripts/tests/check-devplan-updated.bats` |
| 2 | תפיסת `gcloud gcloud` כפול בשער-הסיכונים (#8) | completed | `scripts/gcp-classify.sh`, `scripts/test-gcp-classify.sh`, `tests/gcp-classify-fixtures.yml` |
| 3 | רובוט-התיקונים כותב פתית `changelog.d/` (#6) | completed | `scripts/oil-changelog-fragment.sh` (חדש), `.github/workflows/oil-autofix-investigate.yml`, `scripts/tests/oil-changelog-fragment.bats`, `docs/oil-autofix.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב* — לא
> "CI ירוק" בלבד. כל שלב פה הוא קוד/סקריפט ניתן-להרצה עם הוכחת fail-before/pass-after.

---

### שלב 1 — פטור ל-`oil-autofix/*` בשער-הפיתוח (#9)

**Acceptance:**
- [x] `check-devplan-updated.sh` מדלג (exit 0) כשהענף הוא `oil-autofix/*` (קורא
      `GITHUB_HEAD_REF` ואז `GITHUB_REF_NAME`), בלי לשנות שום workflow.
- [x] בדיקת bats חדשה מוכיחה: תוכנית פעילה + שינוי קוד + בלי עדכון תוכנית, אבל ענף
      `oil-autofix/*` → PASS. ה-setup מנקה את משתני־הסביבה (hermetic).
- [x] כל הבדיקות הקיימות ב-`check-devplan-updated.bats` עדיין עוברות.

**הוכחה תפקודית (באותו שלב):** הרצת `./scripts/tests/bats/bin/bats
scripts/tests/check-devplan-updated.bats` → ירוק כולל הבדיקה החדשה. fail-before: אותה
בדיקה מול הסקריפט הישן נכשלת (השער חוסם). אימות בלתי-תלוי-MCP.

**הערת התקדמות אחרונה:** הושלם ואומת מקומית. shellcheck נקי; כל 7 בדיקות ה-bats עוברות
(כולל 2 חדשות: פטור דרך `GITHUB_HEAD_REF` ודרך `GITHUB_REF_NAME`). fail-before הודגם:
מול הסקריפט הישן שתי החדשות נכשלות ("Active development(s) detected"). CI ב-PR #386 ירוק (כל 5 הבדיקות).

**שינוי תוכנית:** —

---

### שלב 2 — תפיסת `gcloud gcloud` כפול בשער-הסיכונים (#8)

**Acceptance:**
- [x] `gcp-classify.sh` יוצא non-zero (exit 3) עם הודעת שגיאה ברורה כשהטוקן הראשון הוא
      `gcloud` (תופס גם `gcloud gcloud ...` וגם `gcloud` יחיד — שניהם פסולים לפי החוזה).
- [x] `test-gcp-classify.sh` תומך בציפיית `reject` (יציאה non-zero) ב-fixture.
- [x] שתי שורות fixture חדשות (`gcloud gcloud ...`, `gcloud secrets list`) → `reject`.
- [x] אין רגרסיה: כל ה-fixtures הירוקים/צהובים/אדומים הקיימים נשארים כשהיו.

**הוכחה תפקודית (באותו שלב):** `bash scripts/test-gcp-classify.sh` עובר כולל שורות
ה-reject; הרצה ישירה `bash scripts/gcp-classify.sh "gcloud gcloud projects describe x"`
מחזירה exit 3 + הודעה (fail-before: קודם החזיר `{"tier":"red",...}` exit 0).

**הערת התקדמות אחרונה:** הושלם ואומת מקומית. shellcheck נקי; 11/11 fixtures עוברים (כולל
2 reject); פקודה רגילה עדיין מסווגת green (אין רגרסיה). fail-before הודגם (המסווג הישן
נתן red exit 0). אומת גם ששרשרת ה-`set -e` ב-`gcp-action.yml` עוצרת את הפקודה לפני שלב
האישור (exit 3, "REACHED APPROVAL POST" לא נדפס). CI ב-PR #386 ירוק (כל 5 הבדיקות).

**שינוי תוכנית:** —

---

### שלב 3 — רובוט-התיקונים כותב פתית `changelog.d/` (#6)

**Acceptance:**
- [x] סקריפט חדש `scripts/oil-changelog-fragment.sh` (יצירת-קובץ טהורה, ניתן-לבדיקה)
      כותב פתית `changelog.d/<date>-oil-autofix-<short>.md` בפורמט ש-`compile-changelog.sh`
      יודע לקפל, ומחטא `|`/שורות-חדשות מהקלט של ה-AI כדי לא לשבור את הטבלה.
- [x] `oil-autofix-investigate.yml` קורא לסקריפט במקום ה-prepend היש ל-`CHANGELOG.md`.
- [x] בדיקת bats חדשה מקפלת את הפתית דרך `compile-changelog.sh` האמיתי ומוכיחה תוצאה.
- [x] `docs/oil-autofix.md` מעודכן (כותב פתית, לא ראש CHANGELOG.md).

**הוכחה תפקודית (באותו שלב):** `./scripts/tests/bats/bin/bats
scripts/tests/oil-changelog-fragment.bats` עובר; בנוסף קיפול הפתית שנוצר דרך
`compile-changelog.sh` אמיתי בעותק-זמני מראה `## Stage N — fix: oil-autofix — OIL-49`.

**הערת התקדמות אחרונה:** הושלם ואומת מקומית. shellcheck + yamllint נקיים; 3/3 בדיקות bats
עוברות (יצירת פתית, תאימות-קיפול דרך ה-compile האמיתי, וחיטוי `|`). הודגם end-to-end:
הפתית מתקפל ל-`## Stage 1 — fix: oil-autofix — OIL-49`. הערה: אין התנגשות עם מכסת
2-הקבצים של שער-הבטיחות — הפתית נכתב ע"י ה-workflow *אחרי* השער, כקומיט נפרד.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — מעכשיו ה־PR של רובוט־התיקונים לא ייחסם יותר על־ידי שער־הפיתוח (זה מה שתקע את OIL-49 הבוקר).
- שלב 2 הושלם — שער־הסיכונים של GCP יתפוס פקודת `gcloud gcloud` כפולה ויפסול אותה לפני שתגיע לאישור שלך.
- שלב 3 הושלם — רובוט־התיקונים כותב מעכשיו קובץ־פתית קטן ב־`changelog.d/` במקום להדביק לראש `CHANGELOG.md` (מה ששבר את שער־הגודל ב־PR #374).
- הפיתוח הושלם — שלושת התיקונים בוצעו, הוכחו, ועברו CI. התוכנית נסגרה (`status: completed`).
