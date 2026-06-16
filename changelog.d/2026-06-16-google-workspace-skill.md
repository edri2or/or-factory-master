## סקיל Google Workspace מאוחד (google-workspace-skill) — שלב 1

נוספה פקודת-סוכן `shared` חדשה, `/google-workspace-guide` — **מקור-אמת אחד** לכלי Google
המאוחדים (12 השירותים על `edri2or@gmail.com`): מה קיים, איך מגיעים אליהם (בפקטורי/claude.ai דרך
מסלול ה-Workspace MCP; במערכת דרך כלי `google_workspace` ה-HITL-gated), כללי הבטיחות
(Research-mode OFF, `OAUTH_ALLOWED_EMAILS`, חוזה ה-4-אתרים), ומה לא אפשרי
(Keep/NotebookLM/Photos; Maps/YouTube/Translate = מסלול API-key נפרד).

- `.claude/commands/google-workspace-guide.md` (`audience: shared`) — "מפה, לא מדריך": מפנה
  ל-`tools/list` החי ול-`AGENTS.md`/מסמכי הפקטורי, לא מקבע שמות-כלים (לא מתיישן). מודל:
  `operate-this-system`.
- `templates/system/.claude/commands/google-workspace-guide.md` — מראָה byte-identical
  (`sync-skills-mirror.sh`), כך שכל מערכת חדשה מקבלת את הסקיל.
- `tests/golden/system/MANIFEST.sha256` — שורה אחת נוספה (`check-system-golden.sh --update`),
  מספקת את שער ה-path-coupling (קובץ לא-template → אין envsubst על הקובץ עצמו).

שינוי תיעוד-סטטי בלבד — אין דיפלוי ואין התנהגות-בוט; ההוכחה היא שער הזהב. השלב הבא: גרסת
claude.ai של הסקיל ל-Or.

## סקיל Google Workspace מאוחד (google-workspace-skill) — שלב 3 (תיקון ניואנס זהות) + סגירה

ה-Claude האישי של Or (בבדיקת הסקיל מול סקיל `google-workspace-ops` הקיים שלו) תפס דיוק אמיתי:
הסקיל נקב בחשבון-המידע (`edri2or@gmail.com`) אך השמיט שאת הפרמטר `user_google_email` שמעבירים
לכלים מעבירים כ-label האחסון **`edriorp38@or-infra.com`** (להעביר edri2or נכשל — אין קרדנציאל תחת
השם). נוסף קטע "Identity — two names" ל-`.claude/commands/google-workspace-guide.md` (+ mirror +
golden), לפי `docs/google-identities.md` (כולל תיקון 2026-06-15: ה-label הוא שם-קובץ, לא החשבון).
הסקיל לא היה שגוי — רק חסר את הניואנס. הפיתוח נסגר (`status: completed`); גרסת ה-claude.ai
נמסרה ל-Or ו-Or מקפל את אותו תוכן גם לתוך סקיל `google-workspace-ops` שלו (עם הפיוס שסיפקתי).
