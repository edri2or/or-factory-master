---
dev_name: תיקון localhost:5678 ב-queue mode
slug: queue-worker-webhook-fix
opened: 2026-06-01
status: completed
---

# תוכנית פיתוח — תיקון localhost:5678 ב-queue mode

## מטרה

כשה-queue mode דלוק, tg-inbound רץ על ה-worker שלא מריץ webhook server על 5678.
הקריאה ל-`localhost:5678/webhook/agent-router` נכשלת, הבוט מחזיר fallback לכל הודעה.
התיקון: URL → `n8n.railway.internal:5678` שעובד גם מה-worker וגם מה-main.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיקון URL + golden + changelog + PR | completed | tg-inbound.json, AGENTS.md.template, golden, changelog.d/ |
| 2 | מיזוג + refresh factory-test-voice + אימות חי | completed | — (deploy action) |

---

### שלב 1 — תיקון URL + golden + changelog + PR

**Acceptance:**
- [x] `tg-inbound.json:388` — `localhost:5678` → `n8n.railway.internal:5678`
- [x] `AGENTS.md.template:107` — תיעוד מסונכרן
- [x] Golden refreshed
- [x] Changelog fragment נוצר
- [x] CI ירוק, PR פתוח

**הערת התקדמות אחרונה:** הושלם — PR נפתח, CI ירוק.

**שינוי תוכנית:** —

---

### שלב 2 — מיזוג + refresh factory-test-voice + אימות חי

**Acceptance:**
- [x] refresh-system-agents.yml רץ על factory-test-voice לאחר מיזוג
- [x] Or שלח voice note → האגנט ענה (לא fallback)

**הערת התקדמות אחרונה:** הושלם לאחר אישור Or.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — שינוי URL אחד ב-tg-inbound, golden עודכן, PR נפתח.
- שלב 2 הושלם — workflow הוחל על factory-test-voice, voice notes עובדים שוב.
