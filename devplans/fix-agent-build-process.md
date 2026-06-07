<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: תיקון תהליך בניית הסוכנים — הוכחה בכל שלב
slug: fix-agent-build-process
opened: 2026-06-07
status: active
---

# תוכנית פיתוח — תיקון תהליך בניית הסוכנים (הוכחה בכל שלב)

## מטרה

לתקן את *תהליך* בניית הסוכנים כך ששלב נחשב גמור רק כשהוכח שהחלק **באמת עושה את
העבודה, על קלט אמיתי, לבד** — ולא כש"הקוד נכתב וה-CI ירוק". CI-ירוק הכרחי אך לא
מספיק. בונים מלמטה-למעלה ומוכיחים כל לבנה לפני שמניחים עליה את הבאה; החיבור החיצוני
(נוריאל/מייל) הוא הלבנה האחרונה, לא כלי הבדיקה הראשון.

הסקופ פה הוא **הליבה** (החלטת אור: "קודם הליבה, build-agent אחרי"): מתקנים את
`dev-stage` + תבנית-התוכנית (המנוע הגנרי שדרכו נבנה סוכן-הטפסים ושדחה הוכחה לסוף),
ומוסיפים את שכבת-התיעוד (מחקר-הפירוק, תבנית design-spec, ומדריך בדיקה-בבידוד מעשי).
העברת `build-agent` המלאה לפקטורי = פיתוח נפרד אחרי זה.

גבולות: שינוי skills/תיעוד בלבד. אסור לגעת בסוכן-הטפסים (מוקפא). אין provision/deploy.
ענף `claude/sweet-wozniak-XzJ0J`, קומיט+PR, ללא מיזוג עצמי. שערים סטטיים בלבד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיקון `dev-stage` + תבנית-התוכנית (השיניים) | completed | .claude/commands/dev-stage.md, templates/devplan/DEVPLAN.template.md, templates/system/.claude/commands/dev-stage.md, tests/golden/system/MANIFEST.sha256 |
| 2 | שכבת תיעוד: מחקר-פירוק + design-spec + מדריך בדיקה-בבידוד | pending | docs/research/agent-role-decomposition-planning.md, templates/agent-design-spec.md, docs/agent-isolation-testing.md |
| 3 | תפשטות + שערים + PR | pending | templates/system/.claude/commands/dev-stage.md (מראה), changelog.d/, devplan |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — תיקון `dev-stage` + תבנית-התוכנית (השיניים)

**Acceptance:**
- [x] `dev-stage.md` Step 3: "verify each step" מוגדר מחדש — כל שלב חייב **הוכחה
      תפקודית נצפית באותו שלב** (קלט אמיתי → פלט שנראה בעיניים), *בנוסף* ל-CI; ניסוח
      מפורש "CI-ירוק הכרחי אך לא מספיק" (a.1/a.2).
- [x] `dev-stage.md` Step 2: חובת **סדר בוטום-אפ**; איסור מפורש על שלב עם "הוכחה
      בשלב מאוחר יותר".
- [x] `dev-stage.md` Safety Rule 7–8: אסור לסגור שלב בלי הוכחה תפקודית; אסור לדחות
      לשלב "מפץ גדול".
- [x] `DEVPLAN.template.md`: שדה-חובה חדש בכל שלב — **"הוכחה תפקודית (באותו שלב)"**
      (קלט-דוגמה, פלט מצופה, איך נצפה שעבד) + הערת-משמעת ליד הטבלה.

**הוכחה תפקודית (באותו שלב):** נצפתה ✅. הרצתי את הנוסח החדש "על נייר" מול שני קלטים
אמיתיים: (1) ה-devplan של סוכן-הטפסים — שלב 2 שלו (`☐ הוכחה (חי, בשלב 6)`) נחסם כעת
ע"י Safety Rule 8 + Step 2 ("a plan that defers proof to one late big-bang stage is
forbidden"); (2) הדוגמה בתחתית `dev-stage.md` — שלב "הסקריפט" כבר לא נסגר על
Playground-ירוק אלא דורש הרצה על מערכת אמיתית (a.1). בנוסף הרצתי מקומית את כל שערי
ה-CI הרלוונטיים — skills-mirror / system-golden / golden-sync / devplan / changelog —
כולם ירוקים (rc=0).

**הערת התקדמות אחרונה:** הושלם. שלוש עריכות ב-dev-stage.md (Step 2 בוטום-אפ, Step 3
a.1/a.2, Safety 7–8) + שדה הוכחה בתבנית. מראה-המערכות סונכרן (sync-skills-mirror) וה-
golden רוענן (check-system-golden --update). כל השערים מקומית ירוקים.

**שינוי תוכנית:** הסקופ צומצם בהחלטת אור ל"קודם הליבה" — build-agent המלא נדחה לפיתוח
נפרד; שלב זה נשאר כפי שתוכנן.

---

### שלב 2 — שכבת תיעוד: מחקר-פירוק + design-spec + מדריך בדיקה-בבידוד

**Acceptance:**
- [ ] `docs/research/agent-role-decomposition-planning.md` — מבוסס גרסת or-tok,
      מוכלל (לא "נוריאל"-ספציפי), + סעיף חדש: בנייה בוטום-אפ, 3 שערים מסודרים,
      ואיסור "big bang".
- [ ] `templates/agent-design-spec.md` — מבוסס or-tok, + לכל יכולת: **fixture (קלט
      אמיתי נעוץ) + פלט-מצופה + שיטת-בדיקה** (deterministic-first), ושער "הוכחת-רכיב
      לבד" ברשימת-השערים.
- [ ] `docs/agent-isolation-testing.md` — מדריך מעשי: Pin data, בדיקת sub-workflow
      לבד, אימות דרך n8n Public API (בלי MCP) בדגם set-workflow-active, golden fixtures.

**הוכחה תפקודית (באותו שלב):** קלט = יכולת "VLM קורא טופס" מסוכן-הטפסים. פלט מצופה =
ה-design-spec החדש מאלץ לרשום עבורה fixture (טופס-דוגמה) + JSON מצופה + שיטת-בדיקה
*לפני* בנייה. אצפה: אמלא את השורה הזו בדוגמה אמיתית ואראה שהיא קונקרטית ובת-הרצה.

**שינוי תוכנית:** —

---

### שלב 3 — תפשטות + שערים + PR

**Acceptance:**
- [ ] `bash scripts/sync-skills-mirror.sh` הריץ (dev-stage.md המעודכן → mirror), אין drift.
- [ ] שערים מקומיים ירוקים: check-skills-mirror, check-golden-sync/system-golden,
      check-devplan-updated, check-changelog-updated.
- [ ] changelog fragment `changelog.d/2026-06-07-fix-agent-build-process.md` נכתב.
- [ ] PR נפתח (ready for review) מול main. לא ממוזג.

**הוכחה תפקודית (באותו שלב):** קלט = העץ אחרי השינויים. פלט מצופה = כל סקריפטי-השער
מחזירים exit 0. אצפה: אריץ אותם ואראה ירוק לפני פתיחת ה-PR.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — שינינו את החוק עצמו של בניית-הסוכנים: מעכשיו "שלב גמור" פירושו
  שהוכחנו שהחלק *באמת עובד* על דוגמה אמיתית, באותו שלב — "CI ירוק" כבר לא מספיק.
  הוספנו גם כלל שאוסר לדחות את כל הבדיקה לסוף (בדיוק מה שקרה בסוכן-הטפסים), וחובה
  לבנות מלמטה-למעלה. כל מערכת חדשה תקבל את הכלל הזה אוטומטית.
