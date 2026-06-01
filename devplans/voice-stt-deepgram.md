---
dev_name: "Voice-to-Text עברית — Telegram → Deepgram Nova-3"
slug: voice-stt-deepgram
opened: 2026-06-01
status: completed
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
| 6 | אימות חי — מערכת-טסט (reuse mode) | completed | test system deployment |

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

**הערת התקדמות אחרונה:** configure-agent-router.yml עודכן עם כל 5 הנקודות. **תיקון (נתפס באימות החי, שלב 6):** בלוק יצירת ה-credential של Deepgram פנה ל-`${N8N_BASE}/rest/credentials` — משתנה שלא הוגדר אף פעם (השלב משתמש ב-`$BASE`). תחת `set -u` זה הפיל את כל השלב עם `N8N_BASE: unbound variable`. בנוסף הבלוק חרג מכל ה-credentials האחרים — `curl` גולמי עם אימות `X-N8N-API-KEY` מול endpoint של `/rest/` (שמאמת ב-cookie, לא ב-API key). תוקן: ה-POST עובר עכשיו דרך ה-helper המשותף `_napi POST "$BASE/rest/credentials"` בדיוק כמו Tavily/Railway/Postgres. golden רוענן.

**שינוי תוכנית:** הבלוק נכתב מחדש לתבנית האחידה (`_napi`) במקום `curl` גולמי — תיקון bug שנתפס רק כשהשלב רץ חי.

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
- [x] CI ירוק (Changelog gates + Playground tests)
- [x] PR #283 מוזג

**הערת התקדמות אחרונה:** PR #283 מוזג. כל 5 בדיקות CI ירוקות.

**שינוי תוכנית:** —

---

### שלב 6 — אימות חי — מערכת-טסט (reuse mode)

**Acceptance:**
- [x] מערכת-טסט חיה מוקמת ב-reuse mode (`shared_gcp_project=factory-test-25`, 0-quota) — `factory-test-voice`
- [x] `configure-agent-router.yml` רץ בהצלחה עם Deepgram credential — run 26775314038 על `factory-test-voice`
- [x] tg-voice-stt + db-vacuum workflows מיובאים ופעילים
- [x] voice note בעברית לבוט → תמלול תקין → תגובה מ-agent — אומת על-ידי Or (2 voice notes, אגנט הגיב בהתאם)

**הערת התקדמות אחרונה:** ריצה ראשונה על `factory-test-qmode7` תפסה באג אמיתי (`N8N_BASE: unbound variable`) — תוקן (ראה שלב 3). ריצה שנייה על `factory-test-voice` (run 26775314038) עברה בהצלחה: Deepgram credential `jqbRJZuh2fPT7LoN`, tg-voice-stt `QTqGfZMe4CokJhXv`, db-vacuum `ppVTP8buYy5LtN8e`, tg-inbound `GZOBU8SGe7Em5z78` — כולם PASS. healthz 200 OK. אימות round-trip קולי: Or שלח 2 voice notes בעברית, האגנט הגיב בהתאם — STT עברית עובד end-to-end.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — `deepgram-api-key` כבר קיים ב-SM של factory control, version תקף.
- שלב 2 הושלם — שני קבצי workflow חדשים נוצרו: `tg-voice-stt.json` (STT sub-workflow) ו-`db-vacuum.json` (VACUUM שבועי).
- שלב 3 הושלם — `configure-agent-router.yml` עודכן: Deepgram credential, imports של שני ה-workflows, graceful degradation.
- שלב 4 הושלם — `tg-inbound.json` עודכן: זיהוי voice, route חדש, 2 nodes, connection לאגנט.
- שלב 5 הושלם — pruning vars נוספו, golden עודכן, PR נפתח.
- שלב 6 הושלם — מערכת-טסט `factory-test-voice` הוקמה (reuse mode, factory-test-25). `configure-agent-router.yml` עבר בהצלחה: Deepgram credential נוצר, tg-voice-stt + db-vacuum מיובאים ופעילים, tg-inbound עם voice route מוכן. healthz 200 OK.
- ✅ אימות סופי הושלם — Or שלח 2 הודעות קוליות בעברית, האגנט הגיב כראוי. Voice-to-Text עברית עובד end-to-end על כל מערכת חדשה שהפקטורי יוצר.

---

## מצב מערכת-הטסט (Teardown ledger)

| מערכת | GCP | הוקמה | סטטוס |
|---|---|---|---|
| `factory-test-voice` | `factory-test-25` (reuse) | 2026-06-01 | פעילה — ממתינה לאימות קולי ולפירוק |

**להריץ לפירוק:** `decommission-test-system.yml` עם `system_name=factory-test-voice`, `shared_gcp_project=factory-test-25`.
