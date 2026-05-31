---
dev_name: בוט פר-מערכתי — פעולות-כתיבה מאושרות (HITL)
slug: hitl-write-actions
opened: 2026-05-31
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — בוט פר-מערכתי: פעולות-כתיבה מאושרות (HITL)

## מטרה

להרחיב את הבוט הפר-מערכתי (`unknown-agent` ב-n8n, שהפקטורי מתקין בכל מערכת) מ**קריאה-בלבד**
ליכולת **פעולות-כתיבה מאושרות**: להריץ/להפעיל אוטומציות ב-n8n ולהריץ workflows ב-GitHub —
כשכל פעולה עוברת אישור של Or בטלגרם (✅/❌) **לפני** ביצוע. הזרימה תמיד: בקשה → אישור → ביצוע.
ארכיטקטורה אסינכרונית state-free מגובת Postgres (ברוח ה-OIL loop), לא Send-and-Wait. הכול
templates תחת `templates/system/...` עם graceful degradation; provision-only (מערכות חדשות בלבד).
אין נגיעה ב-`agent-router` — נקודת ההזרקה היא `tg-inbound`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| A | סכמה — הרחבת `pending_actions` | completed | `templates/system/workflows/n8n/db-setup.json` |
| B | מבצע (executor) — n8n activate/deactivate | completed | `pending-actions-executor.json` (חדש) + `configure-agent-router.yml` |
| C | קליטת אישור — Switch על callback ב-tg-inbound | pending | `tg-inbound.json` |
| D | בקשה — כלי `request_write_action` + prompt | pending | `request-write-action.json` (חדש) + `unknown-agent.json` + `configure-agent-router.yml` |
| E | חוט GitHub — `workflow_dispatch` ב-executor | pending | `pending-actions-executor.json` + `configure-agent-router.yml` |
| F | תיעוד + הקשחה — docs, expiry cleanup, edge cases | pending | `docs/telegram-chat-bot.md` + `docs/roadmap.md` + cleanup cron |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב A — סכמה: הרחבת `pending_actions`

**Acceptance:**
- [x] כל העמודות החדשות נוספו כ-`ADD COLUMN IF NOT EXISTS` (אידמפוטנטי, לא שובר טבלה קיימת): `action_type, requester, approver, target_system, target_id, normalized_payload JSONB, human_summary, expires_at, approved_at, executed_at, error_record JSONB, idempotency_key`.
- [x] `idempotency_key` ייחודי דרך `CREATE UNIQUE INDEX IF NOT EXISTS` (אידמפוטנטי, מתיר NULL מרובים).
- [x] JSON של `db-setup.json` תקין (`jq`).
- [x] CI ירוק: Playground tests + pipeline-tests.

