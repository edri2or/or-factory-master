<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: העברת build-agent לפקטורי (Scope A)
slug: port-build-agent
opened: 2026-06-07
status: active   # → completed post-merge (the devplan gate requires this plan to stay
                 # active while the PR carries code changes + other plans are active)
---

# תוכנית פיתוח — העברת build-agent לפקטורי (פורט + הוכחה סטטית)

## מטרה

הפקודה שבונה סוכן בפועל (`build-agent`) קיימת רק ב-or-tok, לא בפקטורי — אז מערכות
חדשות לא יודעות לבנות סוכנים. מעבירים אותה לפקטורי כ-skill **משותף**, מבוססת על גרסת
or-tok, מוכללת (בלי "Nuriel"), ומשודרגת לפי הכלל החדש (3 שערים מסודרים). Scope A:
פורט + הוכחה סטטית בלבד; הדוגפוד החי על מערכת-טסט = פיתוח-המשך נפרד (Or-gated).

גבולות: כלי-בנייה/skills/תבניות בלבד — לא נוגעים ב-runtime/בצינור-הפריסה ולא בסוכן-הטפסים.
שערים סטטיים. ענף `claude/sweet-wozniak-XzJ0J`, קומיט+PR, ללא מיזוג עצמי.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | קבצי-תשתית אינרטיים (template + contract + manifest) | completed | templates/system/templates/n8n/subagent.template.json, templates/system/templates/n8n/subagent.contract.md, templates/system/workflows/n8n/agents.manifest.json, tests/golden/system/MANIFEST.sha256 |
| 2 | שער "קול-אחד" + חיווט CI | completed | scripts/check-agent-single-voice.sh, .github/workflows/playground-tests.yml, .github/workflows/provision-system.yml, templates/system/.github/workflows/pipeline-tests.yml, tests/golden/system/MANIFEST.sha256 |
| 3 | ה-skill build-agent + שילוח חומרי-ייחוס למערכות | completed | .claude/commands/build-agent.md, templates/system/.claude/commands/build-agent.md (mirror), .github/workflows/provision-system.yml, tests/golden/system/MANIFEST.sha256 |
| 4 | תפשטות + שערים + PR | completed | devplan, changelog.d/ |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב* — לא
> "CI ירוק" (הכרחי אך לא מספיק). בנייה מלמטה-למעלה.

---

### שלב 1 — קבצי-תשתית אינרטיים

**Acceptance:**
- [ ] `subagent.template.json` + `subagent.contract.md` תחת `templates/system/templates/n8n/`, מוכללים (בלי "Nuriel").
- [ ] `agents.manifest.json` תחת `templates/system/workflows/n8n/` — 5 הסוכנים של הפקטורי (ops/code/research/infra/unknown), ללא forms.

**הוכחה תפקודית (באותו שלב):** נצפתה ✅. `jq empty` עבר על template+manifest; כל 5
`agents[].file` קיימים תחת `templates/system/workflows/n8n/`; ורשימת ה-intents
(code/infra/ops/research/unknown) **זהה בדיוק** ל-5 ה-specs בלולאה הקשיחה של
`configure-agent-router.yml` (MATCH, ללא ghost). golden רוענן (117 קבצים), שערי
golden/golden-sync/skills-mirror ירוקים.

**שינוי תוכנית:** —

---

### שלב 2 — שער "קול-אחד" + חיווט CI

**Acceptance:**
- [ ] `scripts/check-agent-single-voice.sh` (מוכלל) נוצר ומסוגל לרוץ על נתיב טמפלייטים.
- [ ] מחווט ל-CI הפקטורי (רץ על `templates/system/workflows/n8n/*-agent.json`) + ל-system pipeline-tests.yml; נשלח למערכות כמו שאר check-*.sh.

**הוכחה תפקודית (באותו שלב):** נצפתה ✅. השער הוחזר: PASS על 5 סוכני-הפקטורי (+2 מדיה);
PASS על סוכן שנולד חי מ-`subagent.template.json`; FAIL (rc=1) על עותק עם node טלגרם
מוזרק. shellcheck נקי (severity=error), yamllint נקי, golden רוענן, כל השערים ירוקים.

**שינוי תוכנית:** הסקריפט פורמט עם `AGENT_DIR` (ברירת מחדל workflows/n8n) כדי שאותו קובץ
ישמש גם את ה-CI של הפקטורי (על הטמפלייטים) וגם כל מערכת.

