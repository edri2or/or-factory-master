---
dev_name: לולאת תיקון אוטונומית לתקלות (OIL auto-fix)
slug: oil-autofix
opened: 2026-05-28
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — לולאת תיקון אוטונומית לתקלות (OIL auto-fix)

## מטרה

בניית "החצי השני" של מנגנון התקלות. היום המערכת מזהה תקלות ופותחת תיק ב-Linear (OIL),
אבל אין מי שמתקן — Or מתקן ידנית. הפיתוח הזה בונה סוכן אוטונומי שקורא תיק, חוקר את שורש
הבעיה, מכין תיקון קטן, ושולח ל-Or הודעת אישור אחת בטלגרם (✅/❌). בלחיצה אחת התיקון מיושם
(עם אימות בכל צעד) והתיק נסגר — בלי ש-Or נוגע בטרמינל. נבנה PR-אחד-בכל-פעם, עם עצירה
לאישור בכל גבול.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | חוקר קריאה-בלבד (workflow) | in-progress | `.github/workflows/oil-autofix-investigate.yml` |
| 2 | פעמון Linear + סינון רעש (triage) + רשת-ביטחון | pending | `services/mcp-server/src/*`, `.github/workflows/oil-autofix-reconcile.yml`, `deploy-mcp-server.yml` |
| 3 | הצעת תיקון כ-PR טיוטה | pending | `.github/workflows/oil-autofix-investigate.yml` |
| 4 | סביבת אישור + job יישום ממתין | pending | `.github/workflows/oil-autofix-investigate.yml` + Environment `oil-autofix` |
| 5 | גשר אישור טלגרם (✅/❌ → מיזוג) | pending | `services/mcp-server/src/*`, `deploy-mcp-server.yml` |
| 6 | אימות פוסט-תיקון + סגירת תיק | pending | `.github/workflows/oil-autofix-investigate.yml` |
| 7 | תיעוד (חריג מכוון ותחום) | pending | `docs/oil-autofix.md`, `CLAUDE.md`, `docs/roadmap.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — חוקר קריאה-בלבד (workflow)

**Acceptance:**
- [ ] `oil-autofix-investigate.yml` קיים: טריגרים `repository_dispatch:[oil-investigate]` + `workflow_dispatch(issue_id)`.
- [ ] מריץ `claude-code-action@v1` (מוצמד ל-SHA) ב-read-only בלבד (Read/Grep/Glob; חוסם Bash/Edit/Write/...).
- [ ] קורא את תיק ה-OIL + לוגי הריצה שנכשלה (soft-fail), מטפל בטקסט כ-untrusted.
- [ ] כותב אבחנה (סיווג + confidence + שורש) כתגובה ב-Linear; ללא קוד, ללא PR, ללא שינוי סטטוס.
- [ ] עובר את 4 בדיקות ה-CI; אומת ע"י `workflow_dispatch` על OIL-16 → תגובה הופיעה בתיק.

**הערת התקדמות אחרונה:** הקוד נכתב ונדחף; ה-PR פתוח. ממתין ל-CI ירוק, ואז מיזוג +
הרצה ידנית על OIL-16 לאימות (הרצת ה-Claude עולה מעט — אושר בתוכנית).

**שינוי תוכנית:** —

---

### שלב 2 — פעמון Linear + סינון רעש (triage) + רשת-ביטחון

**Acceptance:**
- [ ] endpoint `/linear-webhook` ב-MCP server מאמת חתימה (`Linear-Signature` HMAC על raw body) + timestamp.
- [ ] triage זול: כללים קודם (`factory.pilot.test`→test; `info`→maintenance **לפני** `action_required`; `action_required:false`→skip), ואז Haiku לעמומים.
- [ ] רק `actionable-bug`/`transient-infra` מפעילים `repository_dispatch` לחוקר.
- [ ] `oil-autofix-reconcile.yml` (cron ~6ש) כרשת-ביטחון לתיק שפוספס.
- [ ] אומת מקצה-לקצה על תקלת בדיקה; עדיין ללא כתיבה. מסנן את OIL-12/OIL-13.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — הצעת תיקון כ-PR טיוטה

**Acceptance:**
- [ ] בביטחון גבוה + תיקון קטן → נפתח PR טיוטה (תקרה ~100 שורות / ≤2 קבצים).
- [ ] חובה בדיקה שנכשלת-לפני/עוברת-אחרי; אסור לגעת ב-`.github/workflows/*`, WIF/IAM, secrets.
- [ ] הפרה כלשהי או ביטחון נמוך → אבחנה כ-comment + escalation, בלי PR.
- [ ] קישור ה-PR נכתב ב-comment ב-Linear; אומת ש-PR טיוטה עובר את 4 הבדיקות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — סביבת אישור + job יישום ממתין

**Acceptance:**
- [ ] Environment `oil-autofix` נוצר: required reviewer = App מאשר חדש (`oil-autofix-approver`), prevent-self-review ON, מוגבל ל-main.
- [ ] job `apply` ממתין על הסביבה אחרי פתיחת ה-PR.
- [ ] אומת שה-job אכן נעצר וממתין לאישור.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — גשר אישור טלגרם (✅/❌ → מיזוג)

**Acceptance:**
- [ ] `oil-autofix-approver` App רשום + 3 סודות ב-SM; סודות `oil-approval-register-secret` + `oil-approver-telegram-allowlist`.
- [ ] אחסון state ממתין (Firestore מועדף / GCS) + הרשאת IAM ל-runtime SA.
- [ ] `/oil-approval-register` (שולח הודעת טלגרם אחת ✅/❌ עם approval_id אטום) + `/telegram-webhook` (secret_token + allowlist על from.id + lookup + אישור pending_deployments בזהות ה-App).
- [ ] אומת חי: באג → טלגרם → ✅ → ה-PR ממוזג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — אימות פוסט-תיקון + סגירת תיק

**Acceptance:**
- [ ] אחרי מיזוג + CI ירוק → אימות (reproducer / re-dispatch בטוח של ה-workflow שנכשל).
- [ ] הצלחה → `issueUpdate(completed)` + comment סוגר. כשל → עצירה + comment + טלגרם "נכשל באימות", בלי לסגור.
- [ ] אומת חי את הלולאה המלאה = הגדרת הסיום של Or.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — תיעוד (חריג מכוון ותחום)

**Acceptance:**
- [ ] `docs/oil-autofix.md` חדש; רשומת CHANGELOG.
- [ ] עדכון `CLAUDE.md` + `docs/roadmap.md`: הלולאה מתועדת כחריג מכוון ותחום ל-"auto-chain / issue-based reporting שלא נבנים".

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- (מתמלא תוך כדי, כשכל שלב מסתיים ומאומת.)
