---
dev_name: ביטול "מספר 1" בתבנית-המערכת (מערכות עתידיות)
slug: retire-number-one-system-template
opened: 2026-07-17
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — ביטול "מספר 1" בתבנית-המערכת

## מטרה

חבילה F של ביטול "מספר 1": להחיל את אותו מסגור על **תבנית-המערכת** של המפעל, כדי שמערכות
**עתידיות** ייוולדו בלי התווית "מספר 1". זה משלים את PR #550 ב-or-aios (שעדכן רק את or-aios
עצמו — אין רטרו-פרופגציה). תיעוד/סקריפט בלבד; אפס יכולת חדשה, אפס התנהגות-בוט, אפס E2E.

## מיקום (Placement)

- **מחלקות**: general / infrastructure (תבנית-מערכת + סקריפט-פיגום).
- **מסלול**: `light` — תיעוד + שורת-echo בסקריפט; לא נוגע ב-n8n/deploy/provision-logic.
- **קיים-דומה?**: כן — מקביל ל-or-aios (docs/adr/0014 + localization-boundary). כאן בתבנית.
- **או `unplaced`**: —

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| F1 | ניסוח-מחדש של language-boundary.md | completed | templates/system/docs/language-boundary.md |
| F2 | ניסוח-מחדש של ה-session hook הנשלח | completed | scripts/language-session-start-hook.sh |
| F3 | רענון הגולדן | completed | tests/golden/system/** |

> כל השלבים תוכן/סקריפט בלבד — **לא-התנהגותי**. אין קבצי-n8n/`configure-agent-router.yml` בדיף,
> כך ששער ה-E2E ואימות חי על `or-edri-4` אינם נדרשים (per `/dev-stage-factory`).

---

### שלב F1 — language-boundary.md

**Acceptance:**
- [x] כל 8 אזכורי "Number 1" ב-`templates/system/docs/language-boundary.md` מנוסחים כ"the coordinator";
      המשמעות (single-coordinator broker, הקצה = קול-יחיד) נשמרת.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — הגולדן מתרענן, `check-system-golden` + `check-golden-sync` ירוקים.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם.

**שינוי תוכנית:** התיקון-מהמחקר — `AGENTS.md.template` **לא** נגעו בו (אין בו "#1"; ה-Purpose הוא
`${SYSTEM_PURPOSE}`), כך שעוגן ה-fact-check ב-AGENTS.md.template:167 לא נגע.

---

### שלב F2 — session hook הנשלח למערכות

**Acceptance:**
- [x] `scripts/language-session-start-hook.sh:25` (מועתק לכל מערכת חדשה ע"י provision-system.yml)
      מנוסח כ"The edge is the coordinator (this session)".

**הוכחה תפקודית (באותו שלב):** `shellcheck --severity=error` עובר (שינוי מחרוזת-echo בלבד).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם.

**שינוי תוכנית:** —

---

### שלב F3 — רענון הגולדן

**Acceptance:**
- [x] `bash scripts/check-system-golden.sh --update` הורץ; `tests/golden/system/MANIFEST.sha256`
      התעדכן (ה-hash של docs/language-boundary.md); `check-golden-sync` (path-coupling) מסופק.

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-system-golden.sh` ירוק אחרי הרענון.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- חבילה F הושלמה — עדכנתי את **תבנית-המערכת** של המפעל (מסמך גבול-השפה + סקריפט-הפתיחה שנשלח
  לכל מערכת חדשה) כך שמערכות עתידיות ייוולדו בלי "מספר 1", ורעננתי את קובץ-הגולדן. תיעוד בלבד.