---

### שלב 3 — ה-skill build-agent + שילוח חומרי-ייחוס

**Acceptance:**
- [ ] `.claude/commands/build-agent.md` (audience: shared) — מוכלל, 3 שערים מסודרים, Step 0 דורש fixture+פלט-מצופה לכל רכיב.
- [ ] חומרי-הייחוס (design-spec + 2 מסמכים) זמינים גם תחת `templates/system/` (כדי שמערכת תמצא אותם).

**הוכחה תפקודית (באותו שלב):** נצפתה ✅. הצלבתי כל נתיב-קובץ שמוזכר ב-build-agent.md מול
העץ — כל הפניה לא-דוגמה נפתרת לקובץ אמיתי (שמות בודדים בפרוזה כמו `ops-agent.json`
נפתרים לנתיב המלא; שני נתיבי-הדוגמה `billing-agent.json`/`forms.md` הם פלט-שנוצר-בשימוש
בבלוק הדוגמאות). 0 הפניות-רפאים. ה-skill הוא 3 שערים מסודרים + Step 0 שדורש fixture לכל
חלק; provision שולח את חומרי-הייחוס למערכות (+`docs` בעץ). golden+mirror רועננו, lint נקי.

**שינוי תוכנית:** שער-הניתוב (eval_router/router_battery) מתואר ב-skill כ"היכן שהמערכת
שולחת את חבילת-ה-eval"; השער הקשיח שתמיד נשלח הוא single-voice. שילוח חבילת-ה-eval המלאה
למערכות = חלק מהדוגפוד-החי (Scope B).

---

### שלב 4 — תפשטות + שערים + PR

**Acceptance:**
- [ ] `sync-skills-mirror.sh` הריץ (build-agent.md → mirror); `check-system-golden.sh --update`.
- [ ] changelog fragment; devplan completed; PR פתוח (ready), לא ממוזג.

**הוכחה תפקודית (באותו שלב):** נצפתה ✅. התפשטות (mirror+golden) בוצעה פר-שלב, לא נדחתה.
ה-CI על PR #340 (commit 565739d) ירוק לחלוטין — כל 5 הבדיקות `success` (Playground tests
הריץ את שער single-voice על הטמפלייטים + actionlint על provision), `mergeable_state: clean`.

**שינוי תוכנית:** התפשטות קרתה פר-שלב במקום להידחות לסוף — שלב 4 התכווץ ל-אימות-CI + סגירה.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — הנחנו את "המגירות" שחסרו בפקטורי: תבנית "סוכן ריק" לשכפול, מסמך-החוזה
  שמסביר איך סוכן מתנהג, ופנקס-הסוכנים. וידאתי שהפנקס תואם בדיוק למה שהמערכת באמת מתקינה.
- שלב 2 הושלם — בנינו "שומר" אוטומטי שמוודא שכל סוכן מתנהג כמו שצריך (מחזיר תשובה
  ל-orchestrator, לא מדבר ישירות עם המשתמש). חיברנו אותו לבדיקות של הפקטורי ושל כל מערכת
  חדשה. הוכחתי שהוא עובד: נתן "עבר" לסוכנים התקינים ו"נכשל" לסוכן שניסיתי "לשבור" בכוונה.
- שלב 3 הושלם — כתבנו את המתכון עצמו (`build-agent`), משודרג: עכשיו הוא מחייב להוכיח כל
  חלק לבד *לפני* שבונים את הבא, ומחבר לנוריאל אחרון — בדיוק העיקרון שתיקנו. דאגנו שכל
  מערכת חדשה תקבל גם את המתכון וגם את כל חומרי-העזר שהוא צריך. בדקתי שאין במתכון שום הפניה
  לקובץ שלא קיים.
- שלב 4 הושלם — ה-CI על ה-PR ירוק לגמרי, והפיתוח מוכן. מעכשיו כל מערכת חדשה נולדת עם
  היכולת לבנות סוכנים נכון (מלמטה-למעלה, הוכחה לכל חלק). התוכנית נשארת `active` עד המיזוג
  (כלל-CI: תוכנית חייבת לכסות את שינויי-הקוד), ותיסגר ל-`completed` מיד אחרי שתמזג. נשאר
  רק שתאשר ותמזג.
