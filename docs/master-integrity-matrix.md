# Integration Matrix — master-system-integrity (Stage 1)

מצב: or-edri-4 ‏(adopt, ‏factory-test-21, ‏2026-06-11) מול תבנית הפקטורי @ `claude/system-bot-or-edri-4-6mafvt`.
‏3 עמודות: **בתבנית?** · **בריפו or-edri-4?** · **עובד חי?** (✅/❌/לא ידוע + מאמת).

**סיכום:** 35 template-touching, 15 factory-only (50 סה"כ) · **0 פערי-תפוצה לריפו** · 0 חתימות-לא-ידועות.
המשמעות: הקוד של כל פיתוח הגיע ל-or-edri-4. הפערים הם **תפקודיים/תיעודיים בזמן-ריצה**, לא תפוצה-לריפו.

---

## ✅ מצב נוכחי — Stage 2+3 סגורים (כל הפערים תוקנו, מוכחים חי, מסונכרנים לפקטורי)

> זה המצב **העדכני** (2026-06-12). הטבלאות שמתחת הן תמונת-Stage-1 ההיסטורית (לפני התיקונים) — נשמרות לתיעוד. כל פער ב-Stage 1 → תוקן, הוכח חי על or-edri-4 (הוכחה תפקודית, לא ✅ של job), ומוטמע byte-for-byte בקוד-יצירת-המערכות.

| פער Stage 1 | תיקון | הוכחה חיה |
|---|---|---|
| db-setup אימות לא-אמין | **B1/1.1/1.2/1.3** — צומת `Verify Tables` + `_db_verdict` raw-grep | configure → "PASS: db-setup verified — 10/10 tables present" |
| google_workspace כתובת פיקטיבית | **B2** — `edriorp38@or-infra.com` + CI-guard נגד `shared-google@` | cred Google Workspace MCP מותקן; 0 הופעות `shared-google@` |
| github_readonly כבוי (סדר-פעולות) | **B3** — preflight: APP_ID קיים+secrets חסרים → critical RED+טלגרם | github_readonly חי ב-`tools/list`; configure ירוק על or-edri-4 |
| אין דוח-נזק (ירוק≠עובד) | **B4** — `DEGRADED[]` → STEP_SUMMARY+טלגרם+exit1 על critical | `damage-report-test.sh` 4/4; configure ללא critical |
| SYSTEM-INFO קשיח | **B5** — `live_read_sources` נגזר מ-`CRED_*` + `degraded[]` | `system-info-test.sh` 13/13; הבוט מונה מקורות אמיתיים |
| ניתוב קריאת-קובץ | **B6** — בלם `entity_mention`→ops ב-agent-router | הבוט מחזיר תוכן AGENTS.md בטלגרם |
| refresh לא מפיק הוכחה | **B7** — refresh מדליק e2e-verify + נדנוד | החלת תיקונים חיה על or-edri-4 |
| מודעות-עצמית | **C** — 3 טבלאות+3 סודות ב-AGENTS, `CAPABILITIES.md`, capability-hook, ship-list | קבצים זהים-בייט; hook עובד |
| כפתור-אישור (HITL) מת | **B8** — `request-write-action` `activate=yes` | הבוט שלח כרטיס ✅/❌, Or לחץ, הפעולה רצה |
| תמונה לא נותחה | **B9** — `getBinaryDataBuffer` (לא `.data`=מצביע-filesystem) | הבוט תיאר תמונה ששלח Or (exec 262 הוכיח שורש) |
| Ops Agent קרס על 769KB | **B10** — n8n API tool `optimizeResponse` (id/name/active) | הבוט שלח כרטיס במקום "אין לי תשובה" (exec 284 הוכיח שורש) |

**הוכחת-סנכרון (5 שכבות, read-only, 2026-06-12):** ‏(1) **24/24 n8n JSONs + `configure-agent-router.yml` זהים-בייט** template↔or-edri-4; ‏(2) `capability-hook`+`CAPABILITIES.md`+`settings.json` זהים-בייט, ‏AGENTS.md מכיל את כל תוכן-C; ‏(3) golden==template (committed) + guard נגד `shared-google@`; ‏(4) `provision-system.yml` שולח את C למערכות חדשות; ‏(5) configure success + הוכחות-E2E + בדיקות-Or חיות. → **כל מערכת חדשה תיוולד עם כל התיקונים.**

**שיטה שהוכחה (3 הבאגים האינטראקטיביים):** לכל באג — שליפת ה-**execution החי** שנכשל (לא ניחוש), מחקר-אינטרנט עם מקורות, ואז תיקון+אימות חי. זה הפריך 2 ניחושים מוקדמים (octet-stream MIME; גודל-תמונה) שהראיה החיה סתרה.

**נותר:** Stage 4 — הוכחת-לידה Day-0 על מערכת-טסט טרייה (עולה כסף — אישור Or נפרד).

## אימות חי (Stage 1 live pass) — ממצאים

| נושא | מצב חי | ראיה |
|---|---|---|
| תשתית (n8n/Caddy) | ✅ עובד | `/healthz`=200; deploy SUCCESS; n8n 2.25.7 |
| workflows | ✅ 21/23 פעילים | `list_n8n_workflows` |
| ריצות-שגיאה | ✅ אפס | `inspect_n8n_execution status=error` → none |
| **טבלאות db-setup** | ✅ **קיימות (תוקן)** | `pending-actions-cleanup` exec30 `UPDATE pending_actions` success @19:00; `db-setup.json`=צומת יחיד 10 CREATEs → all-or-nothing → כל 10 קיימות. ה-WARN של 18:01 = false-negative |
| זיכרון שיחה | ✅ עובד | exec 26/27/28 @18:15 success (כולל Postgres Chat Memory) |
| **github_readonly** | ❌ **כבוי** | configure 18:00 < register 18:09 → "github-readonly tool skipped"; tools/list=2 בלבד |
| **google_workspace כתובת** | ❌ **שגויה** | `ops-agent.json:33`=`shared-google@or-infra.com` (לא קיים); gateway דורש `edriorp38@` |
| מודעות-עצמית (8 שאילתות) | ❌ פער-תיעוד | `AGENTS.md` מתעד 4/8; `postgres-named-queries.json`=8 בפועל |
| Postgres service name | 🟡 לא ידוע | `verify_railway_system` לא מצא שירות "postgres" (כנראה שם adopt; DB עובד) |
| התנהגות בוט (vision/voice/research/fanout/HITL/trace) | לא ידוע — live | קוד פעיל; דורש ריצת-בוט בטלגרם או שלב 4 (Caddy חוסם הזרקה חיצונית) |

## טבלה — פיתוחים template-touching (35)
כולם **בתבנית ✅ + בריפו or-edri-4 ✅** (0 פערים). עמודת "עובד חי" + מאמת:

| slug | קבצי-תבנית עיקריים | עובד חי? (מאמת) |
|---|---|---|
| async-deep-research | deep-research.json, agent-router | לא ידוע — בקש מהבוט מחקר, צפה ל-ack אסינכרוני |
| auto-n8n-connector | deploy, AGENTS.md | לא ידוע — connector Telegram msg + `.mcp.json` n8n-live |
| bot-trace-observability | github/railway-readonly, configure | חלקי — טבלת agent_trace_events קיימת; כתיבת-trace טרם הוכחה (ריצת-בוט) |
| button-send-outcome-trace | request-write-action.json | לא ידוע — לחיצת HITL ✅ |
| capability-first | .claude/commands (build-agent/prove-capability) | לא ידוע — סשן Claude /prove-capability |
| changelog-concurrency | changelog.d/, dev-stage | CI בלבד |
| file-catalog-run-fix | configure (file-catalog /run) | לא ידוע — file_catalog rows / שם-קובץ שגוי לבוט |
| fix-agent-build-process | dev-stage.md, devplan template | process |
| google-mcp-systems | ops-agent, configure (workspace bearer) | ❌ חסום ע"י כתובת B2 (workspace-mcp-bearer קיים) |
| hitl-write-actions | request-write-action + pending-actions-executor | לא ידוע — הצעת-כתיבה → כרטיס Telegram |
| mask-multiline-secrets | configure (_mask_secret) | ✅ נראה בלוג (מוסתר) |
| mcp-birth-bundle | mcp-server.json, factory_tools, .mcp.json | ✅ /mcp/system-tools 403 ללא bearer (self-verify @18:03) |
| n8n-2x-upgrade | deploy, configure | ✅ n8n 2.25.7 חי |
| n8n-run-data-persistence | deploy (EXECUTIONS_DATA_PRUNE) | לא ידוע — list_railway_service_variables |
| ops-agent-file-read | github-readonly, ops-agent | ❌ תלוי github_readonly (כבוי) |
| ops-agent-live-telemetry | railway/github-readonly, ops-agent | railway ✅ אפשרי; github ❌ (כבוי) |
| parallel-dev-stage | dev-stage mirror | process |
| port-build-agent | subagent.template, check-agent-single-voice | scaffolding/CI |
| propagate-dev-stage | .claude/settings.json, check-devplan-updated | session hook/CI |
| provision-ruleset-protection | provision (ruleset) | לא ידוע — ruleset protect-main על or-edri-4 |
| queue-worker-webhook-fix | tg-inbound (internal host) | N/A (queue mode off) |
| reduce-actions-minutes | system workflows (concurrency) | CI/cost |
| research-web-search | research-agent (Tavily) | לא ידוע — שאלת-web לבוט |
| router-multi-intent-fanout | agent-router (Multi Gate/Run Specialists) | לא ידוע — הודעה רב-תחומית |
| shared-gmail-token | bootstrap-gmail-oauth.yml | לא ידוע — gateway logs |
| skills-audience-split | .claude/commands (shared subset) | CI |
| system-queue-mode | provision, deploy, Dockerfile.worker | N/A (off) |
| telegram-bot-fuzzy-resolver | file-catalog-refresh.json, router | לא ידוע — שם-קובץ שגוי |
| tg-vision | tg-vision.json, tg-inbound | לא ידוע — שלח תמונה |
| unknown-agent-live-tools | unknown-agent, configure | railway ✅ אפשרי; github ❌ |
| voice-stt-deepgram | tg-voice-stt.json, db-vacuum.json | לא ידוע — הקלטה קולית (deepgram-api-key קיים) |
| ops-agent-file-read-nudge / *-fixes | (תיקוני-המשך) | נכללים לעיל |

## factory-only (15) — לא משנים תוצר מערכת חדשה
playground-tests, protect-system-main (פועל ע"י dispatch על הריפו), reference-system, reference-system-overhaul, robot-hygiene, secret-clean-optimize, consolidate-to-master, factory-telegram-chat-bot, google-door-cleanup, google-wallet-unify (devplan מצהיר לא-נוגע-תבנית), mcp-org-inventory-billing, mcp-project-quota, mcp-session-stability, meta-monitoring-watchdog, n8n-mcp-central-gateway, oil-systems, system-resource-request-channel.

## הערות
- **תיקון לממצא קודם:** הטבלאות **כן** קיימות; ה-WARN של db-setup היה false-negative. הבאג = מנגנון-אימות לא-אמין.
- **תפוצה שלילית:** באג B2 (`shared-google@`) הופץ נאמנה לתבנית **וגם** ל-or-edri-4.
- **drift תיעוד:** 8 שאילתות בקוד מול 4 ב-AGENTS.md — זהה בשני העצים.