**הערת התקדמות אחרונה:** השלב מומש — נוספו 12 עמודות חדשות ל-`pending_actions` בדפוס `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (זהה לדפוס שכבר קיים ל-audit_log/spend_log/events), פלוס unique index ל-idempotency_key ו-index ל-expires_at (לתמיכה ב-cleanup העתידי ב-Stage F). JSON אומת ב-jq. ממתין לירוק CI ולאישור Or לפני Stage B.

**שינוי תוכנית:** —

---

### שלב B — מבצע (executor)

**Acceptance:**
- [x] `pending-actions-executor.json` חדש: קלט `{action_id}` (Validate Input מוודא int חיובי), נעילה אטומית `UPDATE pending_actions SET status='processing', approver='telegram', approved_at=now() WHERE id=… AND status='pending' RETURNING *`, Switch לפי `target_system` (n8n / github / unsupported), ענף n8n activate/deactivate (Public API `POST /api/v1/workflows/{id}/{activate|deactivate}`, `httpHeaderAuth`), עדכון `status`+`executed_at` (+`error_record` בכשל), והודעת ✅/❌ לטלגרם.
- [x] טיפול בשגיאות: `n8n API Call` עם `onError: continueErrorOutput` → ענף Build Failure → Mark Failed (`error_record::jsonb`) → Notify Failure. ענפי github/unsupported מנותבים גם הם ל-Build Failure ("עדיין לא נתמך" — github מיושם ב-Stage E).
- [x] התקנה ב-`configure-agent-router.yml` (section 5g) בדפוס `_upsert_wf` (לא-פעיל, subworkflow), gated על Postgres+n8n-API+Telegram, soft-fail. ה-id נלכד ל-`PENDING_EXECUTOR_ID` עבור `@@WF_PENDING_EXECUTOR_ID@@` (יצרוך אותו tg-inbound ב-Stage C).
- [x] JSON תקין (`jq`), yamllint+shellcheck ירוקים מקומית; actionlint ב-CI.
- [ ] CI ירוק: Playground tests + pipeline-tests.

**הערת התקדמות אחרונה:** השלב מומש. נבנה ה-subworkflow `pending-actions-executor.json` (11 צמתים): Validate→Lock(אטומי)→Switch→ענף n8n(HTTP activate/deactivate)→Build Success/Failure→Mark Done/Failed→Notify. נעילה אטומית בשאילתה אחת מונעת ביצוע כפול; כשל מנותב לרישום error_record + הודעת ❌. נוסף בלוק התקנה (5g) ב-configure-agent-router.yml לפני tg-inbound. ממתין לירוק CI ולאישור Or לפני Stage C.

**שינוי תוכנית:** —

---

### שלב C — קליטת אישור

**Acceptance:**
- [ ] ב-`tg-inbound.json` אחרי "Extract & Normalize" — Switch: `kind=='callback_query'` ו-`text` מתחיל ב-`app:`/`rej:` → אימות `from.id` מול allowlist (`@@CHAT_ID@@`) → `answerCallbackQuery` מיד + סגירת כפתורים → קריאה ל-executor (app) או עדכון ל-rejected (rej).
- [ ] הזרימה הקיימת (router) שלמה כשזו לא callback פעולה; agent-router ללא שינוי.
- [ ] JSON תקין + CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב D — בקשה

**Acceptance:**
- [ ] `request-write-action.json` חדש: קלט `{action_type, target_system, target_id, normalized_payload, human_summary}` → רושם שורת pending (status='pending', expires_at=now()+2h, idempotency_key) → שולח כפתורי ✅/❌ (`app:<id>`/`rej:<id>`, ≤64B) ל-Or.
- [ ] כלי `request_write_action` ב-`unknown-agent.json` (toolWorkflow, `@@WF_REQUEST_WRITE_ID@@`) + עדכון system prompt מ-READ-ONLY לכתיבה-מאושרת.
- [ ] התקנה + graceful-degradation strip בחסר credential; JSON תקין + CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב E — חוט GitHub

**Acceptance:**
- [ ] ענף GitHub ב-executor: JWT→repoScopedToken (`repository_ids`)→`POST /actions/workflows/{file}/dispatches`, inputs כ-strings (`.toString()`, ≤25), ref=`main`.
- [ ] אימות מקדים: App של מערכת היעד מחזיק `actions:write` (אחרת App re-register).
- [ ] JSON תקין + CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב F — תיעוד + הקשחה

**Acceptance:**
- [ ] `docs/telegram-chat-bot.md` §6 + `docs/roadmap.md` Phase F מעודכנים.
- [ ] expiry cleanup — cron בדפוס spend-track לשורות pending שפג תוקפן.
- [ ] edge cases: לחיצה כפולה (נעילה אטומית), callback פג-תוקף.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב A הושלם — הכנּתי את ה"טבלה" שבה כל בקשת-פעולה תירשם לפני שתבוצע: הוספתי לה את כל השדות שצריך (איזו פעולה, על מה, סיכום קצר בעברית, מתי פגה, מי אישר, ומפתח שמונע ביצוע כפול). שינוי בטוח שלא נגע בשום דבר קיים.
- שלב B הושלם — בניתי את ה"זרוע המבצעת": תהליך קטן שמקבל בקשה שאישרת, נועל אותה כך שלא תוכל לרוץ פעמיים בטעות, מפעיל/מכבה את האוטומציה ב-n8n בפועל, ואז שולח לך הודעה אם הצליח (✅) או נכשל (❌). חיבור GitHub יגיע בשלב מאוחר יותר. עדיין לא מחובר לכפתורי טלגרם — זה השלב הבא.
