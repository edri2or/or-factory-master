---
dev_name: הבנת שפה חופשית בבוט הטלגרם (resolver מטושטש)
slug: telegram-bot-fuzzy-resolver
opened: 2026-05-30
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הבנת שפה חופשית ולא-מדויקת בבוט הטלגרם

## מטרה

בכל מערכת חדשה שהפקטורי מקים, בוט הטלגרם יבין שמות קבצים לא-מדויקים (אות חסרה, שם חלקי)
ויחבר אותם לקובץ אמיתי שקיים במערכת — במקום לוותר, לדרוש דיוק, או להמציא. שכבת "מתרגם"
דטרמיניסטית: הראוטר מחלץ את שם הקובץ שהוזכר, מתאים אותו מול קטלוג קבצים אמיתי (Git Trees,
שמור ב-Postgres) בעזרת fuzzy matching, ומזריק לסוכן את הנתיב המאומת. בטוח → קורא לבד;
בינוני → "התכוונת ל-X?" / רשימה ממוספרת; נמוך → מציע להראות תוכן תיקייה. הכל ברמת התבנית
בלבד (`templates/system/`), soft-fail, בלי לגעת במערכות קיימות.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שכבת הקטלוג — producer + אחסון + רישום בהקמה | completed | `file-catalog-refresh.json` (חדש), `db-setup.json`, `configure-agent-router.yml` |
| 2 | תיקון ה-prompts + חשיפת רשימת-תיקייה | pending | `ops-agent.json`, `unknown-agent.json`, `github-readonly.json` |
| 3 | ה-Resolver בראוטר (הליבה) | pending | `agent-router.json` |
| 4 | תיעוד | pending | `AGENTS.md.template` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — שכבת הקטלוג (producer + אחסון + רישום בהקמה)

**Acceptance:**
- [ ] `file-catalog-refresh.json` חדש: Cron שעתי → mint token (כמו github-readonly) → Git Trees recursive → חילוץ נתיבי `blob` → upsert ל-Postgres. רק `@@…@@` placeholders, אפס סודות, soft-fail.
- [ ] `db-setup.json`: נוספה טבלת `file_catalog (chat_id BIGINT PK, paths JSONB, refreshed_at)` + נוספה לרשימת האימות.
- [ ] `configure-agent-router.yml`: רישום + הפעלה + run ראשוני של ה-workflow, soft-fail, בדפוס style-refresh/db-setup.
- [x] כל ה-JSON תקין; ה-yml עובר actionlint + shellcheck -S error + yamllint; Playground ירוק.

**הערת התקדמות אחרונה:** הושלם. נוצר `file-catalog-refresh.json` (Cron שעתי → mint token → Git Trees recursive → חילוץ נתיבי blob → upsert ל-Postgres, עם guard שלא מוחק קטלוג קיים בכשל). נוספה טבלת `file_catalog` ל-`db-setup.json` ולרשימת האימות. נרשם ב-`configure-agent-router.yml` עם הפעלה + run ראשוני. אומת מקומית: JSON תקין, actionlint+shellcheck+yamllint נקי, validate-templates + BATS ירוקים.

**שינוי תוכנית:** —

---

### שלב 2 — תיקון ה-prompts + חשיפת רשימת-תיקייה

**Acceptance:**
- [ ] כל `read_file:AGENT.md` → `read_file:AGENTS.md` בשני הסוכנים (systemMessage + toolDescription).
- [ ] נוספה הוראה: נתיב מאומת → read_file; שאלה רחבה → רשימת תיקייה; לעולם אל תמציא.
- [ ] תיאור הכלי `github_readonly` מציין ש-`read_file:<folder>` מחזיר רשימת תיקייה.
- [ ] `github-readonly.json` `Format Output`: הודעת כשל מועשרת במקום "Not Found" גולמי.
- [ ] אפס `read_file:AGENT.md` נותר; כל ה-JSON תקין; Playground ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — ה-Resolver בראוטר (הליבה)

**Acceptance:**
- [ ] `Classify Intent`: נוסף `entity_mention` לפלט ה-JSON; נשמרו `"intent"`/`"confidence"`/`"json"` (precheck ירוק).
- [ ] `Build Dispatch`: מעביר `entity_mention`.
- [ ] נוספו `Load Catalog` (Postgres) + `Resolve Entity` (code, Jaro-Winkler אפס-תלות) + `Resolver Gate` (switch).
- [ ] חיווט: Build Dispatch → Load Catalog → Resolve Entity → Resolver Gate; continue→Route by Intent, stop→Egress Validation.
- [ ] ספים לפי 7.3; הזרקת נתיב מאומת ל-`sanitized`; degrade חיננית אם אין קטלוג; Playground ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [ ] `AGENTS.md.template`: הערה קצרה על auto-resolve של שמות לא-מדויקים (+ תיקון `AGENT.md`→`AGENTS.md` בדוגמה שלו).
- [ ] התבנית מתרנדרת נקי; Playground ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הבוט מקבל "רשימת קבצים אמיתית" שמתעדכנת כל שעה ונשמרת במסד הנתונים. זו הקרקע שעליה ה-resolver יתאים שמות לא מדויקים בשלבים הבאים.
