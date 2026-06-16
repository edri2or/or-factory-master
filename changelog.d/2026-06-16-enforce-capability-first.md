## אכיפת capability-first — שלא יעקפו את המתודולוגיה (enforce-capability-first)

המתודולוגיה capability-first (קודם להוכיח את היכולת הגולמית **מחוץ ל-n8n** על fixture אמיתי
עם הכרעת go/no-go, אז לפרק לתת-סוכנים, אז לבנות בוטום-אפ) הייתה **opt-in** בלבד — שום שער-כניסה
לא הכריח אותה. לכן הפיתוח `email-form-intake` נבנה כמונוליט והוכחת-הלבנה הקשה (קריאת ה-PDF)
נדחתה לסוף — בדיוק האנטי-דפוס "המפץ הגדול" שבגללו נבנתה המתודולוגיה. הפיתוח הזה הופך אותה
ל**בלתי-עקיפה לכל יכולת חדשה, גם בשכבת הפקטורי**, בלי over-build.

- **שלב 1 — וו-ניתוב: capability-first חובה בכל שער-כניסה (docs/routing):**
  - `CLAUDE.md` — כלל חדש ב-"How to work": לפני בניית **יכולת חדשה** (פועל חדש —
    קריאה/מילוי/חילוץ/שליחה/פרסור, בין כתת-סוכן ובין כ-workflow עצמאי) חובה קודם
    `/prove-capability` (הוכחה מחוץ ל-n8n + go/no-go) ופירוק `/build-agent`. חל **גם בפקטורי**
    (בנייה ל-`templates/system/**`). `/dev-stage-factory` ו-`/dev-stage` **עוטפים** את הכלל
    כ-Step 0, לא מחליפים. מצוין מפורשות שזה הכלל ש-`email-form-intake` עקף.
  - `.claude/commands/dev-stage-factory.md` + `.claude/commands/dev-stage.md` — הוספת
    `docs/capability-first.md` ל-"Context — Read First" ו**שלב-0** מפורש שמכריח capability-first
    כשהפיתוח מוסיף יכולת חדשה (ומדלג מפורשות כשאין יכולת חדשה — config/plumbing/docs).
  - מראה: `templates/system/.claude/commands/dev-stage.md` עודכן דרך `scripts/sync-skills-mirror.sh`
    (dev-stage משותף; dev-stage-factory הוא factory-only ולא ממורר), והזהב רוענן
    (`scripts/check-system-golden.sh --update` → `tests/golden/system/MANIFEST.sha256`).
  - **הוכחה תפקודית (replay):** הפעלים של `email-form-intake` (read/extract/send) כולם ברשימת
    הפעלים של הכלל החדש — כך שעל אותה בקשה, Step 0 היה עוצר ומכריח `/prove-capability` על
    fixture של טופס עברי אמיתי לפני כל בנייה. שערים סטטיים ירוקים: skills-mirror, system-golden,
    golden-sync.
