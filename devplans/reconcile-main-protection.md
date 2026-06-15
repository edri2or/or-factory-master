---
dev_name: יישור הגנת ה-main (הסרת הגנה קלאסית שנשארה)
slug: reconcile-main-protection
opened: 2026-06-15
status: completed
---

# תוכנית פיתוח — יישור הגנת ה-main (הסרת הגנה קלאסית שנשארה)

## מטרה

ל-`or-factory-master/main` יש שתי שכבות-הגנה חופפות: הגנה **קלאסית** ישנה (`strict: true` + 4
בדיקות + `enforce_admins`, מ-29.5.2026, ריצה `26634127083`) ש**מעולם לא הוסרה**, ולצידה ה-ruleset
הנכון (`protect-main`, לא-strict, 6 בדיקות). GitHub אוכף את שתיהן, אז ה-`strict` של הקלאסית
כופה "ענף מעודכן לפני מיזוג" ומבטל בשקט את כוונת ה-ruleset (זה חסם את PR #471 כשהיה "מאחור").
התיקון: לגרום ל-`scripts/ensure-protect-main-ruleset.sh` **למחוק כל הגנה קלאסית שנשארה** — רק
**אחרי** שאומת שה-ruleset פעיל (כך שה-main לעולם לא נשאר ללא הגנה), idempotent (404 = כבר נקי),
ולא-פטאלי. למחוק את ה-workflow ה"מוקש" `set-factory-branch-protection.yml`. מרפא-עצמי: גם כל
מערכת שהוקמה לפני 6.2026 תתוקן בפעם הבאה שמחזקים אותה.

**לא** שינוי תבנית (`templates/system/**` לא נגע — golden לא מושפע). שער ה-strict החי מתוקן
**אחרי המיזוג** כי `protect-main.yml` מופעל אוטומטית על push ל-main שנוגע בסקריפט.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מחיקת הגנה קלאסית בסקריפט + מחיקת המוקש + תיעוד | completed | `scripts/ensure-protect-main-ruleset.sh`, `.github/workflows/set-factory-branch-protection.yml` (נמחק), `docs/{bootstrap-record,parallel-development}.md` |
| 2 | אימות חי על ה-factory (post-merge) | completed | — (ריצת `protect-main.yml` האוטומטית) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — מחיקת הגנה קלאסית בסקריפט + מחיקת המוקש + תיעוד

**Acceptance:**
- [x] `ensure-protect-main-ruleset.sh`: עוזר `_api_code` (סטטוס-בלבד) + בלוק מחיקה של הגנה קלאסית **אחרי** ה-`PASS` של ה-ruleset; idempotent (204=הוסר, 404=כבר נקי, אחר=WARN לא-פטאלי) + GET-אימות.
- [x] `set-factory-branch-protection.yml` נמחק (אין הפניות פעילות — רק רשומת CHANGELOG היסטורית).
- [x] תיעוד: סעיף "Classic-protection reconciliation" ב-`bootstrap-record.md` + הערה ב-`parallel-development.md`.
- [x] שערים סטטיים ירוקים: `shellcheck` + `yamllint` נקיים, golden-sync no-op (לא נגעו `templates/system/**`), Changelog + devplan gates.

**הוכחה תפקודית (באותו שלב):** `shellcheck scripts/ensure-protect-main-ruleset.sh` נקי + `bash -n` תקין (אומת מקומית). הבלוק מוגן: מוחק קלאסית רק אחרי אימות `enforcement: active` של ה-ruleset, אז ה-main לעולם לא חשוף; `set -euo pipefail`-safe (לכידת קוד-HTTP עם `|| echo "000"`, בלי `-f` כך ש-404 אינו שגיאה).

**הוכחת E2E (artifact):** לא-התנהגותי (סקריפט-הגנה של הפקטורי, לא קבצי-בוט/תבנית).

**הערת התקדמות אחרונה:** הקוד והתיעוד הושלמו. בלוק המחיקה נוסף (מוגן: רק אחרי `enforcement: active`), המוקש נמחק, `shellcheck`+`yamllint` נקיים, golden-sync no-op. נשאר שלב 2 (אימות חי) שרץ אחרי המיזוג דרך ריצת `protect-main.yml` האוטומטית.

**שינוי תוכנית:** —

---

### שלב 2 — אימות חי על ה-factory (post-merge)

**Acceptance:**
- [x] אחרי המיזוג (#473): `protect-main.yml` נורה אוטומטית (path-filter על הסקריפט) ורץ בהצלחה — ריצה `27560825765`, 2026-06-15 16:29 UTC.
- [x] בלוג הריצה: ה-ruleset `active`, ואז מחיקת הגנה קלאסית → **הוסרה** (נתיב 204, לא 404 — כלומר הגנה קלאסית באמת הייתה שם), ואז GET-אימות → אין יותר.
- [ ] (חזק, אופציונלי) PR-תיעוד "מאחור" נמזג בלי `update_branch` — **לא נדרש**: הלוג כבר מוכיח ישירות שההגנה הקלאסית הוסרה ושה-main ruleset-only (לא-strict). זמין אם נרצה אישוש end-to-end נוסף.

**הוכחה תפקודית (באותו שלב):** ריצת `protect-main.yml` `27560825765` (success). שורות הלוג:
- `PASS: protect-main ruleset active on edri2or/or-factory-master (id=17029425)` — ה-ruleset אומת פעיל **לפני** המחיקה (main אף רגע לא חשוף).
- `Reconcile: removed leftover classic branch protection on …@main — ruleset is now the sole governor.` — ההגנה הקלאסית הייתה קיימת והוסרה (204). **מאשש סופית את האבחנה.**
- `Reconcile: verified no classic branch protection on …@main (ruleset-only).` — GET-אימות → אין יותר. main מנוהל ע"י ה-ruleset בלבד (לא-strict, 6 בדיקות).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ואומת חי. ריצת `protect-main.yml` האוטומטית הסירה את ההגנה הקלאסית (204) ואימתה שאין יותר, אחרי שאימתה שה-ruleset פעיל. הפיתוח סגור.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — לימדתי את סקריפט-ההגנה למחוק את שכבת-ההגנה הישנה (אחרי שהוא מוודא שההגנה החדשה כבר פעילה, כך שה-main אף פעם לא נשאר חשוף), ומחקתי את ה"מוקש" שיצר אותה.
- שלב 2 הושלם — אחרי המיזוג זה קרה חי: המערכת אימתה שההגנה החדשה פעילה, מחקה את הישנה (שבאמת הייתה שם), ואימתה שאין יותר. מעכשיו ל-main יש רק שכבה אחת — הנכונה, הלא-מחמירה. הפיתוח סגור.
