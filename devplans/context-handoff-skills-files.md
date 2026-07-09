---
dev_name: שדרוג סקילי קונטקסט/הנדאוף לקבצים על הדיסק (factory + תבנית מערכות)
slug: context-handoff-skills-files
opened: 2026-07-09
status: completed
---

# תוכנית פיתוח — conversation-continuity + conversation-handoff על-דיסק (factory)

## מטרה

שני סקילי-השיחה (`conversation-continuity` / `conversation-handoff`) ניהלו עד היום את הקונטקסט
כבלוק טקסט בתוך חלון השיחה. השדרוג מעביר אותם ל**קובץ .md אמיתי** על הדיסק (`sessions/context/<slug>.md`)
שקלוד יוצר, קורא ומעדכן — כך שבכל עדכון קוראים את המצב האחרון מהקובץ ומוסיפים את ההתפתחות מאותה
נקודה, במקום להדפיס בלוק חדש. השינוי הוחל גם על גרסת המקור (`.claude/skills/`) וגם על העותק שנשלח
לכל מערכת חדשה (`templates/system/.claude/skills/`), עם רענון ה-golden.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שכתוב שני הסקילים למנגנון על-דיסק (מקור) | completed | `.claude/skills/conversation-{continuity,handoff}/SKILL.md` |
| 2 | הפצה לעותק-התבנית (mirror) | completed | `templates/system/.claude/skills/conversation-{continuity,handoff}/SKILL.md` |
| 3 | רענון golden | completed | `tests/golden/system/MANIFEST.sha256` |

## מה נעשה

- אוחדו ארבע גרסאות הסקיל (מקור×2 + תבנית×2) לגרסה המשודרגת-והעשירה על-דיסק (גרסת or-aios הייתה
  עשירה יותר — עוגני-ציטוט, supersede, אימות-דלתא מבוסס-תוכן — ואומצה כבסיס). המנגנון: קובץ
  `sessions/context/<slug>.md`, פרוטוקול קריאה-מהדיסק ← עוגן-תוכן ← אימות ← כתיבה חזרה; proof קצר
  בצ'אט עם נתיב הקובץ.
- `conversation-handoff` — מקור על-דיסק, פלט כפול (קובץ `<slug>.handoff.md` + בלוק להעתקה).
- golden רוענן דרך `bash scripts/check-system-golden.sh --update`; `check-system-golden.sh` +
  `check-golden-sync.sh` ירוקים.

## אימות (בוצע)

- `scripts/check-system-golden.sh` → PASS (התבנית תואמת ל-render).
- `scripts/check-golden-sync.sh` → PASS.
- אימות פונקציונלי-חי של המנגנון בוצע בריפו המערכת (or-aios) — ראה `devplans/context-handoff-skills-files.md` שם.

## הערות

- שינוי Markdown + golden בלבד — אין יכולת (verb) חדשה, capability-first לא חל.
- **מחוץ להיקף v1:** לא נוסף `.gitignore` לתבנית המערכות עבור `sessions/context/` — התבנית לא כוללת
  `.gitignore` ו-`provision-system.yml` לא מעתיק כזה, כך שהוספתו הייתה דורשת שינוי בלוגיקת ההעתקה של
  provision (מעבר להיקף שינוי דוקומנטרי). הקבצים הם קבצי-עבודה לסשן שהסשן אינו מבצע להם commit;
  בריפו or-aios עצמו נוסף `sessions/context/` ל-`.gitignore` הקיים.
