---
dev_name: מקביליות ב-dev-stage
slug: parallel-dev-stage
opened: 2026-05-29
status: active
---

# תוכנית פיתוח — מקביליות ב-dev-stage

## מטרה

לאפשר לשני פיתוחי `/dev-stage` לרוץ בו-זמנית בשני סשנים נפרדים בלי שיתנגשו.
הפתרון: "קובץ לכל פיתוח" — כל פיתוח כותב לקבצים שונים (תוכנית + יומן), אפס תורים ואפס נעילות.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | Plan-file תמיד-per-dev + devplan gate multi-active | completed | `dev-stage.md` (×2), `check-devplan-updated.sh`, `CHANGELOG.md` |
| 2 | Changelog gate מקבל `changelog.d/` | completed | `check-changelog-updated.sh` |
| 3 | Changelog fragment במצב מקביל | pending | `dev-stage.md` (×2) |
| 4 | תיעוד + CHANGELOG entry | pending | `CLAUDE.md`, `CHANGELOG.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — Plan-file תמיד-per-dev + devplan gate multi-active

**Acceptance:**
- [ ] `dev-stage.md` Step 2 מנחה תמיד ל-`devplans/<slug>.md`, ללא ענף "אם קיים שורש"
- [ ] Mirror זהה ב-`templates/system/.claude/commands/dev-stage.md`
- [ ] `check-devplan-updated.sh` אוכף את כל התוכניות הפעילות (ללא `break`)
- [ ] `bash scripts/check-devplan-updated.sh` עובר ✓

**הערת התקדמות אחרונה:** הושלם — dev-stage.md תמיד כותב ל-devplans/, שומר-CI אוכף את כל הפעילים. mirror זהה. `check-devplan-updated.sh` PASS.

**שינוי תוכנית:** —

---

### שלב 2 — Changelog gate מקבל `changelog.d/`

**Acceptance:**
- [x] `check-changelog-updated.sh` מקבל `changelog.d/*.md` כתחליף ל-`CHANGELOG.md`
- [x] `bash scripts/check-changelog-updated.sh` עובר ✓

**הערת התקדמות אחרונה:** הושלם — השער מקבל `CHANGELOG.md` או פתק `changelog.d/<date>-<slug>.md`. regex אומת על דוגמאות.

**שינוי תוכנית:** —

---

### שלב 3 — Changelog fragment במצב מקביל

**Acceptance:**
- [ ] `dev-stage.md` Step 3(b) מכיל את כלל הפתק המקבילי
- [ ] Mirror זהה ב-`templates/system/`
- [ ] `bash scripts/check-skills-mirror.sh` עובר ✓

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד + CHANGELOG entry

**Acceptance:**
- [ ] `CLAUDE.md` סעיף "Development workflow" מעודכן עם הכללים החדשים
- [ ] `CHANGELOG.md` מכיל Stage 136 המתעד את כל 4 השינויים
- [ ] כל שערי-CI עוברים ✓

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — פיתוח חדש תמיד נפתח ב-devplans/, שומר-CI אוכף את כל הפיתוחים הפעילים.
- שלב 2 הושלם — שומר-היומן מקבל גם קובץ-פתק נפרד (changelog.d/), לא רק את היומן המרכזי.
