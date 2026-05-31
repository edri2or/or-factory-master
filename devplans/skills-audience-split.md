---
dev_name: הפרדת סקילים — לפקטורי בלבד מול כללי (גם למערכות)
slug: skills-audience-split
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
# כל 3 השלבים הושלמו ואומתו. נשאר active עד שה-PR יתמזג: שער ה-devplan בודק
# על אירוע ה-PR את כל ה-diff של ה-PR, וסגירה מוקדמת תפיל אותו כל עוד פיתוח מקביל
# אחר (devplans/meta-monitoring-watchdog.md) פעיל ולא מעודכן ב-diff הזה. הסגירה
# ל-completed תיעשה ב-follow-up נטול-קוד אחרי המיזוג (diff ריק מקוד = השער no-op).
---

# תוכנית פיתוח — הפרדת סקילים: "לפקטורי בלבד" מול "כללי (גם למערכות)"

## מטרה

היום כל פקודת סלאש ב-`.claude/commands/` נדחפת אוטומטית לכל מערכת שהפקטורי יוצר, ושומר ה-CI
אפילו *מכריח* את זה (זהות מלאה בין שתי התיקיות). אנחנו נותנים לכל סקיל תגית בראש הקובץ —
`audience: shared` (עובר למערכות) או `audience: factory-only` (רק לפקטורי). חבילת המערכות
הופכת לתת-קבוצה נגזרת, וסקיל חדש בלי תגית עוצר את ה-CI עד שמחליטים. כל 65 הפקודות הקיימות
מתויגות `shared` — אפס שינוי התנהגות למערכות קיימות.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיוג 65 הפקודות הקיימות כ-`shared` (שתי התיקיות, זהות byte) | completed | `.claude/commands/*.md`, `templates/system/.claude/commands/*.md` |
| 2 | שומר מודע-audience + סקריפט סנכרון + בדיקות bats | completed | `scripts/check-skills-mirror.sh`, `scripts/sync-skills-mirror.sh`, `scripts/tests/check-skills-mirror.bats` |
| 3 | חיווט ההחלטה ליצירת סקיל + תיעוד | completed | `.claude/commands/build-skill.md` (+מראה), `docs/skills-audience.md`, `CLAUDE.md`, הערת provision |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — תיוג 65 הפקודות הקיימות כ-`shared`

**Acceptance:**
- [x] לכל `.claude/commands/*.md` ולכל קובץ מראה נוספה השורה `audience: shared` מיד אחרי ה-`---` הפותח.
- [x] שתי התיקיות נשארות זהות byte-for-byte (`diff -rq` ריק) — השומר הישן עדיין עובר.

**הערת התקדמות אחרונה:** בוצע. 65/65 בכל תיקייה תויגו, `diff -rq` ריק, `check-skills-mirror.sh` (הישן) מחזיר PASS.

**שינוי תוכנית:** —

---

### שלב 2 — שומר מודע-audience + סקריפט סנכרון + בדיקות

**Acceptance:**
- [x] `check-skills-mirror.sh` החדש: דורש `audience:` תקין בכל פקודה; מאמת שהמראה = בדיוק קבוצת ה-`shared`, זהה byte, בלי דליפת `factory-only`.
- [x] `scripts/sync-skills-mirror.sh` חדש: בונה מחדש את המראה מתוך התגיות; מסרב לרוץ אם תגית חסרה/לא-תקינה.
- [x] `scripts/tests/check-skills-mirror.bats` ירוק: חסר-תגית→כשל, ערך-לא-תקין→כשל, דליפת factory-only→כשל, shared חסר→כשל, drift→כשל, נקי→PASS.

**הערת התקדמות אחרונה:** בוצע. השומר על העץ האמיתי → `PASS: 65 shared shipped, 0 factory-only excluded`; `shellcheck --severity=error` נקי; כל 11 בדיקות ה-bats עוברות. תיקון בדרך: ב-awk, `exit` תמיד מריץ את `END`, אז עברנו לדגל `found` ו-`END` שמחליט את קוד היציאה.

**שינוי תוכנית:** —

---

### שלב 3 — חיווט ההחלטה ליצירת סקיל + תיעוד

**Acceptance:**
- [x] `build-skill.md` מזכיר: סקיל שנכנס כ-`.claude/commands/` חייב `audience:`, ומפנה לסקריפט הסנכרון + `docs/skills-audience.md` (פקודה מתויגת `shared`, המראה עודכן דרך `sync-skills-mirror.sh`).
- [x] `docs/skills-audience.md` חדש מתעד את המוסכמה; `CLAUDE.md` מעודכן (Key files + סעיף "Skills audience"); הערת ה-provision מתוקנת ל"תת-קבוצה נגזרת".
- [x] CI ירוק (אומת מקומית: guard PASS, yamllint נקי, bats 11/11; ריצת ה-CI המלאה על ה-PR).

**הערת התקדמות אחרונה:** בוצע. הערת ה-`build-skill` נוספה והמראה חודש דרך `scripts/sync-skills-mirror.sh` (build-skill זהה byte). `docs/skills-audience.md` + עדכוני `CLAUDE.md` + הערת `provision-system.yml`. guard → 65 shared / 0 factory-only; yamllint נקי; 11/11 bats.

**שינוי תוכנית:** מיקוד עודכן — `build-skill` כותב סקילי-plugin (לא `.claude/commands/`), ולכן התווית `audience` לא נכנסת ל-frontmatter שהוא מייצר; במקום זה נוספה הערה מפורשת + התיעוד נושא את העומס. האכיפה האמיתית היא שער ה-CI משלב 2, שתופס כל קובץ חדש ב-`.claude/commands/` ללא תלות באופן יצירתו.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — סימנתי את כל 65 הסקילים הקיימים כ"עוברים למערכות" (כמו שהיה), בלי לשבור כלום. עכשיו אפשר לבנות עליהם את ההפרדה האמיתית.
- שלב 2 הושלם — בניתי את ה"מנוע": השומר עכשיו בונה את חבילת המערכות רק מהסקילים שמתויגים "כללי", סקיל בלי תווית מפיל את ה-CI, ויש סקריפט שמסנכרן אוטומטית. הוספתי 11 בדיקות שמוכיחות שהכול עובד.
- שלב 3 הושלם — תיעדתי הכל (מסמך הסבר + CLAUDE.md) כדי שכל סשן עתידי יכבד את הכלל, והוספתי תזכורת ב-build-skill שכשיוצרים סקיל-פקודה חדש חייבים להחליט לאן הוא שייך. הפיתוח הסתיים.
