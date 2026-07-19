# הגנת main למערכות-אחות — `protect-system-main.yml` חזר, ו-or-agents הוגנה

`bootstrap-system-infra.yml` **במכוון** לא מקים branch protection (בזמן ה-bootstrap אין תוכן בריפו),
כך שמערכת-אחות נולדה עם main **פתוח** — בעוד ש-or-aios ופאקטורי מוגנים ע"י `protect-main` ruleset.
הפער נחשף אחרי קונפליקט-מיזוג ב-or-agents. נסגר:

- **שוחזר `.github/workflows/protect-system-main.yml`** (נמחק ב-batch-2 של הפירוק, `be9fc99`) כמנוע קבוע:
  `workflow_dispatch(system_repo, required_contexts_json)` — כ-broker דרך WIF מנפיק טוקן
  `administration:write` מוגבל לריפו-היעד ומריץ את `scripts/ensure-protect-main-ruleset.sh` (**ללא שינוי** —
  הוא כבר גנרי). מתקין `protect-main` ruleset: PR חובה, בדיקות-חובה (non-strict), חסימת force-push + מחיקה.
  - **ברירת-מחדל לקונטקסטים** שונתה ל-2 שערי מערכת-אחות נקייה (`shellcheck + yamllint`,
    `Scan for committed secrets`) — המקור היה 4 שערי-פאקטורי.
  - **צעד חדש: `delete_branch_on_merge=true`** על ריפו-היעד — התיקון המבני לקונפליקט-הענף-הישן
    (squash-merge ואז שימוש חוזר באותו ענף): מחיקה אוטומטית מכריחה ענף טרי בכל PR.
- **חיווט ל-`/new-system`** (`.claude/commands/new-system.md`) — נוסף "שלב ב׳½ — הקשחת main", שרץ אחרי
  שהיסוד מוזג ל-main וה-CI ירוק. כל מערכת עתידית נולדת מוגנת.
- **תיעוד:** `templates/new-system/AGENTS.md` (שורת ההגנה הפכה לעובדה) + `CLAUDE.md` (הוחזר לטבלת ה-Workflows).
- **הופעל חי על or-agents** — ה-ruleset פעיל (`enforcement: active`) + `delete_branch_on_merge` דלוק.

**היקף:** הרחבת ה-hardening של /new-system, לא החייאת מכונת-הייצור. אין שינוי ב-`ensure-protect-main-ruleset.sh`.
