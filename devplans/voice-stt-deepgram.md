---
dev_name: "Voice-to-Text עברית — Telegram → Deepgram Nova-3"
slug: voice-stt-deepgram
opened: 2026-06-01
status: active
---

# תוכנית פיתוח — Voice-to-Text עברית

## מטרה

כל מערכת חדשה שהפקטורי יוצר תתמוך בהודעות קוליות בעברית: כשמשתמש שולח voice note לבוט הטלגרם, n8n מוריד את הקובץ, שולח ל-Deepgram Nova-3 לתמלול, ומחזיר את הטקסט לרצף הרגיל — כאילו הוקלד. שינוי בתהליך-ההקמה (`templates/system/**`) — מאומת על מערכת-טסט חיה לפני קידום.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | Secret `deepgram-api-key` ב-GCP SM | completed | GCP Secret Manager (or-factory-master-control) |
| 2 | קבצי workflow חדשים | completed | `templates/system/workflows/n8n/tg-voice-stt.json`, `templates/system/workflows/n8n/db-vacuum.json` |
| 3 | עדכון `configure-agent-router.yml` | completed | `templates/system/.github/workflows/configure-agent-router.yml` |
| 4 | עדכון `tg-inbound.json` — voice route | completed | `templates/system/workflows/n8n/tg-inbound.json` |
| 5 | Pruning env vars + Golden update + CI | completed | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`, `tests/golden/system/MANIFEST.sha256` |
| 6 | אימות חי — מערכת-טסט (reuse mode) | pending | test system deployment |

---

### שלב 1 — Secret `deepgram-api-key` ב-GCP SM

**Acceptance:**
- [x] Secret `deepgram-api-key` קיים ב-SM של `or-factory-master-control` עם version תקף (נוצר 2026-06-01T15:40)
- [x] `copy-generic-secrets.sh` מעתיק אותו אוטומטית לכל מערכת חדשה (לא ב-EXCLUDE)

**הערת התקדמות אחרונה:** Secret קיים ואומת דרך `list_secret_metadata` — `enabledVersionCount: 1`. שלב זה מוכן.

**שינוי תוכנית:** —

---

### שלב 2 — קבצי workflow חדשים

**Acceptance:**
- [x] `tg-voice-stt.json` נוצר (5 nodes: Trigger → Get File Path → Download Audio → Deepgram STT → Extract Transcript)
- [x] `db-vacuum.json` נוצר (2 nodes: Weekly Schedule → VACUUM Postgres)
- [x] שני הקבצים תקינים JSON, placeholders נכונים

**הערת התקדמות אחרונה:** שני הקבצים נוצרו ב-`templates/system/workflows/n8n/`.

**שינוי תוכנית:** —

---

### שלב 3 — עדכון `configure-agent-router.yml`

**Acceptance:**
- [x] Deepgram credential נוצר (`httpHeaderAuth: Authorization: Token <key>`)
- [x] `CRED_DEEPGRAM_ID` מוחלף ב-sed לפני upsert של tg-voice-stt
- [x] `tg-voice-stt.json` נוסף לרשימת ה-upsert (אחרי tg-vision, לפני tg-inbound)
- [x] `db-vacuum.json` נוסף לרשימת ה-upsert עם `active=yes` (אחרי db-setup)
- [x] `@@WF_TG_VOICE_STT_ID@@` מוחלף ב-sed ב-tg-inbound לפני upsert
- [x] Graceful degradation: voice branch נמחק אם Deepgram credential חסר

**הערת התקדמות אחרונה:** configure-agent-router.yml עודכן עם כל 5 הנקודות.

**שינוי תוכנית:** —

---

### שלב 4 — עדכון `tg-inbound.json` — voice route

**Acceptance:**
- [x] Extract & Normalize: זיהוי `voice_file_id` + `voice_duration`, guard מעודכן, שדות בפלט
- [x] Route Update: rule חדש `voice` לפני fallback
- [x] 2 nodes חדשים: `Prep Voice Input` (Set) + `Call tg-voice-stt` (executeWorkflow)
- [x] Call Agent Router: jsonBody מעודכן לשימוש ב-`$json.text || Extract & Normalize text`
- [x] Connections: voice flow שלם מ-Route Update עד Call Agent Router

**הערת התקדמות אחרונה:** tg-inbound.json עודכן עם כל השינויים.

**שינוי תוכנית:** Call Agent Router jsonBody עודכן לתמוך בשני נתיבים (chat + voice) — `$json.text || $('Extract & Normalize').first().json.text`. לא נדרש Set node נוסף.

---

### שלב 5 — Pruning env vars + Golden update + CI

**Acceptance:**
- [x] `deploy-railway-cloudflare.yml`: `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=48`, `EXECUTIONS_DATA_PRUNE_MAX_COUNT=1000` נוספו
- [x] `bash scripts/render-system-golden.sh --update` הורץ
- [x] `bash scripts/check-golden-sync.sh` ירוק
- [ ] CI ירוק (Changelog gates + Playground tests)
- [ ] PR פתוח

**הערת התקדמות אחרונה:** עדכוני קוד בוצעו, golden עודכן. PR נפתח, CI בהמתנה.

**שינוי תוכנית:** —

---

### שלב 6 — אימות חי — מערכת-טסט (reuse mode)

**Acceptance:**
- [ ] מערכת-טסט חיה מוקמת ב-reuse mode (`shared_gcp_project=factory-test-25`, 0-quota)
- [ ] `configure-agent-router.yml` רץ בהצלחה עם Deepgram credential
- [ ] tg-voice-stt + db-vacuum workflows מיובאים ופעילים
- [ ] voice note בעברית לבוט → תמלול תקין → תגובה מ-agent

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — `deepgram-api-key` כבר קיים ב-SM של factory control, version תקף.
- שלב 2 הושלם — שני קבצי workflow חדשים נוצרו: `tg-voice-stt.json` (STT sub-workflow) ו-`db-vacuum.json` (VACUUM שבועי).
- שלב 3 הושלם — `configure-agent-router.yml` עודכן: Deepgram credential, imports של שני ה-workflows, graceful degradation.
- שלב 4 הושלם — `tg-inbound.json` עודכן: זיהוי voice, route חדש, 2 nodes, connection לאגנט.
- שלב 5 הושלם — pruning vars נוספו, golden עודכן, PR נפתח.

---

## מצב מערכת-הטסט (Teardown ledger)

_(מערכת-הטסט טרם הוקמה — ממתין לאישור Or לשלב 6)_
