---
dev_name: סקיל "operate-this-system" אוטומטי לכל מערכת
slug: system-operate-skill
opened: 2026-06-15
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — סקיל "operate-this-system" אוטומטי לכל מערכת

## מטרה

כל מערכת ש-or-factory-master מקים תיוולד עם סקיל Claude ייעודי
(`.claude/skills/operate-this-system/SKILL.md`) שמאפשר ל-Claude Code שעובד ב-repo של המערכת
לזהות מיד שזו מערכת-מפעל ולדעת לאן לפנות (ל-`AGENTS.md`) כדי לתפעל אותה. שינוי בתהליך-ההקמה,
לכן מוכיחים אותו חי על מערכת-הניסוי הקבועה or-edri-4 לפני שמקבעים בתבנית. מערכות עתידיות
מקבלות אוטומטית; מערכות קיימות מקבלות ב-backfill.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כתיבת הסקיל הסטטי + רענון golden (PR אחד ל-main) | completed | `templates/system/.claude/skills/operate-this-system/SKILL.md`, `tests/golden/system/**`, `devplans/system-operate-skill.md`, `changelog.d/2026-06-15-system-operate-skill.md` |
| 2 | קיבוע בתבנית + הוכחה חיה על or-edri-4 (backfill) | pending | (תפעולי — `refresh-system-agents.yml` על or-edri-4) |
| 3 | סריקת מערכות-חיות נוספות + סגירה | pending | `devplans/system-operate-skill.md` |

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
- [ ] נוצר `templates/system/.claude/skills/operate-this-system/SKILL.md` — שם קובץ **רישי**,
      frontmatter תקין (`name: operate-this-system` = שם התיקייה, `description` ≤1024 תווים),
      **בלי placeholders** (`${...}` או `@@TOKEN@@`), בקול ובפורמט של הסקילים האחים.
- [ ] ה-golden עודכן (`bash scripts/check-system-golden.sh --update`) ונכלל באותו PR; הקובץ
      החדש מופיע ב-`tests/golden/system/MANIFEST.sha256` בנתיב המדויק.
- [ ] חמשת שערי ה-CI ירוקים: Playground tests (golden) · Changelog gates (golden-sync,
      changelog, devplan) · shellcheck+yamllint · secret-scan · supply-chain.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (לא-התנהגותי). הוכח ע"י: הקובץ החדש מופיע ב-MANIFEST
בנתיב `\.claude/skills/operate-this-system/SKILL.md`; שם הקובץ רישי; ה-frontmatter נפרס
(`name == operate-this-system`, `description` ≤1024); אין `${`/`@@` בקובץ; העותק ב-golden
זהה-בייט למקור (אין placeholders → זהה).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הסקיל נכתב, ה-golden רוענן, נבדק מקומית. ממתין ל-CI ירוק ולאישור Or למיזוג.

**שינוי תוכנית:** —

---

### שלב 2 — קיבוע בתבנית + הוכחה חיה על or-edri-4

**Acceptance:**
- [ ] PR שלב 1 מוזג ל-main (קיבוע בתבנית).
- [ ] `refresh-system-agents.yml` הורץ עם `system_name=or-edri-4`,
      `paths=.claude/skills/operate-this-system`, `post_merge_workflow=` (ריק) — נצפה לטרמינל success.
- [ ] אימות חי: הקובץ קיים ב-`edri2or/or-edri-4` בנתיב הנכון (רישי, זהה-בייט);
      `/healthz` של `n8n-or-edri-4.or-infra.com` מחזיר 2xx (אין נזק נלווה).

**הוכחה תפקודית (באותו שלב):** הקובץ נוכח verbatim ב-repo של מערכת חיה אמיתית (or-edri-4)
+ המערכת בריאה (probe_endpoint על /healthz).

**הוכחת E2E (artifact):** לא-התנהגותי (סקיל לא נוגע בקבצי-התנהגות; שער ה-E2E לא חל).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — סריקת מערכות-חיות נוספות + סגירה

**Acceptance:**
- [ ] נסרקו ריפואי `edri2or/*`; כל מערכת חיה (deployed) נוספת קיבלה backfill באותו אופן.
      לפי המלאי החי כיום — or-edri-4 היא המערכת היחידה הפרוסה, אז זו סריקה ריקה צפויה.
- [ ] סגירת הפיתוח: `status: completed` + יומן ל-Or, ב-PR docs-only נפרד.

**הוכחה תפקודית (באותו שלב):** הקובץ נוכח בכל מערכת חיה שסומנה ל-backfill (כיום: כבר אומת בשלב 2).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- "שלב 1 הושלם — כתבנו את הסקיל שכל מערכת חדשה תקבל, ועדכנו את ה'טביעת אצבע' (golden) של התבנית."
