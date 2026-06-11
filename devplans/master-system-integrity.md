<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו;
הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
פיתוח בתהליך-הקמה: מוכח על מערכת חיה (or-edri-4 הצמודה + מערכת-טסט לידה) לפני קידום.
-->
---
dev_name: שלמות-מערכת מקצה-לקצה — כל פיתוח באמת עובד ב-or-edri-4 ומוטמע בפקטורי לכל מערכת חדשה
slug: master-system-integrity
opened: 2026-06-11
status: active
---

# Master Dev Plan — שלמות-מערכת מקצה-לקצה

## הגדרת "סיום" (כפולה, or-edri-4 במרכז)
or-edri-4 = הריפו הצמוד; כל תיקון וכל הוכחה עוברים דרכה. לא סיימנו עד שלכל פיתוח בהיקף:
1. **עובד באמת** — מוכח חי ב-or-edri-4 (הוכחה תפקודית, לא ✅ של job).
2. **מוטמע בפקטורי** — ב-`templates/system/**`/נתיב provision-configure-deploy, golden מרוענן, ב-main.

ההיקף = **כל** פער (תפקודי + מודעות-עצמית). חוק-העל: **ירוק ≠ עובד** — וגם **WARN ≠ אמת** (ראה ממצא A למטה).

## מטרה
פיתוחים "מוכחים" אך לא תמיד באמת עובדים על מערכת חיה; ה-CI הירוק (ולעיתים ה-WARN) מטעה. or-edri-4 (מערכת ה-adopt האמיתית הראשונה, 2026-06-11) היא המקרה החי שעליו מתקנים ומוכיחים.

