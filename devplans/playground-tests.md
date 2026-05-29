---
dev_name: מגרש ניסויים — Playground Tests ל-CI
slug: playground-tests
opened: 2026-05-29
status: active
---

# תוכנית פיתוח — מגרש ניסויים (Playground Tests)

## מטרה

להוסיף שכבת-CI חמישית ל-factory שמריצה בדיקות **runtime** (לא רק תחביר) על
סקריפטים ותבניות בכל PR — BATS לסקריפטים, envsubst-render לתבניות, ו-actionlint
ל-workflows — וחיווט של `/dev-stage` כך שלא ממשיכים ל-bookkeeping עם Playground אדום.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תשתית BATS (submodules + common helper) | completed | `.gitmodules`, `scripts/tests/bats/`, `scripts/tests/test_helper/{bats-support,bats-assert,common.bash}`, `scripts/tests/_smoke.bats` |
| 2 | BATS לחמישה סקריפטי-ליבה | completed | `scripts/tests/{lib,check-changelog-updated,check-devplan-updated,check-actions-pinned,check-workflow-permissions}.bats` |
| 3 | Template rendering validation | pending | `scripts/tests/validate-templates.sh` |
| 4 | Playground Tests CI workflow | pending | `.github/workflows/playground-tests.yml`, אופציונלית `.actionlintrc` |
| 5 | עדכון `dev-stage.md` (Step 3 + Safety Rule) | pending | `.claude/commands/dev-stage.md` (+mirror אם קיים) |
| 6 | Changelog fragment סיכומי | pending | `changelog.d/2026-05-29-playground-tests.md` |
| 7 | (PR נפרד, אחרי מרג') protect-main ruleset | pending | `scripts/ensure-protect-main-ruleset.sh` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — תשתית BATS

**Acceptance:**
- [x] `git submodule status` מראה את שלושת ה-submodules pinned ל-SHA.
- [x] `./scripts/tests/bats/bin/bats --version` מחזיר גרסה (1.13.0).
- [x] `scripts/tests/test_helper/common.bash` קיים וטוען bats-support + bats-assert.
- [x] קובץ smoke (`scripts/tests/_smoke.bats`) רץ ירוק — 5/5 PASS.

**הערת התקדמות אחרונה:** הושלם. bats 1.13.0 + bats-support 0.3.0 + bats-assert 2.2.4 נטענים. common.bash משתמש ב-paths אבסולוטיים עוגנים ב-`BASH_SOURCE` (תיקון: `load` של BATS פותר יחסית לקובץ ה-test, לא לקובץ ה-helper). 5 בדיקות-smoke עוברות מקומית.

**שינוי תוכנית:** —

---

### שלב 2 — BATS לחמישה סקריפטי-ליבה

**Acceptance:**
- [x] חמישה קבצי `.bats` קיימים תחת `scripts/tests/`.
- [x] לכל סקריפט: happy path + לפחות 2 failure paths.
- [x] `./scripts/tests/bats/bin/bats scripts/tests/*.bats` עובר ירוק מקומית — **28/28 PASS**.
- [x] שום test לא דורש רשת/cloud creds.

**הערת התקדמות אחרונה:** הושלם. 28 בדיקות ירוקות לוקאלית. **ממצא — באג סמוי ב-`check-actions-pinned.sh`:** ה-regex `^\s+uses:` לא תופס את הצורה `      - uses:` עם מקף-רשימה, רק את `    uses:` של reusable-workflow callers. כלומר כל ה-`- uses:` ב-steps לא נבדקים בפועל. הבדיקות מתעדות את ההתנהגות הקיימת ומסמנות את הבאג; התיקון לא בוצע (תואם למגבלה "אל תשנה את 4 השערים הקיימים"). מצריך dev-stage נפרד אחרי מרג'.

**שינוי תוכנית:** —

---

### שלב 3 — Template rendering validation

**Acceptance:**
- [ ] `scripts/tests/validate-templates.sh` קיים, שותל את אותה allow-list של `provision-system.yml`.
- [ ] `bash scripts/tests/validate-templates.sh` עובר על תבניות נוכחיות (`AGENTS.md.template`, `CLAUDE.md.template`).
- [ ] הוספת `${UNDEFINED_VAR}` ל-template (זמני) גורמת לסקריפט להיכשל.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — Playground Tests CI workflow

**Acceptance:**
- [ ] `.github/workflows/playground-tests.yml` קיים — actions pinned ל-SHA, permissions `contents: read` בלבד.
- [ ] שם ה-job בדיוק `Playground tests`.
- [ ] ה-job מריץ actionlint + BATS + validate-templates.
- [ ] PR ראשון על ה-branch מראה את ה-Action ירוק.
- [ ] אם actionlint מסמן workflows קיימים — מתקנים, או `.actionlintrc` ממוקד עם הסבר.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — עדכון `dev-stage.md`

**Acceptance:**
- [ ] `.claude/commands/dev-stage.md` מכיל את צעד (a.1) Verify via Playground בין (a) ל-(b).
- [ ] Safety Rules מכיל כלל #7 על Playground אדום.
- [ ] שפה אחידה עם השאר; בלי עומס מילים.
- [ ] mirror תחת `templates/system/.claude/commands/dev-stage.md` מסונכרן אם קיים שם הקובץ.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — Changelog fragment סיכומי

**Acceptance:**
- [ ] `changelog.d/2026-05-29-playground-tests.md` קיים, אחיד עם פורמט שכניו ב-`changelog.d/`.
- [ ] מתעד: BATS infra, 5 test files, validate-templates, playground-tests.yml, dev-stage update.
- [ ] שער `check-changelog-updated.sh` עובר ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — (PR נפרד) protect-main ruleset

**Acceptance:**
- [ ] שלבים 1-6 כבר ב-main, `playground-tests.yml` רץ ירוק על main לפחות פעם אחת.
- [ ] PR חדש: `scripts/ensure-protect-main-ruleset.sh` מוסיף `{context: "Playground tests"}`.
- [ ] אחרי מרג', `protect-main.yml` רץ ומעדכן את ה-ruleset.
- [ ] בדיקה: PR שמכוון לכשל Playground — חסום למרג'.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — התקנתי framework של בדיקות-יחידה ל-bash (BATS) כ-3 מודולים מקובעים, וכלי-עזר משותף לכל הבדיקות. סניטי-טסט קצר עובר.
- שלב 2 הושלם — כתבתי 5 קבצי בדיקות (אחד לכל סקריפט-ליבה), 28 בדיקות עוברות לוקאלית. גיליתי באג ישן ב-`check-actions-pinned.sh`: ה-`- uses:` הסטנדרטי של GitHub Actions לא נבדק. תיקון בנפרד.
