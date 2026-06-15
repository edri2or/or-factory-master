---
dev_name: זיווג SKILL.md לכל workflow של N8N
slug: workflow-skill-pairing
opened: 2026-06-15
status: completed
---

# תוכנית פיתוח — זיווג SKILL.md לכל workflow של N8N

## מטרה

כל אוטומציה (workflow של n8n) שהמערכות שלנו מריצות תקבל "כרטיס-יכולת" — קובץ `SKILL.md`
קצר וסטטי שמסביר מה היא עושה ואיך מפעילים אותה, ושם-התיקייה הוא גם פקודת `/<name>`. כל
מערכת חדשה נולדת עם הכרטיסים, ושומר-סף (CI) חוסם הוספת אוטומציה בלי הכרטיס שלה (אלא אם
היא ברשימת-פטור של צנרת פנימית).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | רשימת-פטור + מחולל + 14 כרטיסים | completed | `monitoring/workflow-skill-exempt.txt`, `scripts/gen-workflow-skill.sh`, `templates/system/.claude/skills/<name>/SKILL.md` ×14 |
| 2 | שער-CI + חיווט | completed | `scripts/check-workflow-skill-pair.sh`, `playground-tests.yml`, `pipeline-tests.yml`, `provision-system.yml` |
| 3 | תיעוד-עתיד + golden + סגירה | completed | `.claude/commands/build-agent.md` (+מראה), `tests/golden/system/MANIFEST.sha256`, changelog, devplan |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **מעקב-המשך (מחוץ ל-PR, מותנה באישור Or):** backfill ל-`or-edri-4` (כרטיסים בלבד) דרך
> `refresh-system-agents.yml paths=.claude/skills` — תיעוד סטטי, בלי re-import חי; ירוץ רק אחרי merge ובאישור מפורש.

---

### שלב 1 — רשימת-פטור + מחולל + 14 כרטיסים

**Acceptance:**
- [ ] `monitoring/workflow-skill-exempt.txt` קיים עם 10 הערכים (incl. `agents.manifest`).
- [ ] `scripts/gen-workflow-skill.sh` מייצר 14 קבצי `SKILL.md` דטרמיניסטית (הרצה כפולה = דיף ריק).
- [ ] 14 קבצי `templates/system/.claude/skills/<name>/SKILL.md` קיימים, frontmatter `name`+`description` בלבד.

**הוכחה תפקודית (באותו שלב):** להריץ `bash scripts/gen-workflow-skill.sh` פעמיים ולוודא ש-`git status`
לא משתנה בריצה השנייה; לפתוח 2–3 כרטיסים ולוודא שהתוכן תואם ל-workflow.

**הוכחת E2E (artifact):** לא-התנהגותי (קבצי תיעוד סטטיים; לא נוגע ב-`workflows/n8n/*.json` עצמם).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — שער-CI + חיווט

**Acceptance:**
- [ ] `scripts/check-workflow-skill-pair.sh` עובר על עץ ה-factory ונכשל אם חסר כרטיס.
- [ ] השער מחווט ב-`playground-tests.yml` (factory) וב-`pipeline-tests.yml` (מערכת).
- [ ] `provision-system.yml` שולח את הסקריפט + רשימת-הפטור למערכות חדשות.

**הוכחה תפקודית (באותו שלב):** להריץ את השער מקומית עם `WF_DIR=templates/system/workflows/n8n` →
PASS; לשנות-זמנית שם-תיקייה של כרטיס → FAIL עם הודעה דו-לשונית; לשחזר. `shellcheck` נקי.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תיעוד-עתיד + golden + סגירה

**Acceptance:**
- [ ] `.claude/commands/build-agent.md` (+מראה byte-identical) מציין יצירת הזיווג בעת הוספת workflow.
- [ ] `tests/golden/system/MANIFEST.sha256` כולל את 14 הכרטיסים; `check-golden-sync.sh` עובר.
- [ ] changelog fragment + devplan סגורים.

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-system-golden.sh` + `bash scripts/check-golden-sync.sh`
+ `bash scripts/check-skills-mirror.sh` עוברים; ה-PR ירוק בכל השערים.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם — כל 14 האוטומציות ה"פעילות" קיבלו כרטיס-יכולת אוטומטי, ו-10 הצנרתיות נכנסו לרשימת-פטור.
- שלב 2 הושלם — נבנה שומר-סף שחוסם אוטומציה בלי כרטיס, וחובר גם לפקטורי וגם לכל מערכת חדשה.
- שלב 3 הושלם — עודכן התיעוד, רוענן ה-golden, וכל שערי ה-CI ירוקים. נשאר רק backfill ל-or-edri-4 (מותנה באישורך).
