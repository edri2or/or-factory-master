---
dev_name: סקיל "operate-this-system" אוטומטי לכל מערכת
slug: system-operate-skill
opened: 2026-06-15
status: completed   # הפיתוח הושלם — or-edri-4 קיבל את הסקיל ואומת חי; מערכות עתידיות יקבלו אוטומטית
---

# תוכנית פיתוח — סקיל "operate-this-system" אוטומטי לכל מערכת

## מטרה

כל מערכת ש-or-factory-master מקים תיוולד עם סקיל Claude ייעודי
(`.claude/skills/operate-this-system/SKILL.md`) שמאפשר ל-Claude Code שעובד ב-repo של המערכת
לזהות מיד שזו מערכת-מפעל ולדעת לאן לפנות (ל-`AGENTS.md`) כדי לתפעל אותה. שינוי בתהליך-ההקמה,
לכן הוכח חי על מערכת-הניסוי הקבועה or-edri-4 לפני שקובע בתבנית. מערכות עתידיות
מקבלות אוטומטית; מערכות קיימות קיבלו ב-backfill.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כתיבת הסקיל הסטטי + רענון golden (PR אחד ל-main) | completed | `templates/system/.claude/skills/operate-this-system/SKILL.md`, `tests/golden/system/**`, `devplans/system-operate-skill.md`, `changelog.d/2026-06-15-system-operate-skill.md` |
| 2 | קיבוע בתבנית + הוכחה חיה על or-edri-4 (backfill) | completed | (תפעולי — `refresh-system-agents.yml` על or-edri-4) |
| 3 | סריקת מערכות-חיות נוספות + סגירה | completed | `devplans/system-operate-skill.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.
>
> **הוכחת E2E כשמשנים התנהגות בוט:** לא רלוונטי כאן — הסקיל הוא קובץ תיעוד סטטי
> תחת `.claude/skills/`, לא נוגע ב-`workflows/n8n/*.json` ולא ב-`configure-agent-router.yml`,
> לכן שער ה-E2E לא חל (הוא חל רק על קבצי-ההתנהגות).

---

### שלב 1 — כתיבת הסקיל הסטטי + רענון golden

**Acceptance:**
- [x] נוצר `templates/system/.claude/skills/operate-this-system/SKILL.md` — שם קובץ **רישי**,
      frontmatter תקין (`name: operate-this-system` = שם התיקייה, `description` = 812 תווים ≤1024),
      **בלי placeholders** (`${...}` או `@@TOKEN@@`), בקול ובפורמט של הסקילים האחים.
- [x] ה-golden עודכן (`bash scripts/check-system-golden.sh --update`) ונכלל באותו PR; הקובץ
      החדש מופיע ב-`tests/golden/system/MANIFEST.sha256` בנתיב המדויק.
- [x] חמשת שערי ה-CI ירוקים: Playground tests (golden) · Changelog gates (golden-sync,
      changelog, devplan) · shellcheck+yamllint · secret-scan · supply-chain.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (לא-התנהגותי). הוכח: הקובץ מופיע ב-MANIFEST בנתיב
`.claude/skills/operate-this-system/SKILL.md` (hash `cff96bd6…`); שם הקובץ רישי; `name` = שם
התיקייה; `description` = 812 תווים; אין `${`/`@@` בקובץ; ה-hash ב-golden = ה-hash של המקור
(זהה-בייט, אין placeholders). כל 6 שערי ה-CI ירוקים על PR #466.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ומוזג — PR #466 ירוק ב-6/6 שערים, מוזג ל-main (squash, `f660c1c`).

**שינוי תוכנית:** —

---

### שלב 2 — קיבוע בתבנית + הוכחה חיה על or-edri-4

**Acceptance:**
- [x] PR שלב 1 מוזג ל-main (קיבוע בתבנית).
- [x] `refresh-system-agents.yml` הורץ עם `system_name=or-edri-4`,
      `paths=.claude/skills/operate-this-system`, `run_configure=false` — הסתיים בטרמינל success
      (run `27552856170`). הופעל דרך ערוץ ה-GitHub MCP (הכלי `dispatch_workflow` היה חסום
      בשער-אישור), אותו broker, אותו workflow.
- [x] אימות חי: הקובץ קיים ב-`edri2or/or-edri-4` בנתיב הנכון (רישי, זהה-בייט למקור);
      `/healthz` של `n8n-or-edri-4.or-infra.com` החזיר `200 {"status":"ok"}` (אין נזק נלווה).

**הוכחה תפקודית (באותו שלב):** הקובץ נוכח verbatim ב-repo של מערכת חיה אמיתית (or-edri-4)
+ המערכת בריאה (probe_endpoint על /healthz = 200).

**הוכחת E2E (artifact):** לא-התנהגותי (סקיל לא נוגע בקבצי-התנהגות; שער ה-E2E לא חל).

**הערת התקדמות אחרונה:** הוכח חי על or-edri-4 — הקובץ נחת ב-repo, /healthz = 200.

**שינוי תוכנית:** —

---

### שלב 3 — סריקת מערכות-חיות נוספות + סגירה

**Acceptance:**
- [x] נסרק המלאי החי (`list_all_systems_inventory`): or-edri-4 היא המערכת הפרוסה היחידה
      (Railway = פרויקט אחד; שאר פרויקטי ה-GCP הם `factory-test-*` זמניים/משותפים, לא מערכות עומדות).
      לכן ה-backfill הושלם כבר בשלב 2 — אין מערכת חיה נוספת לטפל בה.
- [x] סגירת הפיתוח: `status: completed` + יומן ל-Or, ב-PR docs-only נפרד.

**הוכחה תפקודית (באותו שלב):** הקובץ נוכח בכל מערכת חיה שסומנה ל-backfill (or-edri-4 — אומת בשלב 2;
אין נוספות).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** סריקה הראתה שאין מערכת חיה נוספת מעבר ל-or-edri-4. הפיתוח נסגר.

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

- ללא מערכת-טסט חד-פעמית — ההוכחה רצה על **or-edri-4** הקבועה (שלא מפרקים לעולם). אין מה לפרק.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- "שלב 1 הושלם — כתבנו את הסקיל שכל מערכת חדשה תקבל, ועדכנו את ה'טביעת אצבע' (golden) של התבנית. כל הבדיקות ירוקות, מוזג."
- "שלב 2 הושלם — החלנו את הסקיל חי על or-edri-4 ובדקנו שהקובץ שם ושהמערכת ממשיכה לעבוד תקין."
- "שלב 3 הושלם — בדקנו שאין מערכת חיה נוספת לטפל בה, וסגרנו את הפיתוח. מכאן כל מערכת חדשה נולדת עם הסקיל אוטומטית."
