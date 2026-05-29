---
dev_name: מגרש ניסויים — Playground Tests ל-CI
slug: playground-tests
opened: 2026-05-29
status: completed
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
| 3 | Template rendering validation | completed | `scripts/tests/validate-templates.sh` |
| 4 | Playground Tests CI workflow | completed | `.github/workflows/playground-tests.yml` |
| 5 | עדכון `dev-stage.md` (Step 3 + Safety Rule) | completed | `.claude/commands/dev-stage.md`, `templates/system/.claude/commands/dev-stage.md` |
| 6 | Changelog fragment סיכומי | completed | `changelog.d/2026-05-29-playground-tests.md` |
| 7 | (PR נפרד, אחרי מרג') protect-main ruleset | completed | `scripts/ensure-protect-main-ruleset.sh` |

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
- [x] `scripts/tests/validate-templates.sh` קיים, שותל את אותה allow-list של `provision-system.yml`.
- [x] `bash scripts/tests/validate-templates.sh` עובר על תבניות נוכחיות (`AGENTS.md.template`, `CLAUDE.md.template`).
- [x] הוספת `${UNDEFINED_VAR}` ל-template (זמני) גורמת לסקריפט לכשל עם הודעה ברורה.

**הערת התקדמות אחרונה:** הושלם. סורק `*.template` תחת `templates/system/` רקורסיבית, מרנדר עם אותה allow-list של 14 משתנים שב-`provision-system.yml:820`, וב-rendered output בודק: (1) שאין `${UPPER_CASE}`/$`UPPER_CASE` שנשארו, (2) `*.yml.template`/`*.yaml.template` עוברים yamllint כשזמין, (3) `*.sh.template` עוברים `bash -n`. היום קיימות רק 2 תבניות `.md.template`; ההרחבות עתידיות מחוברות כבר ל-pipeline.

**שינוי תוכנית:** —

---

### שלב 4 — Playground Tests CI workflow

**Acceptance:**
- [x] `.github/workflows/playground-tests.yml` קיים — `actions/checkout` pinned לאותו SHA כמו `pipeline-tests.yml`, `permissions: contents: read`, `submodules: true`, `fetch-depth: 0`.
- [x] שם ה-job בדיוק `Playground tests`.
- [x] ה-job מריץ actionlint + BATS + validate-templates.
- [x] actionlint עובר עם `-shellcheck "shellcheck -S error"` (תואם ל-`pipeline-tests.yml` הקיים — לא משתיק errors, רק noise של style/info).
- [ ] CI ירוק על PR (יתאמת אחרי push).

**הערת התקדמות אחרונה:** הושלם מקומית. actionlint כשמופעל עם severity=error כמו פייפליין-הקיים — אפס issues על workflows הקיימים. ה-yamllint של הריפו (`extends: relaxed`, line-length disabled) עובר על ה-workflow החדש נקי. אין צורך ב-`.actionlintrc` — הסינון נעשה ב-flag.

**שינוי תוכנית:** —

---

### שלב 5 — עדכון `dev-stage.md`

**Acceptance:**
- [x] `.claude/commands/dev-stage.md` מכיל את צעד (a.1) Verify via Playground בין (a) ל-(b).
- [x] Safety Rules מכיל כלל #7 על Playground אדום.
- [x] שפה אחידה עם השאר; בלי עומס מילים.
- [x] mirror תחת `templates/system/.claude/commands/dev-stage.md` מסונכרן (נשאר byte-identical).

**הערת התקדמות אחרונה:** הושלם. צעד (a.1) + Safety Rule #7 נוספו ל-`.claude/commands/dev-stage.md`, וה-mirror בתבנית-המערכת סונכרן ל-byte-identical (כפי שנשמר מאז parallel-dev-stage). ה-Playground check הוא factory-internal — סעיף "N/A אם לא רלוונטי" שבצעד מטפל אוטומטית במערכות שאין להן את ה-check (תמיד N/A → ממשיכים).

**שינוי תוכנית:** —

---

### שלב 6 — Changelog fragment סיכומי

**Acceptance:**
- [x] `changelog.d/2026-05-29-playground-tests.md` קיים, אחיד עם פורמט שכניו ב-`changelog.d/`.
- [x] מתעד: BATS infra, 5 test files, validate-templates, playground-tests.yml, dev-stage update.
- [x] שער `check-changelog-updated.sh` עבר ירוק לאורך כל השלבים.
- [x] נוספה פסקת Overview שמסבירה את התמונה המלאה ואת ההפרדה של שלב 7 ל-PR נפרד.

**הערת התקדמות אחרונה:** הושלם. ה-fragment צבר רשומה לכל שלב 1–5 לאורך הפיתוח; שלב 6 הוסיף פסקת Overview בראש שמסכמת את כל ה-PR ומבהירה ששלב 7 (protect-main) ב-PR נפרד אחרי מרג'. ה-PR (שלבים 1–6) מוכן למיזוג. ה-devplan נשאר `status: active` כי שלב 7 עדיין פתוח.

**שינוי תוכנית:** —

---

### שלב 7 — (PR נפרד) protect-main ruleset

**Acceptance:**
- [x] שלבים 1-6 כבר ב-main (PR #216, מוזג), `playground-tests.yml` רץ ירוק על main (run 26665176093, `fb451ee`).
- [x] PR חדש: `scripts/ensure-protect-main-ruleset.sh` מוסיף `{context: "Playground tests"}`.
- [ ] אחרי מרג', `protect-main.yml` רץ ומעדכן את ה-ruleset (יתאמת post-merge).
- [ ] בדיקה: PR שמכוון לכשל Playground — חסום למרג' (אימות post-merge).

**הערת התקדמות אחרונה:** הקוד הושלם ב-PR נפרד על אותו branch אחרי ש-PR #216 נמרג וה-workflow רץ ירוק על main. הוספתי `{context: "Playground tests"}` ל-5 ה-checks הנדרשים. `protect-main.yml` מזהה-עצמי את השינוי ל-`scripts/ensure-protect-main-ruleset.sh` ויעדכן את ה-ruleset אוטומטית עם המרג'. שני תנאי-הקבלה האחרונים (ריצת protect-main + חסימת PR-כושל) נצפים רק אחרי מרג'.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — התקנתי framework של בדיקות-יחידה ל-bash (BATS) כ-3 מודולים מקובעים, וכלי-עזר משותף לכל הבדיקות. סניטי-טסט קצר עובר.
- שלב 2 הושלם — כתבתי 5 קבצי בדיקות (אחד לכל סקריפט-ליבה), 28 בדיקות עוברות לוקאלית. גיליתי באג ישן ב-`check-actions-pinned.sh`: ה-`- uses:` הסטנדרטי של GitHub Actions לא נבדק. תיקון בנפרד.
- שלב 3 הושלם — סקריפט שמוודא שתבניות-המערכת מתרנדרות נכון לפני שמפעילים אותן על מערכת אמיתית. שתי התבניות הקיימות עוברות; placeholder שבור (לבדיקה ידנית) מקפיץ FAIL ברור.
- שלב 4 הושלם — Workflow חדש "Playground Tests" שמריץ actionlint + BATS + validate-templates בכל PR. אומת ירוק ב-CI: 5 שערים, כולל החדש. כל 28 הבדיקות רצו בענן.
- שלב 5 הושלם — עדכנתי את הוראת-העבודה `/dev-stage` כך שתחייב Playground ירוק לפני סגירת שלב, ועדכנתי גם את הגרסה שנשתלת במערכות חדשות.
- שלב 6 הושלם — סגרתי את רשומת ה-changelog עם סיכום-על. שלבים 1–6 מוכנים למיזוג כ-PR אחד. נשאר רק שלב 7 (להפוך את הבדיקה ל"חובה") שילך ב-PR נפרד אחרי שזה יתמזג.
- שלב 7 הושלם (קוד) — PR #216 נמרג וה-workflow רץ ירוק על main, אז ב-PR נפרד הוספתי את "Playground tests" לרשימת הבדיקות שחובה לעבור כדי למזג ל-main. אחרי מרג' השלב הזה, אף שינוי קוד לא יוכל להיכנס ל-main אם המגרש אדום. הפיתוח כולו הסתיים.