## שלבים
| # | שלב | סטטוס |
|---|---|---|
| 1 | מטריצת ההטמעה + אימות חי על or-edri-4 (קריאה בלבד) | completed |
| 2 | לולאת תיקונים על or-edri-4 (PRs קטנים, golden-gated, מוכח חי) | in-progress |
| 3 | or-edri-4 ירוקה לגמרי (תנאי-סיום א') | pending |
| 4 | הוכחת-לידה Day-0 על מערכת-טסט טרייה [עולה כסף] | pending |
| 5 | תיעוד וסגירה | pending |

---

## Stage 1 — מטריצה + אימות חי (קריאה בלבד, 0 עלות)

מטריצה מלאה: `docs/master-integrity-matrix.md`.

**ממצאי-מפתח (מאומתים):**
- **0 פערי-תפוצה לריפו.** 35 פיתוחים template-touching, 15 factory-only (50 סה"כ). כל פיתוח-תבנית הגיע לקבצים של or-edri-4 (הוקמה אחרי שכולם נסגרו). הבעיה אינה "הקוד לא הגיע" אלא "לא באמת עובד בזמן ריצה" + תיעוד.

**A. ‏db-setup — התראת-שווא, לא כשל אמיתי (תיקון לממצא קודם):**
`db-setup.json` = צומת יחיד "Create Tables" עם כל 10 ה-CREATEs. ‏`pending-actions-cleanup` הריץ `UPDATE pending_actions` (exec 30, 19:00, success) ו-`spend-track` הריץ (exec 29, success) → הצומת רץ → **כל 10 הטבלאות קיימות**. ה-WARN של 18:01 ("could not confirm Create Tables") היה false-negative באימות (בדק execution לא-נכון על מערכת חיה). מסקנה: הטבלאות תקינות; **הבאג הוא במנגנון-האימות + ב"ירוק/WARN מטעה"**, לא ביצירת הטבלאות. (אימות סופי ל-`agent_trace_events` ספציפית — בריצת בוט אמיתית או צומת Verify של שלב 2.)

**B. פערים חיים מאומתים (ה-backlog ל-Stage 2):**
1. **github_readonly כבוי** — configure רץ 18:00 לפני register (18:09) → הכלי הוסר מ-ops+unknown+mcp-server. (לוג configure: "github-readonly tool skipped"). אמיתי.
2. **google_workspace כתובת פיקטיבית** — `ops-agent.json:33` = `shared-google@or-infra.com`; ה-gateway דורש `edriorp38@`. אמיתי, בקוד (תבנית + or-edri-4).
3. **אימות db-setup לא-אמין** — false-negative + ה-job ירוק. תיקון: אימות-אמת (count טבלאות) + RED על כשל אמיתי.
4. **אין דוח-נזק** — ‏10+ soft-fail בלי סיכום/התראה ל-Or.
5. **מודעות-עצמית** — ‏AGENTS.md מתעד 4/8 שאילתות (חסרות conversation_transcript/tool_trace_recent/claim_actual_mismatch/spend_total); ‏SYSTEM_INFO_JSON hardcoded; ‏3 סודות-לידה לא במצאי; אין hook יכולות.

**C. בריא ומאומת חי:** ‏`/healthz`=200 דרך Caddy; n8n 2.25.7, deploy SUCCESS; 21/23 workflows פעילים; אפס ריצות-שגיאה; הבוט עונה ושומר שיחה.

**D. דגל פתוח (מינורי):** ‏`verify_railway_system` לא מצא שירות בשם "postgres" — כנראה שם שונה במצב adopt (זיכרון עובד → DB קיים). לאימות-שם בלבד.

**E. נותר לאימות-חי (דורש ריצת-בוט בטלגרם או שלב 4):** התנהגות vision/voice/research/multi-fanout/file-resolver/HITL/trace — הקוד קיים ופעיל, ההוכחה התפקודית טרם בוצעה (Caddy חוסם הזרקת-webhook חיצונית — by design).

**יומן ל-Or:** מצאנו שהקוד של כל הפיתוחים כן הגיע ל-or-edri-4. הבעיות האמיתיות שנשארו קטנות וממוקדות: ‏GitHub כבוי (סדר-פעולות), כתובת-גוגל שגויה, ומדידה לא-אמינה שצריך לתקן + מודעות-עצמית. תיקנתי טעות קודמת שלי: הטבלאות של הבוט **כן** קיימות.

---

## Stage 2 — לולאת תיקונים (זרע; המטריצה עשויה להוסיף)
מודל לכל פריט: תקן בתבנית (ענף) → החל על or-edri-4 → הוכח חי → מזג.

**PR #1 (מוכן בענף — נכונות הסוכן + מודעות-עצמית):** B2 (ops-agent.json: `shared-google@`→`edriorp38@`) + תיעוד AGENTS.md (4→8 שאילתות + "קריאת שיחת הבוט" + 7→10 טבלאות) + guard ב-check-golden-sync.sh נגד חזרת הכתובת הפיקטיבית. golden רוענן. ממתין לאישור Or למיזוג, ואז refresh-system-agents → configure על or-edri-4 → הוכחה חיה. נותר ל-PRs הבאים: B1 (db-verify), B3 (preflight), B4 (דוח-נזק), B5 (SYSTEM_INFO), C-hook (capability hook + CAPABILITIES.md).
- **B1 (PR #3 — תבנית+הוכחה-מקומית עשויים, ממתין למיזוג+חי)** db-setup אימות-אמת: שורש האזהרת-שווא = fallback לא-מסונן ב-`_db_ok` (`configure:582`) שתפס ריצה זרה במערכת חיה; ועל כשל רק WARN (job ירוק). תיקון: צומת `Verify Tables` (present_count) ב-`db-setup.json`; `_db_verdict` (`ok`/`fail:<n>`/`inconclusive`) — מחיקת ה-fallback, polling מסונן, דרישת `lastNodeExecuted=="Verify Tables"` + count≥10; כשל ודאי → `DB_VERIFY_FAILED` → `::error::`+exit 1 בסוף ה-job (לא-הרסני); inconclusive → WARN (לא RED שגוי). הוכחה מקומית: `scripts/tests/db-verify-gate-test.sh` (ב-Playground tests) — 6/6, RED על 7/10, inconclusive על ריצה זרה. חי+שלילי-Day-0: בהמשך. **הוכחת E2E (שער חדש):** `e2e-proofs/master-system-integrity-b1.json` — הודעה אמיתית דרך or-edri-4, הבוט ענה "שם המערכת שלך הוא or-edri-4" (run 27383071475, execution 86).
- **B2** ‏ops-agent.json:33 → `edriorp38@or-infra.com` + golden + CI-guard נגד `shared-google@`.
- **B3** preflight register→configure (APP_ID קיים אך secrets חסרים → RED + טלגרם).
- **B4** דוח-נזק בסוף configure (DEGRADED[] → STEP_SUMMARY + emit-event → טלגרם; exit 1 על קריטי).
- **B5** ‏SYSTEM_INFO_JSON מהמציאות + 8 שאילתות + capabilities.degraded[].
- **C** מודעות-עצמית: AGENTS.md.template (8 שאילתות + סעיף "קריאת שיחת הבוט" + 3 סודות + טבלת-טבלאות), פרומפטים 7→8, `docs/CAPABILITIES.md` + `capability-session-start-hook.sh`.
- **B6 (PR #2 — מבוצע)** ניתוב קריאת-קובץ: ממצא חי חדש — הבוט ב-or-edri-4 ענה פעמיים "אין לי כלי לקריאת קבצים" על "תקרא לי את AGENTS.md" (IMG_9197-9200). שורש = מיון, לא חיווט: ל-`Classify Intent` (agent-router.json) אין קטגוריית קריאת-קובץ → ממוין `code`/`research` שאין להם `github_readonly`. תיקון בקובץ יחיד `agent-router.json`: (1) בלם דטרמיניסטי ב-`Build Dispatch` — `entity_mention` קיים ו-intent ∈ code/research/infra → override ל-`ops`; (2) כלל `FILE READS` ב-system prompt של המסווג. golden רוענן. הגדרת-סיום = Or מקבל את **תוכן** AGENTS.md בטלגרם (לא ✅ של job).
- **B7 (PR #4 — מבוצע)** refresh מפיק הוכחת-E2E: שער ה-E2E (PR #416) חסם את refresh מלהחיל שינוי-התנהגות על מערכת קיימת (ה-PR שהוא פותח במערכת נחסם בלי הוכחה; ה-content_hash רגיש-לנתיב אז ההוכחה חייבת להיוולד בריפו-המערכת על ענף-ה-refresh). תיקון ב-`refresh-system-agents.yml` בלבד (משתמש ב-`e2e-verify.yml` המותקנת במערכת, בלי לגעת בה): refresh מדליק את ה-e2e-verify של המערכת על הענף, ממתין שההוכחה תיקבע, ומוסיף קומיט-נדנוד (טוקן-ברוקר) כי ה-CI של קומיט-הבוט "ממתין לאישור". כשל/היעדר הוכחה → refresh נכשל. הוכחה: החלת B1 חי על or-edri-4 דרך המסלול החדש (מביא גם את 10/10).

## Stage 3 — or-edri-4 ירוקה (תנאי א')
ריצת אימות-על: כל שורת-מטריצה מוטמע+עובד חי. github_readonly חזר, google_workspace עם הכתובת הנכונה, conversation_transcript/tool_trace_recent מחזירים נתונים, Or מקבל ✅.

## Stage 4 — הוכחת-לידה Day-0 [עולה כסף — אישור Or]
מערכת-טסט טרייה (reuse, factory-test-25, 0 quota): provision→register→deploy→configure (כולל ניסיון configure-לפני-register → RED צפוי של B3). צ'קליסט-ילוד מלא + סשן טרי יודע את כליו בלי נזיפה. פירוק רק לבקשת Or.

## Stage 5 — סגירה
docs (`telegram-chat-bot.md`), מטריצה סופית, fragment, devplan→completed (כששני תנאי-הסיום מתקיימים).

## Teardown ledger
- (טרם — תתעדכן כשמערכת-טסט של שלב 4 תוקם/תפורק.)
