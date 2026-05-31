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
| 0 | הקמת המערכת העומדת (הקמה אמיתית — דורש אישור מפורש) | pending | `provision-system.yml` / `register-system-app.yml` / deploy (dispatch בלבד) |
| 1 | רישום ותיעוד | pending | `reference-system/config.yml`, `docs/reference-system.md` |
| 2 | שער golden סטטי (הרחבת Playground) | pending | `scripts/render-system-golden.sh`, `scripts/check-system-golden.sh`, `tests/golden/system/**`, `.github/workflows/playground-tests.yml` |
| 3 | שער אנטי-סטייה תאום (CI) | pending | `scripts/check-reference-sync.sh`, `.github/workflows/changelog-check.yml` |
| 4 | reconciliation מתוזמן | pending | `.github/workflows/reference-system-reconcile.yml` |
| 5 | שער אימות חי על העומדת | pending | `scripts/reference-system-smoke.sh`, (אופ') `.github/workflows/reference-system-validate.yml` |
| 6 | הסקיל `/dev-stage-factory` | pending | `.claude/commands/dev-stage-factory.md`, mirror sync |
| 7 | חיווט, תיעוד, roadmap | pending | `CLAUDE.md`, `docs/roadmap.md`, `README.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
> **סדר:** 0→1→2→3→4→5→6→7. הסקיל אחרון כי תלוי בשערים 2–5.

---

### שלב 0 — הקמת המערכת העומדת (הקמה אמיתית — דורש אישור מפורש)

dispatch `provision-system.yml` (normal mode, `system_name=or-factory-reference`) →
`register-system-app.yml` → `deploy-railway-cloudflare.yml` בריפו המערכת. Railway:
token מוגבל-פרויקט/workspace היכן שניתן. polling לפי פרוטוקול CLAUDE.md.

**Acceptance:**
- [ ] `gcp_project_quota_status` נבדק ועלות הוצגה לאור; אישור-ביצוע מפורש התקבל
- [ ] provision + register + deploy הסתיימו ב-success (polling אישר terminal status)
- [ ] `verify_gcp/github/railway/cloudflare_system` ירוקים; n8n `/healthz` מחזיר 2xx

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 1 — רישום ותיעוד

**Acceptance:**
- [ ] `reference-system/config.yml` קיים עם `repo`, `gcp_project_id`, `railway_project_id`, `built_from_commit`/`template_version`
- [ ] `docs/reference-system.md` מסביר את מודל שתי-השכבות ואת מנגנון האנטי-סטייה
- [ ] lint עובר; ה-config הוא YAML תקין שנקרא ע"י סקריפט פשוט

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — שער golden סטטי (הרחבת Playground)

`render-system-golden.sh` מרנדר את `templates/system/` עם אותו 14-משתנה allow-list של
`provision-system.yml` ומנרמל שדות תנודתיים; `tests/golden/system/**` = קבצי הזהב;
`check-system-golden.sh` משווה (תומך `--update`); צעד חדש ב-job **"Playground tests"**.

**Acceptance:**
- [ ] הצעד החדש ירוק ב-"Playground tests" (אותו job — בלי required-context חדש)
- [ ] שינוי-תבנית מכוון בלי `--update` → נכשל; עם `--update`+diff → עובר
- [ ] (אופ') `scripts/tests/check-system-golden.bats` ירוק

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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

- (מתמלא תוך כדי.)
