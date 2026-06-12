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
| 2 | לולאת תיקונים על or-edri-4 (PRs קטנים, golden-gated, מוכח חי) | completed |
| 3 | or-edri-4 ירוקה לגמרי (תנאי-סיום א') | completed |
| 4 | הוכחת-לידה Day-0 על מערכת-טסט טרייה [עולה כסף] | completed |
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
- **B3 (PR #10 — מבוצע)** preflight register→configure: היום "App לא נרשם" ו"App נרשם אך הסודות לא הגיעו ל-SM" מתמזגים לאותו warning שקט (`github_readonly` נחתך). תיקון ב-`configure-agent-router.yml` בלבד: חושפים `APP_ID_VAR=${{ vars.APP_ID }}` (נכתב ע"י register-system-app), ובבלוק ה-github-app preflight — `APP_ID` קיים אך אחד מ-`github-app-*` חסר → `GH_APP_BROKEN` → שורת **critical** בדוח-הנזק (RED + טלגרם דרך מנגנון B4); `APP_ID` ריק → נשאר warning ירוק (לידה לפני-register לא מואדמת בטעות). אין exit מוקדם — configure ממשיך לחווט router/telegram/mcp, וה-exit 1 צועק בסוף. שורת ה-warning של B4 מגודרת (`&& [ -z GH_APP_BROKEN ]`) למניעת כפילות. הוכחה: `scripts/tests/github-app-preflight-test.sh` (ב-Playground, 5/5 — registered+missing=RED, not-registered=warning ירוק, healthy=ללא שורה, broken מדכא את ה-warning). חי: configure על or-edri-4 הבריאה (APP_ID + secrets קיימים) → אין GH_APP_BROKEN → ירוק. המקרה השבור (configure-לפני-register) נדחה ל-Stage 4 Day-0.
- **B4** דוח-נזק בסוף configure (DEGRADED[] → STEP_SUMMARY + emit-event → טלגרם; exit 1 על קריטי).
- **B5** ‏SYSTEM_INFO_JSON מהמציאות + 8 שאילתות + capabilities.degraded[].
- **C (PR #11 — מבוצע)** חבילת מודעות-עצמית. *גילוי:* החלקים "8 שאילתות בפרומפטים" ו"סעיף קריאת-שיחה" כבר נחתו ב-PR קודם — נשארו הפערים האמיתיים: (1) `AGENTS.md.template` — הוספת 3 הטבלאות החסרות מתוך ה-10 (`agent_trace_events`/`file_catalog`/`spend_track_state`) + 3 סודות-הלידה (`workspace-mcp-bearer`/`factory-mcp-bearer`/`n8n-mcp-server-token`, כולם ב-SM של המערכת); (2) `templates/system/docs/CAPABILITIES.md` חדש — מפת-יכולות (כלים read-only מותני-התקנה, 8 השאילתות, איך קוראים את שיחת-הבוט, `.mcp.json`); (3) `scripts/capability-session-start-hook.sh` חדש — דפוס devplan-hook (`trap exit 0`, read-only, self-guarding), רשום ב-`templates/system/.claude/settings.json` (system-only — לפקטורי אין בוט/AGENTS.md להצביע אליו); (4) ship-list ב-`provision-system.yml` (hook ללולאה + chmod + pair ל-CAPABILITIES.md). golden 127→128. הוכחה: hook מדפיס נכון בריפו-מערכת ושותק אחרת; golden+golden-sync ירוקים. חי: PR ישיר ל-or-edri-4 (refresh לא מרנדר `.md`/`.json` scaffold) → סשן Claude טרי מקבל את ההתמצאות. לידה Day-0 ב-Stage 4.
- **B6 (PR #2 — מבוצע)** ניתוב קריאת-קובץ: ממצא חי חדש — הבוט ב-or-edri-4 ענה פעמיים "אין לי כלי לקריאת קבצים" על "תקרא לי את AGENTS.md" (IMG_9197-9200). שורש = מיון, לא חיווט: ל-`Classify Intent` (agent-router.json) אין קטגוריית קריאת-קובץ → ממוין `code`/`research` שאין להם `github_readonly`. תיקון בקובץ יחיד `agent-router.json`: (1) בלם דטרמיניסטי ב-`Build Dispatch` — `entity_mention` קיים ו-intent ∈ code/research/infra → override ל-`ops`; (2) כלל `FILE READS` ב-system prompt של המסווג. golden רוענן. הגדרת-סיום = Or מקבל את **תוכן** AGENTS.md בטלגרם (לא ✅ של job).
- **B5 (PR #9 — מבוצע)** SYSTEM-INFO מהמציאות: כרטיס היכולות שמוזרק לפרומפט הבוט (`@@SYSTEM_INFO_JSON@@`) הציג `live_read_sources` קשיח שתמיד הבטיח 4 מקורות גם כשכלי נחתך → הבוט עלול להבטיח מה שאין. תיקון: גוזרים את live_read_sources מ-`CRED_*` (כלי מותקן ⇔ CRED לא-ריק), ומוסיפים `degraded[]` (מה כבוי: postgres/github/railway/google_workspace/openrouter/telegram). מנגנון ההזרקה ללא שינוי. הוכחה: `scripts/tests/system-info-test.sh` (ב-Playground, 13/13). חי: Or שואל "מה אתה יכול לקרוא" → מקורות אמיתיים (or-edri-4 בריאה: כל ה-4, degraded ריק).
- **B4 (PR #8 — מבוצע)** דוח-נזק ב-configure: ~50 soft-fail שקטים → מערך `DEGRADED`, טבלת STEP_SUMMARY (🩺), התראת טלגרם אחת דרך `emit-event.sh`, ו-`exit 1` רק על `critical`. v1 גוזר מהמצב-הסופי: critical = OpenRouter מת (`OR_DEAD`) או מחסור-טבלאות (`DB_VERIFY_FAILED`, בולע את B1); warning = postgres/github_readonly/railway_readonly/telegram חסרים. `_soft_exit0` גם שולח טלגרם (בלי לשנות exit 0). non-critical נשאר ירוק (אין false-RED על לידה נקייה). הוכחה: `scripts/tests/damage-report-test.sh` (ב-Playground) — RED על critical, ירוק על warnings. חי: configure על or-edri-4 הבריאה → אין critical → ירוק.
- **B1.3 (PR #7 — מבוצע)** db-verify סומך על present_count: ה-DIAG של B1.2 חשף `exec2_count=present_count":10` — המערכת דיווחה חי 10 טבלאות; הספירה היתה שם. הבאג: שער-מקדים `lastNodeExecuted...Verify Tables` חסם לפני קריאת הספירה. תיקון: להסיר את השער — `present_count` (הפלט של Verify Tables) הוא האות הראשי והמספיק. בדיקת-יחידה 6/6. הוכחה: configure על or-edri-4 → "10/10 tables present".
- **B1.2 (PR #6 — מבוצע)** db-verify על כל המקורות: B1+B1.1 החזירו inconclusive חי, אך ריצה 109 הוכיחה ש-Verify Tables רץ והטבלאות בריאות — רק המשיכה כשלה. תובנה: `_db_verdict` הוא raw-grep, אז verdict על **כל** המקורות (תגובת /run עצמה → GET לפי id → חיפוש-מסונן), הראשון שמצליח מנצח — עמיד-מבנה, בלי ניחוש. + הדפסת-אבחון בטוחה (key-paths בלבד) אם עדיין inconclusive. PR #7 ב-or-edri-4 נסגר.
- **B1.1 (PR #5 — מבוצע)** db-verify לפי executionId: B1 החזיר `inconclusive` חי על or-edri-4, אבל `inspect_n8n_execution` הוכיח שריצת db-setup (93) הצליחה עם `lastNodeExecuted=="Verify Tables"` — הטבלאות מאומתות; רק החיפוש-המסונן (`_db_check`) לא מצא אותה (וה-fallback הוסר). תיקון ב-`configure-agent-router.yml` (בלוק db-setup): קריאת ה-executionId שתגובת `/run` מחזירה ומשיכת הריצה ישירות (דטרמיניסטי); `_db_check` נשאר fallback משני. `_db_verdict`/Verify Tables ללא שינוי → בדיקת-היחידה ו-RED לא מושפעים. הוכחה: configure על or-edri-4 → "PASS: db-setup verified — 10/10 tables present".
- **B7 (PR #4 — מבוצע)** refresh מפיק הוכחת-E2E: שער ה-E2E (PR #416) חסם את refresh מלהחיל שינוי-התנהגות על מערכת קיימת (ה-PR שהוא פותח במערכת נחסם בלי הוכחה; ה-content_hash רגיש-לנתיב אז ההוכחה חייבת להיוולד בריפו-המערכת על ענף-ה-refresh). תיקון ב-`refresh-system-agents.yml` בלבד (משתמש ב-`e2e-verify.yml` המותקנת במערכת, בלי לגעת בה): refresh מדליק את ה-e2e-verify של המערכת על הענף, ממתין שההוכחה תיקבע, ומוסיף קומיט-נדנוד (טוקן-ברוקר) כי ה-CI של קומיט-הבוט "ממתין לאישור". כשל/היעדר הוכחה → refresh נכשל. הוכחה: החלת B1 חי על or-edri-4 דרך המסלול החדש (מביא גם את 10/10).

## Stage 3 — or-edri-4 ירוקה (תנאי א')
ריצת אימות-על: כל שורת-מטריצה מוטמע+עובד חי. github_readonly חזר, google_workspace עם הכתובת הנכונה, conversation_transcript/tool_trace_recent מחזירים נתונים, Or מקבל ✅.

**מצב — סגור (כל 3 הפערים האינטראקטיביים תוקנו, הוכחו חי, מסונכרנים):** התשתית של or-edri-4 הוכחה ירוקה לגמרי (configure run 27397249020: db 10/10, github/google/factory/voice/telegram מותקנים, mcp self-verify 4/4, דוח-נזק נקי). הבדיקות החיות של Or בטלגרם הוכיחו fan-out + conversation_transcript + voice, וחשפו 3 פערים אינטראקטיביים — **כולם תוקנו בשיטה מבוססת-ראיה (שליפת ה-execution החי שנכשל, מחקר-אינטרנט עם מקורות, ואז תיקון+אימות חי), כולם הוכחו חי על or-edri-4, וכולם מסונכרנים byte-for-byte לתבנית:**
- **B10 (n8n API trim) — תוקן + הוכח חי:** הודעת-טקסט שדורשת רשימת-workflows → Ops Agent החזיר "אין לי תשובה". שורש מוכח (execution 284): כלי n8n API החזיר 769KB (כל הצמתים), הקריאה השנייה של המודל חרגה מההקשר → 400. מחקר: פיצ'ר Optimize Response של n8n (מקורות + שמות-פרמטרים מקוד-המקור). תיקון ב-ops-agent.json: optimizeResponse + fields id/name/active → מאות בייטים. golden מרוענן. **הוכחה חיה: Or ביקש לכבות workflow → קיבל כרטיס ✅/❌, לחץ, ה-workflow כובה ("עבד — הוא שלח כפתורים ולחצתי והוא כיבה").**
- **B9 (tg-vision bytes) — תוקן + הוכח חי:** הבוט החזיר "לא הצלחתי לנתח" לכל תמונה. שורש מוכח (execution 262): ה-data-URI ששלח ל-VLM היה `data:image/jpeg;base64,filesystem-v2...` — מצביע-אחסון במקום בייטים. ב-`tg-vision` הצומת `To Base64` קרא `.data` שבמצב filesystem הוא reference (truthy) → ה-fallback ל-getBinaryDataBuffer דולג (הפריך את השערת ה-octet-stream המוקדמת — ה-MIME היה תקין). תיקון: תמיד getBinaryDataBuffer. golden מרוענן. **הוכחה חיה: Or שלח תמונה → הבוט תיאר אותה ("על התמונה הוא הגיב יפה").**
- **B8 (request-write-action published) — תוקן + הוכח חי:** ה-HITL היה מת — שורש (live `list_n8n_workflows`): `request-write-action` הותקן `activate=no` (כבוי) בעוד אחיו (github/railway/postgres-named-queries) `yes` (פעילים, עובדים). ב-n8n 2.x toolWorkflow טוען רק activeVersion שפורסם → הכלי no-op. תיקון: `no`→`yes`. golden מרוענן. **הוכחה חיה: הכרטיס ✅/❌ נשלח ו-Or לחץ והפעולה רצה (אותה הוכחה של B10).**
- **tool_trace_recent — לא באג:** הנתונים נכתבים (כל כלי INSERT ל-`agent_trace_events`) והשאילתה זמינה; הבוט פשוט לא ניתב את הניסוח. שיפור-פרומפט אופציונלי, נמוך.

**הוכחת-סנכרון (read-only, 2026-06-12, 5 שכבות):** 24/24 n8n JSONs + `configure-agent-router.yml` זהים-בייט (template↔or-edri-4); קבצי-C (`capability-session-start-hook.sh`/`CAPABILITIES.md`/`settings.json`) זהים-בייט + AGENTS.md מכיל את כל תוכן-C; golden==template (committed) + guard נגד `shared-google@` (0 הופעות); `provision-system.yml` שולח את C למערכות חדשות; runtime חי מריץ את התיקונים. → **כל מערכת חדשה תיוולד עם כל התיקונים.** המטריצה המלאה: `docs/master-integrity-matrix.md`. נותר: Stage 4 (לידה Day-0, עולה כסף — אישור Or נפרד).

## Stage 4 — הוכחת-לידה Day-0 [עולה כסף — אישור Or] — **completed**
**הוכח חי על `factory-test-060`** (reuse, factory-test-25, 0 quota; באישור Or מפורש "תקים עכשiv"): provision→register→deploy→configure — **כל 4 ירוקים**. ה-provision נולד עם כל תיקון (אומת בקוד הריפו @ d11a01b: `getBinaryDataBuffer` ב-tg-vision=B9, `optimizeResponse` ב-ops-agent=B10, `docs/CAPABILITIES.md`+capability-hook+3 טבלאות ב-AGENTS=C). לוג ה-configure (run 27441633625) מוכיח חי: `db-setup 10/10`, **github_readonly published+live** (באג ה-ordering המקורי של edri-4 — פה נולד תקין כי register רץ לפני configure), google_workspace credential הותקן (כתובת נכונה), request-write-action published (B8), tg-vision/tg-voice-stt/tg-inbound published, OpenRouter live HTTP 200, mcp-server self-verify 4/4, **דוח-נזק נקי (אפס critical, B3 ללא false-RED)**. Or הריץ בעצמו את בדיקות-הטלגרם האינטראקטיביות — **כולן עברו**. Caddy מדולג בכוונה למערכות-טסט (`Detect throwaway test system`). פירוק `factory-test-060` — רק לבקשת Or.

**ממצא-לוואי שתוקן (verifier honesty, PR #437 — מוזג + נפרס + מאומת חי):** `verify_github_system` דיווח "2/4 נכשלו" על לידה מושלמת — 2 בדיקות-שווא ישנות (`production-env-exists`, `bootstrap-complete-marker`). הוחלפו ב-2 בדיקות-לידה אמיתיות (`scaffold-agents-md`+`scaffold-mcp-config`, מה שכל מערכת **באמת** נולדת איתו) ב-`services/mcp-server/src/tools.ts`. אומת חי אחרי deploy-mcp-server: **4/4 all-pass** גם על factory-test-060 וגם על or-edri-4.
**follow-up — בוצע:** צעד כתיבת ה-`.bootstrap-complete` ב-`protect-system-main.yml` (+ ה-input `write_bootstrap_marker`) הוסר כקוד-מת; הליבה (החלת ה-ruleset) ללא שינוי.
**ניקוי:** `factory-test-060` פורק (decommission-test-system, לבקשת Or).

## Stage 5 — סגירה
docs (`telegram-chat-bot.md`), מטריצה סופית, fragment, devplan→completed (כששני תנאי-הסיום מתקיימים).

## Teardown ledger
- (טרם — תתעדכן כשמערכת-טסט של שלב 4 תוקם/תפורק.)
