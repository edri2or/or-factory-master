---
dev_name: הפרדת סקילים — לפקטורי בלבד מול כללי (גם למערכות)
slug: skills-audience-split
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 2 | שומר מודע-audience + סקריפט סנכרון + בדיקות bats | pending | `scripts/check-skills-mirror.sh`, `scripts/sync-skills-mirror.sh`, `scripts/tests/check-skills-mirror.bats` |
| 3 | חיווט ההחלטה ליצירת סקיל + תיעוד | pending | `.claude/commands/build-skill.md` (+מראה), `docs/skills-audience.md`, `CLAUDE.md`, הערת provision |

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
- [ ] `check-skills-mirror.sh` החדש: דורש `audience:` תקין בכל פקודה; מאמת שהמראה = בדיוק קבוצת ה-`shared`, זהה byte, בלי דליפת `factory-only`.
- [ ] `scripts/sync-skills-mirror.sh` חדש: בונה מחדש את המראה מתוך התגיות; מסרב לרוץ אם תגית חסרה/לא-תקינה.
- [ ] `scripts/tests/check-skills-mirror.bats` ירוק: חסר-תגית→כשל, ערך-לא-תקין→כשל, דליפת factory-only→כשל, shared חסר→כשל, drift→כשל, נקי→PASS.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — חיווט ההחלטה ליצירת סקיל + תיעוד

**Acceptance:**
- [ ] `build-skill.md` מחייב בחירת `audience:` וכותב אותה ל-frontmatter; ל-`shared` מזכיר להריץ את סקריפט הסנכרון.
- [ ] `docs/skills-audience.md` חדש מתעד את המוסכמה; `CLAUDE.md` מעודכן; הערת ה-provision מתוקנת ל"תת-קבוצה נגזרת".
- [ ] כל ה-CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — סימנתי את כל 65 הסקילים הקיימים כ"עוברים למערכות" (כמו שהיה), בלי לשבור כלום. עכשיו אפשר לבנות עליהם את ההפרדה האמיתית.
