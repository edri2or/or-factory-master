<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage. הקובץ הוא הזיכרון/המצפן
של הסוכן, לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית לפי דרישה.
status: active חוסם מיזוג של שינוי-קוד בלי לעדכן את הקובץ → completed משחרר.
-->
---
dev_name: חיבור ה-GitHub App של המערכת לתבנית (ידיעה + שימוש)
slug: per-system-github-app-template
opened: 2026-05-28
status: active
---

# תוכנית פיתוח — חיבור ה-GitHub App של המערכת לתבנית

## מטרה

כל מערכת חדשה מקבלת GitHub App ייעודי (תג-כניסה אוטומטי מול GitHub, מוגבל לריפו אחד),
אבל הסוכן של המערכת לא יודע שהוא קיים ואין לו דוגמה איך להשתמש בו. הפיתוח סוגר את שני
הפערים בעריכת **תבנית המערכת בלבד** (משפיע רק על מערכות עתידיות): שולח את הכלי
`generate-app-token.sh` לכל מערכת, מוסיף workflow לדוגמה שמדגים שימוש מקצה-לקצה, ומתעד
את ה-App ב-AGENTS.md. הכל ב-PR אחד למיין.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שליחת הכלי `generate-app-token.sh` למערכות | completed | `.github/workflows/provision-system.yml`, `CHANGELOG.md` |
| 2 | workflow לדוגמה + חיווט לרשימת ההעתקה | pending | `templates/system/.github/workflows/mint-app-token-example.yml`, `.github/workflows/provision-system.yml` |
| 3 | תיעוד ה-App ב-`AGENTS.md.template` | pending | `templates/system/AGENTS.md.template` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — שליחת הכלי `generate-app-token.sh` למערכות

**Acceptance:**
- [x] `provision-system.yml` מעתיק את `scripts/generate-app-token.sh` ל-`scripts/` של המערכת, באותו דפוס כמו `emit-event.sh`.
- [x] הודעת ה-PASS של הצעד מזכירה את `generate-app-token.sh`.
- [x] `CHANGELOG.md` עודכן (Stage 117) והוזזו Stages 109–110 לארכיון כדי להישאר מתחת לתקרת 20KB; CI ירוק.

**הערת התקדמות אחרונה:** הושלם. נוספה שורת ה-cp אחרי בלוק ה-emit + הערה שמפנה ל-workflow לדוגמה; PASS עודכן; CHANGELOG עודכן + ארכוב.

**שינוי תוכנית:** —

---

### שלב 2 — workflow לדוגמה + חיווט לרשימת ההעתקה

**Acceptance:**
- [ ] קובץ חדש `mint-app-token-example.yml`: `workflow_dispatch` בלבד, כל Action נעוץ ל-SHA, `permissions` מינימלי, בלי טריגר `pull_request` → עובר את 4 שערי ה-CI של המערכת.
- [ ] נוסף ל-`for wf` בלולאת ההעתקה ב-provision; הודעת ה-PASS אומרת 5 CI workflows.
- [ ] `yamllint` ירוק על הקובץ החדש; CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תיעוד ה-App ב-`AGENTS.md.template`

**Acceptance:**
- [ ] סעיף "GitHub App (per-system)" כולל מה/הרשאות/מתי-כן/מתי-לא/איך + הערת תזמון (הסודות והמשתנים נוצרים ע"י `register-system-app`).
- [ ] 3 סודות ה-App + 2 משתני הריפו (`APP_ID`, `APP_INSTALLATION_ID`) רשומים.
- [ ] בלי placeholders חדשים; ה-allow-list של envsubst לא נגוע; CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם — הכלי שמייצר את "תג-הכניסה" הזמני מול GitHub נשלח מעכשיו אוטומטית לכל מערכת חדשה.
