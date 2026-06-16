---
dev_name: אכיפת capability-first (שלא יעקפו את המתודולוגיה)
slug: enforce-capability-first
opened: 2026-06-16
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — אכיפת capability-first (שלא יעקפו את המתודולוגיה)

## מטרה

המתודולוגיה capability-first (קודם להוכיח יכולת גולמית מחוץ ל-n8n + go/no-go, אז לפרק
לסוכנים, אז לבנות בוטום-אפ) קיימת אבל היא **opt-in** — שום דבר לא מכריח אותה, ושער-הכניסה
`/dev-stage-factory` אפס-קשר אליה. לכן הפיתוח email-form-intake נבנה כמונוליט ועקף אותה
(בדיוק האנטי-דפוס "סוכן הטפסים" שבגללו נבנתה). המטרה: להפוך אותה ל**בלתי-עקיפה** לכל יכולת
חדשה, **גם בשכבת הפקטורי** — בלי over-build. (רטרוספקטיבה מלאה: ראה Context בקובץ-התוכנית
`/root/.claude/plans/...` ובפתק ה-changelog.)

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | וו-ניתוב: capability-first חובה בכל שער-כניסה | completed | `CLAUDE.md`, `.claude/commands/dev-stage-factory.md`, `.claude/commands/dev-stage.md` (+מראה `templates/system/.claude/commands/dev-stage.md`), `tests/golden/system/MANIFEST.sha256` |
| 2 | שיניים: שער-CI שדורש Capability Card ל-workflow חדש | completed | `scripts/check-capability-card.sh` (חדש), `monitoring/capability-card-exempt.txt` (חדש), `docs/capability-cards/README.md` (חדש), `.github/workflows/playground-tests.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב 1 — "replay" שמראה שהניתוב היה תופס את email-form-intake. שלב 2 —
> סקריפט עם fixture עובר (יש כרטיס/פטור) + נכשל (אין). לא רק "CI ירוק".

---

### שלב 1 — וו-ניתוב: capability-first חובה בכל שער-כניסה

**Acceptance:**
- [x] `CLAUDE.md`: כלל מפורש — לפני בניית יכולת חדשה (verb: קריאה/מילוי/חילוץ/שליחה/פרסור),
      כתת-סוכן או workflow עצמאי, חובה `/prove-capability` (הוכחה מחוץ ל-n8n + go/no-go) +
      פירוק `/build-agent` — **גם בפקטורי** (templates/system/**). dev-stage* עוטפים, לא מחליפים.
- [x] `/dev-stage-factory` + `/dev-stage`: `docs/capability-first.md` ב-"Context — Read First" +
      "שלב 0" שמכריח capability-first אם הפיתוח מוסיף יכולת.
- [x] מראה ל-`templates/system/.claude/commands/dev-stage.md` (sync-skills-mirror) + golden מרוענן.
- [x] שערים סטטיים ירוקים (skills-mirror, golden, golden-sync).

**הוכחה תפקודית (באותו שלב):** "replay" — קריאה חוזרת של ה-flow של email-form-intake מול
ה-CLAUDE.md/dev-stage* החדשים: הניתוב היה מכריח `/prove-capability` קודם (כן). תוכן+אימות סטטי.

**הוכחת E2E (artifact):** לא-התנהגותי (docs + routing; אין שינוי בקבצי-בוט workflows/n8n).

**הערת התקדמות אחרונה:** ✅ הושלם. שלוש עריכות-ניתוב נכנסו (`CLAUDE.md` "How to work" + Step-0
ב-`dev-stage-factory.md` ו-`dev-stage.md`), המראה ל-`templates/system` סונכרן והזהב רוענן.
**Replay מאמת:** הפעלים של email-form-intake (read/extract/send) כולם ברשימת-הפעלים של הכלל,
כך ש-Step 0 היה עוצר ומכריח `/prove-capability` לפני בנייה. שערים סטטיים ירוקים מקומית
(skills-mirror, system-golden, golden-sync). content-only — אין קבצי-בוט בשינוי, אז Playground/E2E
לא רלוונטיים.

**שינוי תוכנית:** —

---

### שלב 2 — שיניים: שער-CI שדורש Capability Card ל-workflow חדש

**Acceptance:**
- [x] `scripts/check-capability-card.sh`: workflow n8n לא-פטור תחת `templates/system/workflows/n8n/`
      חייב Capability Card ב-`docs/capability-cards/<name>.md` עם `verdict: go|partial` (no-go/חסר →
      כשל), או רישום ב-`monitoring/capability-card-exempt.txt`. תאום-מבנה ל-check-workflow-skill-pair
      (full-scan + exempt לפי basename). shellcheck נקי.
- [x] `monitoring/capability-card-exempt.txt`: 25 ה-workflows הקיימים grandfathered (baseline) + הסבר
      שערך-חדש דורש נימוק. `docs/capability-cards/README.md`: פורמט הכרטיס + שורת verdict + קישור §0.
- [x] חיווט ל-job "Playground tests" (`.github/workflows/playground-tests.yml`) מיד אחרי שער ה-skill-pair.
      yamllint נקי.
- [x] fixtures (3-way): PASS על ה-mould, FAIL על workflow חדש בלי כרטיס, PASS עם כרטיס go (+bonus no-go→FAIL).

**הוכחה תפקודית (באותו שלב):** הורצו 4 הרצות: (1) על ה-mould האמיתי → PASS exit 0 (25 grandfathered,
0 לא-פטורים — no-op היום, נדלק על ה-workflow החדש הבא); (2) WF_DIR זמני עם `prove-fail-cap.json` בלי
כרטיס/פטור → FAIL exit 1; (3) אותו temp עם כרטיס `verdict: go` → PASS exit 0; (bonus) כרטיס `verdict:
no-go` → FAIL exit 1. shellcheck + yamllint נקיים.

**הוכחת E2E (artifact):** לא-התנהגותי (factory-only gate; אין שינוי בקבצי-בוט workflows/n8n).

**הערת התקדמות אחרונה:** ✅ הושלם. השער נכתב כתאום-מבנה ל-check-workflow-skill-pair (full-scan + exempt
basename), בהיקף factory-only על ה-mould. 4 הרצות-הוכחה עברו (PASS/FAIL/PASS/FAIL כצפוי). אין נגיעה
ב-`templates/system/**` → אין golden/mirror/golden-sync.

**שינוי תוכנית:** מול ה-Acceptance המקורי — (1) מיקום הכרטיס `docs/agent-specs/`→`docs/capability-cards/`
(התיישרות עם הוועקבולרי הקיים של "Capability Card" §0; `docs/agent-specs/` לא קיים). (2) היקף: ירד
מ"+pipeline-tests מערכת" ל-**factory-only-MVP** — הכשל המוכח היה פיתוח-פקטורי; שילוח-למערכות מוסיף שטח
למקרה נדיר שכבר מכוסה ע"י המסמכים/סקילים הנשלחים. **נדחה במפורש, לא נזרק** (תועד ב-README). זה עצמו
"לא over-build" — הלקח של הפיתוח הזה.

---

## יומן ל-Or (עברית)

- שלב 1 ✅ הושלם: חיווטתי את capability-first לכל שערי-הכניסה (CLAUDE.md + dev-stage* כ-Step 0),
  כך שיכולת חדשה *חייבת* לעבור הוכחה-מחוץ-ל-n8n + פירוק לפני בנייה — גם בפקטורי. בדקתי בדיעבד
  (replay) שזה בדיוק מה שהיה עוצר את email-form-intake. השארים הסטטיים ירוקים. נשאר שלב 2
  (שער-CI שייתן "שיניים" לכלל).
- שלב 2 ✅ הושלם: בניתי שער-CI (`check-capability-card.sh`) שחוסם הוספת workflow-יכולת חדש
  בלי "כרטיס יכולת" מוכח (go/partial). גיליתי במחקר שכבר היה תשתית capability-first (המתודולוגיה
  עצמה) — מה שחסר היה רק ה"שיניים", וזה מה שהוספתי (לא כפילות). הוכחתי שהשער באמת חוסם: 4 הרצות
  (עובר/נכשל/עובר/נכשל כצפוי). היקף מינימלי — factory בלבד; שילוח-למערכות נדחה במכוון.
- **הפיתוח נסגר (`status: completed`)** — שני השלבים הושלמו ומוזגים ל-main (PR #482, כל השערים
  ירוקים). capability-first כבר לא ניתן-לעקיפה: כלל-ניתוב בכל שער-כניסה + שער-CI עם שיניים.
  ניקוי email-form-intake מ-or-edri-4 (המערכת החיה) מטופל בנפרד כפעולת-תיקון חד-פעמית.
