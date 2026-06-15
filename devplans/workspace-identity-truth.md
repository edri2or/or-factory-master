<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הזיכרון/המצפן של הסוכן. Or לא פותח אותו; הסוכן מסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: תיקון זהות חשבון ה-Workspace
slug: workspace-identity-truth
opened: 2026-06-15
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — תיקון זהות חשבון ה-Workspace

## מטרה

תוך כדי בדיקת יכולת-הכתיבה ל-Drive הוכחנו חי (בעלות על קובץ חדש) שהטוקן של ה-Workspace MCP
מאמת בפועל מול **`edri2or@gmail.com`** (החשבון האישי של Or) — ולא `edriorp38@or-infra.com`
כפי שתיעוד רב טוען. `edriorp38` הוא חשבון אמיתי, אבל הוא זהות ה-GCP/קונסול/אדמין — לא חשבון
ה**נתונים** של הסוכנים. המטרה: לתקן את כל ההצהרות השגויות בתיעוד (ובהערות-קוד) שיגידו את האמת,
**בלי לגעת בערכים פונקציונליים** (התווית/הפרמטר `edriorp38` הוא מפתח-אחזור — שינויו ישבור קוראים).
החלטת Or: להשאיר את הסוכנים על החשבון האישי (זו המטרה הסופית) + לשמור על השמירות — רק לתקן תיעוד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | אימות סופי (בעלות קובץ חדש) | completed | — (בדיקה חיה) |
| 2 | תיקון תיעוד+הערות (Tier 1) | completed | `docs/google-identities.md`, `CLAUDE.md`, `services/workspace-mcp/*`, `scripts/*` |
| 3 | אימות + קידום (PR → CI → מיזוג) | in-progress | `changelog.d/2026-06-15-workspace-identity-truth.md` |

> כל השלבים "לא-התנהגותי" — אין נגיעה ב-`workflows/n8n/*.json` או `configure-agent-router.yml`.
> תבניות-המערכת (AGENTS.md + ops-agent) נדחות (שערי golden+E2E) — מתועד כ-follow-up.

---

### שלב 1 — אימות סופי ✅

**Acceptance:**
- [x] קובץ חדש שנוצר דרך המחבר חוזר בבעלות `edri2or@gmail.com` (חד-משמעי — לקובץ חדש אין שיתופים).

**הוכחה תפקודית (באותו שלב):** בוצע חי בסשן המחבר — הבעלים = `edri2or@gmail.com`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. הטוקן מאמת כ-edri2or@gmail.com; התווית edriorp38 היא מפתח-אחזור בלבד.

**שינוי תוכנית:** —

---

### שלב 2 — תיקון תיעוד+הערות (Tier 1)

**Acceptance:**
- [x] כל הצהרת "חשבון-הנתונים = edriorp38" (פרוזה/הערות) תוקנה ל-`edri2or@gmail.com`, עם הבהרה
      ש-edriorp38 הוא מפתח-אחזור/פרמטר בלבד.
- [x] הטענה השגויה על "אכיפת token==label" הוסרה/תוקנה (התנהגות חיה מפריכה).
- [x] ערכים פונקציונליים (`WORKSPACE_GOOGLE_ACCOUNT_LABEL`, פרמטרי `user_google_email`, שם-קובץ-ההרשאה) **לא** השתנו (אומת ב-grep).
- [x] `docs/google-identities.md`, `CLAUDE.md`, `services/workspace-mcp/{entrypoint.sh,README.md}`,
      `scripts/render-mcp-service-yaml.sh`, `scripts/google-mcp-smoke.py`, `scripts/check-golden-sync.sh` — תוקנו (הערות/פרוזה).
- [x] follow-up לתבניות-המערכת תועד ב-`docs/google-identities.md` (Open flags).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד; `shellcheck`+`py_compile` ירוקים; `check-golden-sync.sh` עובר
(לוגיקה לא נגעה); grep מאשר שהערכים הפונקציונליים נשמרו = edriorp38.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. 7 קבצים תוקנו (פרוזה/הערות בלבד); כל ערך פונקציונלי נשמר;
follow-up לתבניות-המערכת תועד.

**שינוי תוכנית:** —

---

### שלב 3 — אימות + קידום

**Acceptance:**
- [ ] `changelog.d/2026-06-15-workspace-identity-truth.md` נוצר.
- [ ] PR פתוח; CI ירוק (Changelog, devplan, shellcheck+yamllint, secret-scan, golden-sync, Playground).
- [ ] golden-sync ירוק (templates/system/** לא נגעו; השער חוסם רק את `shared-google@`).
- [ ] מיזוג ל-`main` (Or-gated); סגירת התוכנית.

**הוכחה תפקודית (באותו שלב):** ההוכחה כבר בידינו (בדיקת הבעלות החיה); אין שינוי פונקציונלי לאמת מחדש.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — אישרנו חד-משמעית: המחבר עובד על ה-Drive האישי שלך (edri2or@gmail.com).
- שלב 2 הושלם — תיקנו את כל התיעוד שיגיד את האמת (החשבון האישי שלך), בלי לשבור שום ערך פונקציונלי.
