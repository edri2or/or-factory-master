<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: חזית capability-first + תיקון הנחיית ה-Pin
slug: capability-first
opened: 2026-06-10
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — חזית capability-first + תיקון הנחיית ה-Pin

## מטרה

להוסיף לכל מערכת מסופקת שלב מקדים בבניית-סוכן: "הוכח שהיכולת הגולמית עובדת **מחוץ ל-n8n**
על דוגמה אמיתית, ואז החלט אם להתקדם" — לפני שבונים את הסוכן בתוך n8n. בנוסף, לתקן הנחיה מסוכנת
אחת (n8n עלול לדווח הצלחה תוך השמטת קובץ בינארי בשקט — כולל ב-pinning). זהו **השלמה ותיקון** של
מנגנון בניית-הסוכן הקיים (`build-agent` / `agent-design-spec` / `agent-isolation-testing`), לא
פלייבוק מקביל. בעיקר מסמכים + שינוי קטן בצנרת ההקמה — לא נוגעים בריצת המערכות עצמן.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | חומרי-ייחוס: מסמך capability-first + תיקוני Pin + Capability Card | completed | `docs/capability-first.md` (חדש), `templates/agent-design-spec.md`, `docs/agent-isolation-testing.md` |
| 2 | חיווט החזית ל-build-agent (שני עותקי mirror) + רענון golden | completed | `.claude/commands/build-agent.md`, `templates/system/.claude/commands/build-agent.md` (נגזר), `tests/golden/system/MANIFEST.sha256` (נגזר) |
| 3 | הזרקה ל-provisioning + פתק changelog | completed | `.github/workflows/provision-system.yml` |
| 4 | סקיל ייעודי `/prove-capability` (בקשת Or, בנוסף לחיווט) | completed | `.claude/commands/prove-capability.md`, `templates/system/.claude/commands/prove-capability.md` (נגזר), `tests/golden/system/MANIFEST.sha256` (נגזר) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהוא עובד *באותו שלב* — לא "CI ירוק" בלבד (הכרחי אך
> לא מספיק). הפיתוח הזה הוא מסמכים + צנרת, אז ה"הוכחה" היא: CI ירוק על השערים הרלוונטיים +
> בדיקה ידנית שהתוכן/המנגנון נכון (cross-references נפתרים, שני עותקי ה-mirror זהים, ה-guard
> של ההזרקה מסופק). golden אחרון — אחרי עריכת העותק שתחת `templates/system/`.

---

### שלב 1 — חומרי-ייחוס: מסמך capability-first + תיקוני Pin + Capability Card

**Acceptance:**
- [x] `docs/capability-first.md` קיים: Phase 1 (הוכח יכולת גולמית מחוץ ל-n8n) → שער היתכנות → Phase 2 (=build-agent הקיים), 3 דוגמאות-עבודה (Document AI/עברית, PDF, Gmail), הערת binary, הערת credentials.
- [x] ספציפיקות לא-מאומתות (`iw`/`he`, "Form Parser גנרטיבי = אנגלית+4 אזורים") מסומנות `משוער`.
- [x] `templates/agent-design-spec.md`: הערת base64-מול-binary תחת §3, קישור שער-ההיתכנות ל-capability-first, וסקשן Capability Card (§0).
- [x] `docs/agent-isolation-testing.md` §4: הערת binary (לא לסמוך על pinning, הוכח דרך trigger אמיתי); §7 cross-ref. **בלי** "ה-UI מתיר לנעוץ binary".

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (אין התנהגות רצה). הוכחה: CI ירוק (אין code-files →
שערי changelog/devplan עוברים; אין נגיעה ב-`templates/system/**` → אין golden/mirror), וקריאה
חוזרת שמאשרת: המסמך החדש פנימית-עקבי, כל ה-cross-references נפתרים, והניסוח של ה-binary מדויק.

**הערת התקדמות אחרונה:** הושלם. 3 הקבצים נכתבו/עודכנו; בדיקות-תוכן עברו: אין ניסוח אסור
("ה-UI מתיר לנעוץ binary" — לא קיים), `iw`/`he`+Form-Parser מסומנים `משוער`, ושום נגיעה ב-`templates/system/**`.

**שינוי תוכנית:** —

---

### שלב 2 — חיווט החזית ל-build-agent (שני עותקי mirror) + רענון golden

