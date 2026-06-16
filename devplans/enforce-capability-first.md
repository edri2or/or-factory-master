---
dev_name: אכיפת capability-first (שלא יעקפו את המתודולוגיה)
slug: enforce-capability-first
opened: 2026-06-16
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 2 | שיניים: שער-CI שדורש Capability Card ל-workflow חדש | pending | `scripts/check-capability-card.sh` (חדש) + חיווט CI + fixtures |

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
- [ ] `scripts/check-capability-card.sh`: workflow n8n חדש לא-פטור תחת
      `templates/system/workflows/n8n/` חייב Capability Card (`docs/agent-specs/<name>.md` עם
      go/no-go) או רישום ב-`monitoring/capability-card-exempt.txt` ("אין יכולת-חוץ חדשה") —
      אחרת merge חסום. תאום ל-check-workflow-skill-pair / check-e2e-proof.
- [ ] חיווט ל-job CI (Changelog gates / Playground tests) + ל-pipeline-tests של מערכת.
- [ ] fixtures: עובר (יש כרטיס/פטור) + נכשל (אין).

**הוכחה תפקודית (באותו שלב):** הרצת הסקריפט על fixture עם כרטיס (PASS) ובלי (FAIL).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 ✅ הושלם: חיווטתי את capability-first לכל שערי-הכניסה (CLAUDE.md + dev-stage* כ-Step 0),
  כך שיכולת חדשה *חייבת* לעבור הוכחה-מחוץ-ל-n8n + פירוק לפני בנייה — גם בפקטורי. בדקתי בדיעבד
  (replay) שזה בדיוק מה שהיה עוצר את email-form-intake. השארים הסטטיים ירוקים. נשאר שלב 2
  (שער-CI שייתן "שיניים" לכלל).
