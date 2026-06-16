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