**Acceptance:**
- [x] `.claude/commands/build-agent.md` Step 0: שורה מקדימה "Phase 1 — הוכח יכולת מחוץ ל-n8n" + פריט (5) ברשימת ה-Read-First, מפנה ל-`docs/capability-first.md`.
- [x] `templates/system/.claude/commands/build-agent.md` זהה-בייט (דרך `scripts/sync-skills-mirror.sh`, לא עריכה ידנית).
- [x] `tests/golden/system/MANIFEST.sha256` מרוענן (דרך `scripts/check-system-golden.sh --update`), **אחרי** ה-mirror.
- [x] מקומית: `check-skills-mirror.sh` + `check-system-golden.sh` + `check-golden-sync.sh` עוברים.

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-skills-mirror.sh && bash scripts/check-system-golden.sh`
עוברים מקומית; `diff` בין שני עותקי build-agent.md = זהים; ה-golden manifest תואם את המבנה המרונדר.
ואז CI ירוק על skills-mirror + golden-sync + system-golden.

**הערת התקדמות אחרונה:** הושלם. ערכתי את עותק ה-factory של build-agent.md (Step 0 + פריט 5),
הרצתי `sync-skills-mirror.sh` (העותק תחת `templates/system/` זהה-בייט — `diff` נקי), ואז
`check-system-golden.sh --update` (golden זז בשורה אחת בלבד — ה-hash של build-agent.md). שלוש
בדיקות-המעטפת עברו מקומית.

**שינוי תוכנית:** —

---

### שלב 3 — הזרקה ל-provisioning + פתק changelog

**Acceptance:**
- [x] `.github/workflows/provision-system.yml`: הזוג `docs/capability-first.md|docs/capability-first.md` נוסף לרשימת ה-pair-list (אחרי שורת agent-role-decomposition, שורה 758). הערת-הלולאה עודכנה ("the two rationale/how-to docs" → "the rationale/how-to docs").
- [x] `changelog.d/2026-06-10-capability-first.md` סופי (פתק לכל 3 השלבים).
- [x] CI ירוק: changelog gate (code-file → דרוש פתק ✓) + yamllint נקי + actionlint (Playground).

**הוכחה תפקודית (באותו שלב):** שכפלתי מקומית את לולאת ה-`for pair` המדויקת מה-workflow מול שורש
הריפו — כל 6 המקורות קיימים (כולל `docs/capability-first.md`), כלומר ה-guard `[ -f … ] || exit 1`
**לא** ייפול וה-`cp` יצליח. `yamllint` על ה-workflow נקי. מנגנון זהה-בייט ל-5 הזוגות הקיימים.

**הערת התקדמות אחרונה:** הושלם — ההזרקה נוספה (שורה 758), פתק ה-changelog נסגר, והפיתוח עבר
ל-`status: completed`. נשאר רק אישור-מיזוג של Or.

**שינוי תוכנית:** מיקום הפיכת ה-`status` ל-`completed`: התוכנית המקורית אמרה "אחרי המיזוג", אבל
הגנת-הענף אוסרת push ישיר ל-main, אז ההיפוך נעשה ב-commit של שלב 3 בתוך ה-PR (כמו תקדים
parallel-dev-stage) — לפני המיזוג, לא אחריו.

---

### שלב 4 — סקיל ייעודי `/prove-capability` (בקשת Or אחרי שלב 3 — בנוסף, לא במקום)

**Acceptance:**
- [x] `.claude/commands/prove-capability.md` חדש (`audience: shared`): entry-point דק ל-Phase 1, מפנה ל-`docs/capability-first.md` (מקור-יחיד, בלי כפילות) ומעביר ל-`/build-agent` כשה-verdict הוא go.
- [x] `templates/system/.claude/commands/prove-capability.md` זהה-בייט (דרך `scripts/sync-skills-mirror.sh`).
- [x] `tests/golden/system/MANIFEST.sha256` מרוענן (122 קבצים, +1).
- [x] מקומית: `check-skills-mirror.sh` (68 shared) + `check-system-golden.sh` + `check-golden-sync.sh` עוברים.

**הוכחה תפקודית (באותו שלב):** הסקיל מופיע ברשימת הפקודות עם ה-description שלו; `diff` מול ה-mirror
= זהים; שלוש בדיקות-המעטפת עוברות מקומית, ואז CI ירוק. הסקיל מפנה ל-`docs/capability-first.md`
(מקור-יחיד) ומעביר ל-`/build-agent` — לא משכפל את המתודולוגיה.

**הערת התקדמות אחרונה:** הושלם. הסקיל נכתב, מומרר ל-`templates/system/`, וה-golden עודכן. ממתין למיזוג.

**שינוי תוכנית:** שלב זה נוסף *אחרי* ששלב 3 כבר סגר את התוכנית המקורית (3 שלבים) — Or ביקש לפני
המיזוג סקיל ייעודי **בנוסף** לחיווט שב-build-agent (לא כתחליף). נשמר דק וחד-מקורי כדי לא ליצור את
הפלייבוק-המקביל שהמחקר הזהיר מפניו.

---

## פנקס פירוק (Teardown ledger)

> נמחק/נשאר חי — לכל משאב שהוקם בפיתוח. נכון לעכשיו: לא הוקמה מערכת-בדיקה (הוכחה lightweight).

- מערכת-בדיקה חיה: **לא הוקמה** (ברירת-מחדל; הוכחה lightweight). אם תוקם בהוראת Or — לתעד כאן ולסגור ב-`decommission-test-system.yml`.

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כתבנו את מסמך החזית החדש (capability-first) ותיקנו את שתי ההנחיות על "נעיצת" קבצים. תוכן בלבד, בלי נגיעה בריצת המערכות.
- שלב 2 הושלם — חיברנו את החזית לתוך פקודת בניית-הסוכן (בשני העותקים, זהים בדיוק) ועדכנו את "תמונת-הייחוס" (golden). הבדיקות הרגישות יותר עברו.
- שלב 3 הושלם — הוספנו שורה אחת לצנרת-ההקמה כך שהמסמך החדש יישלח לכל מערכת חדשה. הוכחנו שהשורה עובדת (כל הקבצים נמצאים) והפיתוח סגור — נשאר רק ללחוץ "מזג".
- שלב 4 הושלם — לבקשתך הוספנו פקודה ייעודית `/prove-capability` (בנוסף, לא במקום) שמריצה רק את "הוכח יכולת מחוץ ל-n8n". נשלחת גם למערכות. נשאר רק למזג.
