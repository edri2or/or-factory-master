<!--
DEVPLAN — workspace-token-audit. מנוהל על-ידי /dev-stage. זיכרון הסוכן, לא חומר ל-Or.
-->
---
dev_name: התרעת-טוקן Google אוטומטית
slug: workspace-token-audit
opened: 2026-06-16
status: active
---

# תוכנית פיתוח — התרעת-טוקן Google אוטומטית

## מטרה

ב-2026-06-16 טוקן Google המשותף נשבר בשקט (Or שינה סיסמה → בוטלו טוקנים עם הרשאות Gmail),
וזה התגלה רק אחרי חקירה ארוכה. המטרה: **heartbeat יומי שבודק את הטוקן ושולח ל-Or טלגרם ברור
אחד עם התיקון המדויק** ברגע שהוא נשבר — להפוך שבירה שקטה ומבלבלת לתיקון של 2 דקות עם שלט.

> אין יכולת חדשה (audit מתוזמן מחלקים קיימים) → Step 0 של capability-first מדולג.
> לא-התנהגותי (אין n8n/router) → שער E2E לא רלוונטי. לא נוגע ב-`templates/system/**` → אין golden.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | workspace-token-audit.yml — probe יומי + טלגרם ברור בכשל + תיעוד + תיקון grep | in-progress | `.github/workflows/workspace-token-audit.yml`, `.github/workflows/deploy-mcp-server.yml`, `CLAUDE.md`, `docs/google-identities.md` |

---

### שלב 1 — ה-audit + ההתרעה

**Acceptance:**
- [ ] `workspace-token-audit.yml` חדש: schedule יומי + dispatch; מריץ `scripts/google-mcp-smoke.py`; בהצלחה → `factory.workspace_token.ok` (info), בכשל → טלגרם עברי עשיר + `factory.workspace_token.revoked` (info + action_required) דרך `scripts/emit-event.sh`; soft (exit 0).
- [ ] תוקן באג ה-`grep` של בדיקת ה-drift ב-`deploy-mcp-server.yml` (`grep -oE` סובלני-גרשיים).
- [ ] `CLAUDE.md` — שורת workflow חדשה; `docs/google-identities.md` — runbook לחידוש הטוקן.
- [ ] CI ירוק (shellcheck/yamllint). דיספטץ' ידני של ה-audit על הטוקן הבריא הנוכחי → ריצה ירוקה + `PASS list_gmail_labels` + `[event] ... factory.workspace_token.ok` בלוג, בלי טלגרם.

**הוכחה תפקודית (באותו שלב):** דיספטץ' של `workspace-token-audit.yml` → `get_workflow_run` success → הלוג מראה `PASS` ל-`list_gmail_labels` ו-`[event] name='factory.workspace_token.ok'` (מסלול ה-info, בלי טלגרם). מסלול-הכשל נבדק בקריאת-קוד (לא נשבר טוקן חי בכוונה).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הקוד + התיעוד נכתבו; ב-PR. ממתין ל-CI + דיספטץ' אימות.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- 2026-06-16: בונה התרעה אוטומטית — אם טוקן Google יישבר שוב, תקבל טלגרם ברור עם בדיוק מה לעשות, במקום שעות חקירה.
