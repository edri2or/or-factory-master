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

- **שלב 2 — שיניים: שער-CI שדורש Capability Card ל-workflow-יכולת חדש (factory-only):**
  - `scripts/check-capability-card.sh` (חדש) — תאום-מבנה ל-`check-workflow-skill-pair.sh`
    (full-scan + exempt לפי basename): כל `templates/system/workflows/n8n/<name>.json` שאינו פטור
    חייב `docs/capability-cards/<name>.md` עם `verdict: go|partial` (no-go/חסר/פגום → exit 1).
    זה ה"teeth" שהיה חוסם את מונוליט email-form-intake. shellcheck נקי.
  - `monitoring/capability-card-exempt.txt` (חדש) — 25 ה-workflows הקיימים כ-baseline grandfathered,
    עם הסבר שערך-חדש דורש נימוק אמיתי ("אין יכולת-חוץ חדשה"), לא העתקת-דפוס.
  - `docs/capability-cards/README.md` (חדש) — פורמט הכרטיס (טבלת §0 + שורת `verdict:` קריאת-מכונה),
    קישור ל-`templates/agent-design-spec.md` §0 ו-`docs/capability-first.md`, והבהרת ההיקף הנדחה.
  - `.github/workflows/playground-tests.yml` — צעד "Capability-card gate (mould)" מיד אחרי שער
    ה-skill-pair (job "Playground tests"). yamllint נקי.
  - **הוכחה תפקודית (3-way + bonus):** PASS על ה-mould (25 grandfathered, 0 לא-פטורים — no-op היום,
    נדלק על ה-workflow החדש הבא); FAIL על workflow חדש בלי כרטיס/פטור; PASS עם כרטיס `go`;
    bonus: כרטיס `no-go` → FAIL. **שינוי-תוכנית:** מיקום `docs/agent-specs/`→`docs/capability-cards/`,
    והיקף factory-only-MVP (שילוח-למערכות נדחה במפורש) — שתיהן "לא over-build", לקח הפיתוח עצמו.
  - **אין נגיעה ב-`templates/system/**`** → אין השפעת golden/mirror.
