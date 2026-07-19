---
dev_name: הגנת main למערכות-אחות (protect-system-main + or-agents)
slug: protect-agents-main
opened: 2026-07-19
status: completed   # נמסר במלואו ב-PR אחד
---

# תוכנית פיתוח — הגנת main למערכות-אחות

## מטרה

or-agents נבנתה בלי הגנה על main (bootstrap-system-infra.yml **במכוון** לא מקים branch protection),
בעוד ש-or-aios ופאקטורי מוגנים ע"י `protect-main` ruleset. נחשף הפער אחרי קונפליקט-מיזוג ב-or-agents.
Or ביקש (2026-07-19) לסגור אותו — גם על or-agents עכשיו, וגם לכל מערכת-אחות עתידית.

## שלבים

| # | שלב | סטטוס | קבצים |
|---|---|---|---|
| 1 | החזרת המנוע הקבוע | completed | `.github/workflows/protect-system-main.yml` (שוחזר מ-`be9fc99~1`) |
| 2 | חיווט ל-/new-system + תיעוד | completed | `.claude/commands/new-system.md`, `templates/new-system/AGENTS.md`, `CLAUDE.md` |
| 3 | הפעלה על or-agents | completed (dispatch אחרי merge) | — (ruleset על edri2or/or-agents) |

## החלטות

- **למחזר, לא להמציא:** `scripts/ensure-protect-main-ruleset.sh` כבר גנרי (env `TARGET_REPO`/`REQUIRED_CONTEXTS_JSON`) —
  לא נגעתי בו. שוחזר רק ה-workflow שמפעיל אותו על ריפו-מערכת.
- **ברירת-מחדל = 2 קונטקסטים** (`shellcheck + yamllint`, `Scan for committed secrets`) — בדיוק מה שמערכת
  /new-system נקייה יורשת (המקור היה 4 שערי-פאקטורי).
- **`delete_branch_on_merge`** נוסף כצעד — התיקון המבני לקונפליקט-הענף-הישן (squash-merge + שימוש חוזר בענף).
- **admin יכול לעקוף** (bypass_actors: Admin) — זהה לפאקטורי; רשת-ביטחון, לא חומה מול פעולת-admin מכוונת.

## הוכחה

`protect-system-main.yml` נמסר וה-CI ירוק; ההפעלה החיה על or-agents מאומתת בלוג-הריצה
(`PASS: protect-main ruleset active on edri2or/or-agents` + `delete_branch_on_merge=true`).

## יומן ל-Or (עברית)

main של or-agents עכשיו מוגן כמו של האחים — PR חובה, בדיקות-חובה, בלי דחיפה ישירה. וכל מערכת חדשה
שנקים מעכשיו תיוולד מוגנת אוטומטית (זה חלק מ-/new-system).
