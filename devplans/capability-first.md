<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: חזית capability-first + תיקון הנחיית ה-Pin
slug: capability-first
opened: 2026-06-10
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 1 | חומרי-ייחוס: מסמך capability-first + תיקוני Pin + Capability Card | pending | `docs/capability-first.md` (חדש), `templates/agent-design-spec.md`, `docs/agent-isolation-testing.md` |
| 2 | חיווט החזית ל-build-agent (שני עותקי mirror) + רענון golden | pending | `.claude/commands/build-agent.md`, `templates/system/.claude/commands/build-agent.md` (נגזר), `tests/golden/system/MANIFEST.sha256` (נגזר) |
| 3 | הזרקה ל-provisioning + פתק changelog | pending | `.github/workflows/provision-system.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהוא עובד *באותו שלב* — לא "CI ירוק" בלבד (הכרחי אך
> לא מספיק). הפיתוח הזה הוא מסמכים + צנרת, אז ה"הוכחה" היא: CI ירוק על השערים הרלוונטיים +
> בדיקה ידנית שהתוכן/המנגנון נכון (cross-references נפתרים, שני עותקי ה-mirror זהים, ה-guard
> של ההזרקה מסופק). golden אחרון — אחרי עריכת העותק שתחת `templates/system/`.

---

### שלב 1 — חומרי-ייחוס: מסמך capability-first + תיקוני Pin + Capability Card

**Acceptance:**
- [ ] `docs/capability-first.md` קיים: Phase 1 (הוכח יכולת גולמית מחוץ ל-n8n) → שער היתכנות → Phase 2 (=build-agent הקיים), 3 דוגמאות-עבודה (Document AI/עברית, PDF, Gmail), הערת binary, הערת credentials.
- [ ] ספציפיקות לא-מאומתות (`iw`/`he`, "Form Parser גנרטיבי = אנגלית+4 אזורים") מסומנות `משוער`.
- [ ] `templates/agent-design-spec.md`: הערת base64-מול-binary תחת §3, קישור שער-ההיתכנות ל-capability-first, וסקשן Capability Card.
- [ ] `docs/agent-isolation-testing.md` §4: הערת binary (לא לסמוך על pinning, הוכח דרך trigger אמיתי); §7 cross-ref. **בלי** "ה-UI מתיר לנעוץ binary".

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (אין התנהגות רצה). הוכחה: CI ירוק (אין code-files →
שערי changelog/devplan עוברים; אין נגיעה ב-`templates/system/**` → אין golden/mirror), וקריאה
חוזרת שמאשרת: המסמך החדש פנימית-עקבי, כל ה-cross-references נפתרים, והניסוח של ה-binary מדויק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — חיווט החזית ל-build-agent (שני עותקי mirror) + רענון golden

**Acceptance:**
- [ ] `.claude/commands/build-agent.md` Step 0: שורה מקדימה "Phase 1 — הוכח יכולת מחוץ ל-n8n" + פריט ברשימת ה-Read-First, מפנה ל-`docs/capability-first.md`.
- [ ] `templates/system/.claude/commands/build-agent.md` זהה-בייט (דרך `scripts/sync-skills-mirror.sh`, לא עריכה ידנית).
- [ ] `tests/golden/system/MANIFEST.sha256` מרוענן (דרך `scripts/check-system-golden.sh --update`), **אחרי** ה-mirror.
- [ ] מקומית: `check-skills-mirror.sh` + `check-system-golden.sh` עוברים.

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-skills-mirror.sh && bash scripts/check-system-golden.sh`
עוברים מקומית; `diff` בין שני עותקי build-agent.md = זהים; ה-golden manifest תואם את המבנה המרונדר.
ואז CI ירוק על skills-mirror + golden-sync + system-golden.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — הזרקה ל-provisioning + פתק changelog

**Acceptance:**
- [ ] `.github/workflows/provision-system.yml`: הזוג `docs/capability-first.md|docs/capability-first.md` נוסף לרשימת ה-pair-list (אחרי שורת agent-role-decomposition).
- [ ] `changelog.d/2026-06-10-capability-first.md` סופי (פתק לכל שלב).
- [ ] CI ירוק: changelog gate (code-file → דרוש פתק ✓) + devplan gate (devplan עודכן ✓) + yamllint/actionlint.

**הוכחה תפקודית (באותו שלב):** ה-guard של ההזרקה מסופק (`[ -f docs/capability-first.md ]` אמיתי
משלב 1), והלולאה תבצע `cp` בהצלחה — מנגנון זהה-בייט ל-5 הזוגות הקיימים. *(אופציונלי, באישור Or:
הקמת מערכת-בדיקה זרוקה חיה (reuse `factory-test-25`, 0-מכסה אך ריפו אמיתי) כדי לאשר שהקובץ נוחת
במערכת חדשה — מהלך בתשלום, רק בהוראת Or.)*

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## פנקס פירוק (Teardown ledger)

> נמחק/נשאר חי — לכל משאב שהוקם בפיתוח. נכון לעכשיו: לא הוקמה מערכת-בדיקה (הוכחה lightweight).

- מערכת-בדיקה חיה: **לא הוקמה** (ברירת-מחדל; הוכחה lightweight). אם תוקם בהוראת Or — לתעד כאן ולסגור ב-`decommission-test-system.yml`.

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- <מתמלא תוך כדי>
