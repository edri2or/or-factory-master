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
(`docs/system-resource-requests.md`); מה שחסר היה נקודת-כניסה נגישה מצד המערכת.

**גילוי מהוכחה חיה על or-edri-4 (v1 → v1.1):** הגרסה הראשונה הריצה את `emit-event.sh`
**ישירות** מהסשן. אבל סשן צ'אט אינטראקטיבי (ב-web) **אין לו קרדנציאלס של GCP** (WIF עובד
רק בתוך GitHub Actions), אז ה-emit לא הצליח לקרוא את סודות ה-Linear/Telegram — הבקשה לא
"יצאה מהדלת" (שום נזק; פשוט לא הגיעה). התיקון: המערכת מקבלת **workflow שליח**
(`request-factory-resource.yml`) שרץ תחת WIF (deploy-sa), והפקודה רק **מריצה אותו** (קריאת
GitHub רגילה, בלי קרדנציאלס) — ואז ה-emit יוצא מסביבה מורשית ובאמת מגיע כרטיס טלגרם ל-Or.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הפקודה + מראה + golden (v1) | completed | `.claude/commands/request-factory-resource.md`, המראה, `tests/golden/system/MANIFEST.sha256` |
| 2 | עדכון תיעוד | completed | `docs/system-resource-requests.md` |
| 3 | Backfill + הוכחה חיה — **גילה את פער הסשן-בלי-קרדנציאלס** | completed | dispatch של `refresh-system-agents.yml` על or-edri-4 (ירוק) |
| 4 | תיקון v1.1: workflow שליח + הפקודה מריצה אותו | in-progress | `templates/system/.github/workflows/request-factory-resource.yml`, הפקודה (נכתבה מחדש), המראה, golden, doc |
| 5 | Backfill v1.1 לכל המערכות + הוכחה חיה מלאה (כרטיס טלגרם אמיתי) | pending | dispatch של `refresh-system-agents.yml` (workflow+פקודה) |

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

### שלב 3 — Backfill + הוכחה חיה (גילה את פער הסשן)

**Acceptance:**
- [x] `refresh-system-agents.yml` הורץ על `or-edri-4` עם `paths=.claude/commands/request-factory-resource.md` — ריצה ירוקה (run 28630291070), הפקודה נחתה ב-or-edri-4.
- [x] הוכחה חיה מסשן or-edri-4 חשפה: הפקודה הריצה `emit-event.sh` אך ה-emit נכשל כי לסשן אין קרדנציאלס GCP → אין כרטיס. שום דבר לא נוצר.

**הוכחה תפקודית (באותו שלב):** הסבב החי על or-edri-4 הוא ההוכחה — והוא זה שחשף את הפער.
המסקנה: emit ישיר מהסשן לא עובד; צריך סביבה מורשית (workflow). זה הזין את שלב 4.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — ה-backfill רץ ירוק, וההוכחה החיה חשפה את פער הקרדנציאלס.

**שינוי תוכנית:** גילינו ש-v1 לא עובד מסשן אינטראקטיבי → פיצול לשלב 4 (תיקון) + שלב 5 (backfill v1.1).

---

### שלב 4 — תיקון v1.1: workflow שליח + הפקודה מריצה אותו

**Acceptance:**
- [x] `templates/system/.github/workflows/request-factory-resource.yml` — workflow שליח: `workflow_dispatch` עם inputs (request_type/secret_name/role/reason), auth WIF כ-deploy-sa, מריץ `scripts/emit-event.sh`. `permissions: {}` + job עם `contents:read`+`id-token:write`, נעול ל-`main`.
- [x] הפקודה נכתבה מחדש: במקום להריץ emit מקומית — **מריצה את ה-workflow** (GitHub MCP `actions_run_trigger` / `gh workflow run`), עם fallback לקליק אחד ב-Actions UI.
- [x] מראה + golden רועננו; `yamllint`, `check-skills-mirror`, `check-system-golden`, `check-golden-sync`, `check-watchdog-registry` — ירוקים.

**הוכחה תפקודית (באותו שלב):** תוכן/צנרת. אימות: `yamllint` נקי על ה-workflow; ה-golden כולל אותו (184 קבצים); הפקודה מצביעה על ה-workflow הנכון. ההוכחה החיה המלאה היא שלב 5.

**הוכחת E2E (artifact):** לא-התנהגותי (workflow תשתית + קובץ פקודה; לא `workflows/n8n`).

**הערת התקדמות אחרונה:** נכתב; ממתין למיזוג ואז לשלב 5.

**שינוי תוכנית:** —

---

### שלב 5 — Backfill v1.1 לכל המערכות + הוכחה חיה מלאה

**Acceptance:**
- [ ] אחרי merge: `refresh-system-agents.yml` לכל מערכת קיימת עם `paths=".github/workflows/request-factory-resource.yml,.claude/commands/request-factory-resource.md"` (רשימת המערכות באישור Or).
- [ ] הוכחה חיה מלאה על `or-edri-4`: הרצת ה-workflow (מסשן or-edri-4 או dispatch) → **כרטיס טלגרם אמיתי אצל Or** → ✅ → `secretAccessor` נחת על `deploy-sa`+`runtime-sa` (אימות read-only).

**הוכחה תפקודית (באותו שלב):** סבב אמיתי מקצה-לקצה עם כרטיס טלגרם ואישור Or, ואז אימות ההענקה. זהו השלב שמצריך אישור Or (dispatch + אישור טלגרם) — נעצר בגבול.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ממתין למיזוג של שלב 4 ולאישור Or.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1–2 הושלמו — בניתי את הכפתור (`/request-factory-resource`) ועדכנתי תיעוד.
- שלב 3 הושלם — הפעלתי על or-edri-4; ההוכחה החיה חשפה שהכפתור לא עובד מסשן בלי מפתחות ל-GCP.
- שלב 4 (בתהליך) — התיקון: הוספתי "שליח" (workflow ב-CI של המערכת שמחזיק את המפתחות), והכפתור עכשיו רק מפעיל אותו — כך שהבקשה באמת יוצאת ומגיע כרטיס טלגרם.
