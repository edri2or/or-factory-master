---
dev_name: העברת סקילי שיחה לפקטורי
slug: conversation-skills-factory
opened: 2026-07-03
status: completed
---

# תוכנית פיתוח — העברת conversation-handoff + conversation-continuity לפקטורי

## מטרה

שני סקילי-השיחה שהיו רק במערכת or-aios — `conversation-handoff` (אורז את השיחה כמסירה
לצ'אט/סוכן הבא) ו-`conversation-continuity` (שומר קובץ-קונטקסט עקבי בתוך השיחה) — מועברים
לפקטורי עצמו וגם לתבנית המערכות, כך שכל מערכת חדשה תיוולד איתם.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | העתקה + רענון golden | completed | `.claude/skills/**`, `templates/system/.claude/skills/**`, `tests/golden/system/MANIFEST.sha256`, `changelog.d/` |

---

### שלב 1 — העתקת שני הסקילים לשני היעדים

**Acceptance:**
- [x] `.claude/skills/{conversation-handoff,conversation-continuity}/SKILL.md` קיימים בשורש הפקטורי, זהים-בית למקור ב-or-aios.
- [x] `templates/system/.claude/skills/{...}/SKILL.md` קיימים, זהים-בית לעותקי השורש.
- [x] ה-golden רוענן ומכיל בדיוק שני ערכים חדשים (ותו לא).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — העתקה מדויקת של קבצי SKILL.md (בלי לוגיקה רצה).
אומת ב-`diff -q` שכל ארבעת הקבצים זהים-בית למקור, וב-`git diff` שה-golden הוסיף רק את שני
הערכים החדשים. השערים הרלוונטיים (`check-system-golden.sh`, `check-golden-sync.sh`,
`check-workflow-skill-pair.sh`) עוברים מקומית.

**הוכחת E2E (artifact):** לא-התנהגותי — אין נגיעה ב-`workflows/n8n/*.json` או ב-`configure-agent-router.yml`.

**הערת התקדמות אחרונה:** הושלם — ארבעה קבצים הועתקו, golden רוענן, פתק changelog נכתב.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — שני סקילי-השיחה נמצאים עכשיו בפקטורי, וכל מערכת חדשה שהפקטורי יבנה תיוולד איתם.
