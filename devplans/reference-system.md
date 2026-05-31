---
dev_name: מערכת-ייחוס עומדת קבועה + אנטי-סטייה
slug: reference-system
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — מערכת-ייחוס עומדת קבועה ("מכונית-ייחוס")

## מטרה

מקימים מערכת-בדיקה חיה, קבועה ומבודדת ("מכונית-ייחוס") שעליה בודקים כל פיתוח של
תהליך-ההקמה *לפני* שהוא נכנס לקוד הקבוע — עם מנגנון אנטי-סטייה שמוודא שהמערכת אף פעם
לא מתרחקת מהפלט שתהליך-ההקמה מייצר היום. מודל שתי-שכבות: (א) המערכת העומדת החדשה —
פיתוח/בדיקה/תיקון שוטף (תופס באגי "Day 2"); ואז (ב) `factory-test-25` הקיימת —
בדיקת הקמה-נקייה-מאפס (תופס באגי "Day 0"). **לא נוגעים בתפקיד של `factory-test-25`.**

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | הקמת המערכת העומדת (הקמה אמיתית — דורש אישור מפורש) | pending (נדחה לסוף) | `provision-system.yml` / `register-system-app.yml` / deploy (dispatch בלבד) |
| 1 | רישום ותיעוד | completed | `reference-system/config.yml`, `scripts/reference-config.sh`, `docs/reference-system.md` |
| 2 | שער golden סטטי (הרחבת Playground) | completed | `scripts/render-system-golden.sh`, `scripts/check-system-golden.sh`, `scripts/tests/check-system-golden.bats`, `tests/golden/system/**`, `.github/workflows/playground-tests.yml` |
| 3 | שער אנטי-סטייה תאום (CI) | pending | `scripts/check-reference-sync.sh`, `.github/workflows/changelog-check.yml` |
| 4 | reconciliation מתוזמן | pending | `.github/workflows/reference-system-reconcile.yml` |
| 5 | שער אימות חי על העומדת | pending | `scripts/reference-system-smoke.sh`, (אופ') `.github/workflows/reference-system-validate.yml` |
| 6 | הסקיל `/dev-stage-factory` | pending | `.claude/commands/dev-stage-factory.md`, mirror sync |
| 7 | חיווט, תיעוד, roadmap | pending | `CLAUDE.md`, `docs/roadmap.md`, `README.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
> **סדר ביצוע (בחירת אור 31.5):** 1→2→3→4→5→6→7 ואז **0 אחרון** — קודם בונים את כל
> שערי-הקוד בלי עלות, ואת ההקמה האמיתית (שלב 0) עושים בסוף עם אישור-ביצוע נפרד.

---

### שלב 0 — הקמת המערכת העומדת (הקמה אמיתית — דורש אישור מפורש)

dispatch `provision-system.yml` (normal mode, `system_name=or-factory-reference`) →
`register-system-app.yml` → `deploy-railway-cloudflare.yml` בריפו המערכת. Railway:
token מוגבל-פרויקט/workspace היכן שניתן. polling לפי פרוטוקול CLAUDE.md.

**Acceptance:**
- [ ] `gcp_project_quota_status` נבדק ועלות הוצגה לאור; אישור-ביצוע מפורש התקבל
- [ ] provision + register + deploy הסתיימו ב-success (polling אישר terminal status)
- [ ] `verify_gcp/github/railway/cloudflare_system` ירוקים; n8n `/healthz` מחזיר 2xx

**הערת התקדמות אחרונה:** ממתין — נדחה לסוף הפיתוח לפי בחירת אור.

**שינוי תוכנית:** 31.5 — לפי בחירת אור, שלב 0 (הקמה אמיתית בעלות) נדחה לסוף; קודם בונים את שערי-הקוד 1→7 בלי עלות, ואז מבצעים את 0 עם אישור-ביצוע מפורש נפרד.

---

### שלב 1 — רישום ותיעוד

**Acceptance:**
- [x] `reference-system/config.yml` קיים עם `repo`, `gcp_project_id`, `railway_project_id`, `built_from_commit`/`template_version`
- [x] `docs/reference-system.md` מסביר את מודל שתי-השכבות ואת מנגנון האנטי-סטייה
- [x] lint עובר; ה-config הוא YAML תקין שנקרא ע"י סקריפט פשוט (`scripts/reference-config.sh`)

**הערת התקדמות אחרונה:** הושלם. `reference-system/config.yml` (descriptor שטוח, `provisioned: false` עד שלב 0) + `scripts/reference-config.sh` (קורא/מאמת בלי `yq`, shellcheck נקי, `validate`/`get` עובדים) + `docs/reference-system.md` (מודל שתי-השכבות + אנטי-סטייה). ממתין לאישור לפני שלב 2.

**שינוי תוכנית:** הוסף `scripts/reference-config.sh` (לא היה במפורש בתוכנית) — קורא שטוח שייֵשּׁוּב ב-reconcile (שלב 4) וב-smoke (שלב 5), ונותן את הוכחת ה"נקרא ע"י סקריפט פשוט".

---

### שלב 2 — שער golden סטטי (הרחבת Playground)

`render-system-golden.sh` מרנדר את `templates/system/` עם אותו 14-משתנה allow-list של
`provision-system.yml` ומנרמל שדות תנודתיים; `tests/golden/system/**` = קבצי הזהב;
`check-system-golden.sh` משווה (תומך `--update`); צעד חדש ב-job **"Playground tests"**.

**Acceptance:**
- [x] הצעד החדש ("System golden gate") ירוק ב-job "Playground tests" — בלי required-context חדש
- [x] שינוי-תבנית מכוון בלי `--update` → נכשל; עם `--update`+diff → עובר (הוכח: קובץ רגיל + `.template` מרונדר)
- [x] `scripts/tests/check-system-golden.bats` ירוק (5 בדיקות)

**הערת התקדמות אחרונה:** הושלם. `render-system-golden.sh` מרנדר את כל המולד (109 קבצים) עם 14-משתנה allow-list קבוע, ומחליף `.template` בשמות המרונדרים בדיוק כמו מערכת אמיתית; הזהב = `tests/golden/system/MANIFEST.sha256` (טביעת sha256 byte-exact) + `rendered/{AGENTS,CLAUDE}.md` ל-diff קריא. `check-system-golden.sh` משווה ותומך `--update`. אומת מקומית: PASS על התאמה, FAIL על שתי סטיות מכוונות, 95/95 BATS, validate-templates, yamllint נקיים. ממתין לאישור לפני שלב 3.

**שינוי תוכנית:** הזהב מיושם כ-sha256 manifest (byte-exact) + שני קבצי-render מלאים, במקום עותק-עץ מלא — קל לאחסון ותופס 100% מהסטייה; "byte-for-byte" נשמר דרך ה-hash.

---

### שלב 3 — שער אנטי-סטייה תאום (CI)

`check-reference-sync.sh`: אם ה-diff נוגע ב-`templates/system/**` / `provision-system.yml` /
`deploy-railway-cloudflare.yml` — חובה שייגע גם ב-`tests/golden/system/**`; אחרת נכשל.
no-op אחרת. תאום ל-`check-changelog-updated.sh`. צעד חדש ב-job **"Changelog gates"**.

**Acceptance:**
- [ ] PR-בדיקה שנוגע בתבנית בלי golden → נכשל; עם golden → עובר
- [ ] no-op כשהשינוי לא נוגע בתבנית/provision/deploy
- [ ] (אופ') `scripts/tests/check-reference-sync.bats` ירוק

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — reconciliation מתוזמן

`reference-system-reconcile.yml`: cron ~6h + dispatch ידני; מודל על `system-runtime-audit.yml`.
קורא `reference-system/config.yml`; משווה `built_from_commit` מול main + golden מול החי;
פער → `emit-event.sh` (Axiom + Telegram + Linear) + אופ' dispatch rebuild.

**Acceptance:**
- [ ] dispatch ידני מחזיר `ok` כשהמערכת תואמת
- [ ] הזרקת סטייה מכוונת → אירוע `alert` (Axiom + Telegram + Linear) דרך emit-event
- [ ] actionlint/yamllint ירוקים על ה-workflow

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — שער אימות חי על העומדת

`reference-system-smoke.sh`: smoke/E2E מול העומדת (n8n `/healthz`, edge של Caddy,
probe ל-agent-router). אופ': `reference-system-validate.yml` שמחיל שינוי + מריץ smoke.

**Acceptance:**
- [ ] הסקריפט ירוק מול מערכת בריאה
- [ ] נכשל (exit ≠ 0) כשמשבשים בכוונה רכיב
- [ ] BATS/lint ירוקים

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — הסקיל `/dev-stage-factory`

`.claude/commands/dev-stage-factory.md` (`audience: factory-only`), מודל על `dev-stage.md`.
לולאת אימות: golden ירוק → החלה על העומדת + smoke ירוק → בסוף: הקמת מערכת-טסט טרייה על
`factory-test-25` (שכבה ב'). עצירה-לאישור בכל גבול. הרצת `sync-skills-mirror.sh`.

**Acceptance:**
- [ ] הסקיל קיים עם `audience: factory-only` ולא נכנס ל-`templates/system/.claude/commands/`
- [ ] `check-skills-mirror.sh` ירוק (mirror לא השתנה)
- [ ] ריצת-יבש על שינוי-דמה מראה את הרצף הנכון + עצירות

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — חיווט, תיעוד, roadmap

עדכון `CLAUDE.md` (Development workflow + טבלאות skills/workflows), `docs/roadmap.md`
(Phase חדש אחרי Phase G), `README.md` אם נדרש.

**Acceptance:**
- [ ] CLAUDE.md + roadmap מעודכנים ועקביים עם מה שנבנה
- [ ] כל השערים ("Playground tests", "Changelog gates") ירוקים
- [ ] אין required-context חדש בענף-ההגנה

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — רשמנו "מי" המערכת העומדת בקובץ קונפיג + כתבנו מסמך שמסביר את הרעיון (שתי שכבות + איך מונעים סטייה). עדיין בלי הקמה אמיתית.
- שלב 2 הושלם — בנינו "שער זהב": המחשב שומר תמונת-אמת של מה שמערכת חדשה אמורה לקבל, ומשווה אליה אוטומטית בכל שינוי. אם מישהו משנה תבנית בלי לעדכן את התמונה — ה-CI עוצר. בדקנו שזה תופס סטייה ושאפשר לעדכן את התמונה בכוונה.
