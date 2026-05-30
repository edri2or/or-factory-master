---
dev_name: ops-agent — מודעות-כלים + קריאת קבצים מהריפו
slug: ops-agent-file-read
opened: 2026-05-30
status: completed
---

# תוכנית פיתוח — מודעות-כלים של הבוט + קריאת קבצים

## מטרה

המשך ל-`ops-agent-live-telemetry` (מוזג, מוכח חי). אימות חי חשף שתי בעיות: (1) הבוט לא
*יודע* על הכלים החיים החדשים כששואלים אותו כללית — כי כרטיס היכולות הפנימי (`SYSTEM_INFO_JSON`
ב-`configure-agent-router.yml`) עדיין מפרט רק 3 כלים ישנים — ולכן מסרב לגבי GitHub; (2) אין
פקודה לקריאת **תוכן קובץ** מהריפו. הפיתוח מתקן את המודעות ומוסיף `read_file:<path>` ל-
`github_readonly`, read-only. **תבנית בלבד**; מערכות קיימות צרובות עם הקוד הנוכחי.

**כללי ברזל:** read-only; soft-fail בכל ענף חדש; אין סודות ב-JSON (רק ids/placeholders);
token כ-opaque.

## ממצאי מחקר (אומתו)

- GitHub Contents API `GET /repos/{owner}/{repo}/contents/{path}` → `{type,encoding:"base64",
  content,size,path,html_url}`; תיקייה→מערך; חסר→404. >1MB דורש media-type `.raw` (מחוץ ל-v1).
  הרשאת `contents` כבר קיימת. base64 ב-n8n: `Buffer.from(s,'base64').toString('utf8')` —
  `Buffer` global, ללא env מיוחד.
- מבנה github-readonly: Normalize → mint stage (דורס $json) → Switch → HTTP GET (`$json.token`)
  → Format Output. command/path נקראים מ-`$('Normalize Input').first().json`.

## שלבים

| # | כותרת | סטטוס | קבצים |
|---|---|---|---|
| 1 | מודעות-כלים — עדכון SYSTEM-INFO | completed | `templates/system/.github/workflows/configure-agent-router.yml` |
| 2 | פקודת `read_file` + תיאור הכלי | completed | `templates/system/workflows/n8n/github-readonly.json`, `.../ops-agent.json` |
| 3 | תיעוד מערכת | completed | `templates/system/AGENTS.md.template`, `CHANGELOG.md`, `changelog.d/` |

> כל שלב = commit ל-PR + עדכון התוכנית + פתק changelog, ועוצר לאישור Or.

---

### שלב 1 — מודעות-כלים (SYSTEM-INFO)

ב-`configure-agent-router.yml`, ה-`SYSTEM_INFO_JSON` (jq -cn): להחליף את
`capabilities.tools:[3 ישנים]` ב-`live_read_sources` ברמת-מערכת שכולל GitHub
(CI/commits/PRs/file contents) + Railway (deploy/logs) + n8n + Postgres-set.

**Acceptance:**
- [x] SYSTEM-INFO כולל GitHub (incl. read_file) + Railway (`live_read_sources`, 4 מקורות).
- [x] `shellcheck -S error` + `yamllint` נקיים; jq בונה JSON תקין (אומת עם ערכי-דמה,
      שם הריפו `edri2or/$sys` מוטמע נכון).

**הערת התקדמות אחרונה:** החלפתי את `capabilities.tools` (3 ישנים) ב-`live_read_sources`
ברמת-מערכת שכולל את GitHub (CI/commits/PRs + read_file) ו-Railway. הוספתי הערה שמסבירה
שהכרטיס סמכותי ולכן חייב להישאר מסונכרן עם הכלים. אומת מקומית.
**שינוי תוכנית:** —

---

### שלב 2 — פקודת `read_file`

- `github-readonly.json`: Normalize מזהה `read_file:<path>` (regex `^read_file[:\s]+(.+)$`,
  strip leading `/`) → `{command:"read_file",path}`; Switch rule רביעי; נוד HTTP GET
  `GH File Contents` (`/contents/{{ $('Normalize Input').first().json.path }}`, Bearer token,
  onError continue); Format Output מפענח base64 (Buffer), cap ~16K תווים, תיקייה→רשימה, 404→ok:false.
- `ops-agent.json`: עדכון `description` של `github_readonly` לכלול `read_file:<path>`.

**Acceptance:**
- [x] `jq .` תקין (שני הקבצים); כל Code node עובר `node --check`; Switch=4 rules/5 outputs, GH File Contents מחווט.
- [x] סימולציה פונקציונלית: `read_file:AGENT.md`→`{command:"read_file",path:"AGENT.md"}`;
      תתי-תיקיות + strip של `/`/רווחים; ci_runs/open_prs לא נחטפו; Format מפענח base64,
      מטפל בתיקייה (רשימה) וב-404 (`ok:false`).
- [x] אין סוד ב-JSON (רק placeholders); read-only (`onError:continueRegularOutput`); הזרימה הקיימת שלמה.

**הערת התקדמות אחרונה:** Normalize מזהה `read_file:<path>` בלוגיקת-מחרוזות (בלי regex);
Switch קיבל ענף רביעי; נוד `GH File Contents` קורא את ה-Contents API; Format מפענח base64
עם תקרת 16K. ה-path מועבר דרך `$('Normalize Input')` (כי ה-mint stage דורס $json). אומת בסימולציה.
**שינוי תוכנית:** —

---

### שלב 3 — תיעוד מערכת

**Acceptance:**
- [x] `AGENTS.md.template` (read_file בשני המקומות) + `CHANGELOG.md` (שורת feat) + פתק
      `templates/system/changelog.d/`, בלי `${...}` חדש.
- [x] `validate-templates.sh` עובר (AGENTS + CLAUDE templates נקי).

**הערת התקדמות אחרונה:** תיעדתי את read_file + מודעות-הכלים בשלושה מקומות בתבנית. **הפיתוח הקודי הושלם.**
**שינוי תוכנית:** —

---

## אימות חי (דורש אישור Or — צעד נפרד)

מערכת test טרייה (`factory-test-025`): שרשרת מלאה → הודעות לבוט "מה אתה יכול?" +
"מה כתוב ב-AGENT.md?"; אימות ב-n8n ש-read_file החזיר ok:true.

## יומן ל-Or (עברית)

- שלב 1 הושלם — עדכנתי את "כרטיס היכולות" של הבוט שיכלול את גיטהאב ו-Railway, כדי שיפסיק לסרב כששואלים אותו כללית.
- שלב 2 הושלם — הוספתי לבוט יכולת לקרוא תוכן של קובץ מהריפו (`read_file:<נתיב>`), קריאה בלבד.
- שלב 3 הושלם — תיעדתי הכל בתבנית. **הפיתוח הקודי הושלם.** נשאר רק אימות חי (מערכת test טרייה) — צעד נפרד באישורך.
