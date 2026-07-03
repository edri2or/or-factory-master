---
dev_name: כפתור בקשת-הרשאות מהמערכת אל ה-factory
slug: system-resource-request-frontdoor
opened: 2026-07-03
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — כפתור בקשת-הרשאות מהמערכת אל ה-factory

## מטרה

לתת ל-session שרץ בתוך מערכת שה-factory ייצר "כפתור" נגיש לבקש מה-factory לפתוח
הרשאה — סוד חדש או תפקיד IAM — בשער אנושי (✅ בטלגרם). הצינור המלא כבר קיים ומוכח
(`docs/system-resource-requests.md`); מה שחסר היה נקודת-כניסה נגישה מצד המערכת. מוסיפים
פקודת slash אחת (`/request-factory-resource`) שעוטפת את `emit-event.sh`, כך ש-Or לא צריך
יותר לפתוח session נפרד מול ה-factory כדי לפתוח הרשאה.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הפקודה + מראה + golden | completed | `.claude/commands/request-factory-resource.md`, `templates/system/.claude/commands/…`, `tests/golden/system/MANIFEST.sha256` |
| 2 | עדכון תיעוד | completed | `docs/system-resource-requests.md` |
| 3 | Backfill למערכות קיימות + הוכחת E2E חיה | pending | dispatch של `refresh-system-agents.yml` (ללא שינוי קוד) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הפקודה + מראה + golden

**Acceptance:**
- [x] `.claude/commands/request-factory-resource.md` עם `audience: shared`, triggers בעברית,
  ולידציה מקומית שמשקפת מילה-במילה את `scripts/validate-system-request.sh`.
- [x] המראה `templates/system/.claude/commands/…` נוצרה byte-identical ע"י `sync-skills-mirror.sh`.
- [x] ה-golden רוענן (`check-system-golden.sh --update`) — שורת hash אחת נוספה.
- [x] כל שערי ה-CI המקומיים ירוקים: `check-skills-mirror`, `check-system-golden`,
  `check-workflow-skill-pair` (אין התנגשות-שם).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (פקודה = טקסט, אין התנהגות רצה). אימות עקיף:
`validate-system-request.sh` הוחל ידנית על שם תקין (`supadata-api-key` → allow) ועל שם אסור
(`or-broker-key` → refuse), לוודא שכללי הוולידציה המקומית שכתבתי בפקודה תואמים לשער.

**הוכחת E2E (artifact):** לא-התנהגותי (אין שינוי ב-`workflows/n8n/*.json` או `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם — הפקודה, המראה וה-golden נכתבו; כל השערים המקומיים ירוקים.

**שינוי תוכנית:** —

---

### שלב 2 — עדכון תיעוד

**Acceptance:**
- [x] `docs/system-resource-requests.md` כבר לא אומר "system side is documentation-only" —
  מתועד שהכפתור (`/request-factory-resource`) קיים כנקודת-כניסה.
- [x] מספר התפקידים המותרים נשאר "8" עקבי עם `validate-system-request.sh` (למניעת `check-doc-facts`).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — התיעוד מצביע כעת על הכפתור החדש.

**שינוי תוכנית:** —

---

### שלב 3 — Backfill למערכות קיימות + הוכחת E2E חיה

**Acceptance:**
- [ ] אחרי merge ל-main: מניית המערכות החיות (`list_all_systems_inventory`), אישור הרשימה עם Or,
  ואז `refresh-system-agents.yml` לכל מערכת עם `paths=.claude/commands/request-factory-resource.md`.
- [ ] הוכחה חיה על `or-edri-4` (factory-test-21): בקשת `secret` דרך הפקודה → כרטיס Linear → כרטיס
  טלגרם → ✅ של Or → `secretAccessor` נחת על `deploy-sa`+`runtime-sa` (אימות ב-`gcloud secrets get-iam-policy`).

**הוכחה תפקודית (באותו שלב):** בקשה אמיתית מ-session על `or-edri-4`, ומעקב עד שההענקה נחתה
בפרויקט (read-only `gcloud secrets describe` + `get-iam-policy`). כולל הוכחת-סירוב (שם שמור → נחסם
לפני ה-emit). זהו השלב שמצריך אישור-עלות/scope מ-Or (dispatch של workflow) — נעצר בגבול לפניו.

**הוכחת E2E (artifact):** לא-התנהגותי (הפקודה אינה קובץ-התנהגות של הבוט; ה-backfill מעביר קובץ `.md`,
לא `workflows/n8n`).

**הערת התקדמות אחרונה:** ממתין ל-merge ולאישור Or להריץ את ה-backfill.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — בניתי את הכפתור: פקודה אחת (`/request-factory-resource`) שמתוך כל מערכת שולחת
  בקשה מסודרת ל-factory. כל מערכת חדשה תקבל אותה אוטומטית.
- שלב 2 הושלם — עדכנתי את התיעוד כך שידע שהכפתור קיים.
