---
dev_name: מסמך מדיניות פיתוח מקבילי
slug: parallel-development-doc
opened: 2026-06-15
status: completed
---

# תוכנית פיתוח — מסמך מדיניות פיתוח מקבילי

## מטרה

לתעד במקום אחד את מדיניות הפיתוח-המקבילי של הפקטורי: branches קצרי-חיים + מיזוג תכוף,
התור `live-system-<system>` שמסדר עבודה על or-edri-4, ולמה הפקטורי נשאר **לא-strict** ולא
מאמץ merge queue (עם הנימוקים), כולל strict כ-fallback מתועד. מסמך חדש `docs/parallel-development.md`
+ הפניות קצרות מ-`.claude/commands/dev-stage-factory.md` ומ-`CLAUDE.md` (כולל תיקון פסקת
ה"trap" ב-CLAUDE.md שכבר לא נכונה אחרי תיקון שער ה-devplan).

`.md` בלבד — ללא שערים (אין קבצי-קוד), ללא הוכחה חיה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כתיבת המסמך + הפניות + תיקון ה-trap ב-CLAUDE.md | completed | `docs/parallel-development.md`, `CLAUDE.md`, `.claude/commands/dev-stage-factory.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — כתיבת המסמך + הפניות + תיקון ה-trap ב-CLAUDE.md

**Acceptance:**
- [x] `docs/parallel-development.md` חדש בסגנון-הבית (H1, פתיח מודגש, `>` תקציר, סעיפי H2): מדיניות ה-branches, התור על or-edri-4, ונימוקי אי-strict/אי-merge-queue + fallback.
- [x] הפניה ב-`.claude/commands/dev-stage-factory.md` (פריט 4 ב-"Context — Read First").
- [x] הפניה ב-`CLAUDE.md` + תיקון פסקת "Closing-while-parallel trap" שכבר לא נכונה אחרי תיקון שער ה-devplan (PR #469).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (מסמך + הפניות). אין התנהגות רצה. אומת בעיניים:
המסמך עקבי עם הקוד בפועל (4 ה-workflows, `queue: max` + `cancel-in-progress:false`,
`protect-main` הלא-strict ב-`scripts/ensure-protect-main-ruleset.sh`). PR זה `.md` בלבד → שערי
changelog/devplan הם no-op.

**הוכחת E2E (artifact):** לא-התנהגותי (תיעוד בלבד).

**הערת התקדמות אחרונה:** הושלם. המסמך נכתב; הפניות נוספו ב-dev-stage-factory ו-CLAUDE.md; פסקת ה-trap הישנה ב-CLAUDE.md תוקנה למצב שאחרי PR #469.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — נכתב מסמך שמסביר איך עובדים שני פיתוחים במקביל בלי להתנגש, ולמה בחרנו בשיטה הפשוטה (branches קצרים + תור) ולא במנגנונים כבדים. הוספתי הפניות אליו מהמקומות הנכונים.
