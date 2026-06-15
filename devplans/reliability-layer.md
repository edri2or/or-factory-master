---
dev_name: רובד ניהול-אוטומציות אמין
slug: reliability-layer
opened: 2026-06-14
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — רובד ניהול-אוטומציות אמין

## מטרה

לסגור את פער ה**כשל-השקט** בכל מערכת שהפקטורי מקים (קיימת + חדשה): כשל בתוך workflow,
אוטומציה שהפסיקה לרוץ, או "רץ אבל לא עשה כלום" — לא ייפלו בשקט. מרחיבים את התשתית הקיימת
(emit-event/observability-client, ה-watchdog, Better Stack, system-runtime-audit), לא בונים
stack חדש. מוכיחים כל שלב חי על `or-edri-4` לפני שמקבעים בקוד (`/dev-stage-factory`).
דוקטרינה: `docs/reliability-layer.md`.

> **סדר-תלות (מחייב):** `0 → (1,4) → (2,5) → 3 → 7 → 6 → 8 → 9`.
> פיתוח על ענף `claude/stoic-feynman-62xkr5`, PR יחיד → main = קיבוע בתבנית.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | דוקטרינה + מנגנון הוכחה-מענף (`source_ref`) | completed | `docs/reliability-layer.md`, `.github/workflows/refresh-system-agents.yml`, `devplans/reliability-layer.md` |
| 1 | גשר ה-emit + Error Workflow סטנדרטי בכל workflow | completed ✅ proven-live | `services/mcp-server/src/{index.ts,emit-route.ts}`+test, `templates/system/workflows/n8n/error-handler.json`, `templates/system/.github/workflows/configure-agent-router.yml`, `monitoring/registry-exempt.txt`, golden |
| 4 | probe `/healthz` → `/healthz/readiness` (+סבילות 503) | completed ✅ proven-live | `.github/workflows/system-runtime-audit.yml` |
| 2 | "אות חיות" → **מוזג לשלב 3** (refinement factory-native) | folded | — (אפס ניתוח-workflow; השומר קורא executions) |
| 5 | assertion "רץ אבל ריק" — תבנית + דוגמה אחת | pending | `docs/reliability-layer.md`, workflow מייצג אחד, golden |
| — | **אבן-דרך E2E** (קפיאת קבצי-n8n) → proof על or-edri-4 | pending | `e2e-proofs/reliability-layer.json` |
| 3 | watchdog `n8n-workflow-cadence` (dead-man) | completed ✅ proven | `scripts/run-watchdog.sh`, `monitoring/watchdog-registry.json`, `run-watchdog.bats` |
| 7 | אימות Task-Runner/queue (verify-only) | pending | `docs/reliability-layer.md` |
| 6 | rollup-צי מעל Axiom → Telegram/Linear | pending | `.github/workflows/fleet-rollup.yml`(חדש), סקריפט שאילתה, `docs/observability.md` |
| 8 | retrofit למערכות קיימות (post-merge, Or-gated) | pending | `docs/reliability-layer.md` (runbook) |
| 9 | רענון golden סופי + סגירה | pending | `tests/golden/system/`, `devplans/reliability-layer.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **חמשת שערי ה-CI:** golden-sync (כל שינוי `templates/system/**` מרענן golden באותו commit),
> changelog (fragment `changelog.d/2026-06-14-reliability-layer.md` לכל שלב), devplan (לגעת
> בקובץ זה בכל commit-קוד), **E2E** (proof טרי מ-or-edri-4 לפני מיזוג כשנוגעים ב-`workflows/n8n/*`
> או `configure-agent-router.yml`), **watchdog-registry** (רישום `error-handler.json` החדש).

---

### שלב 0 — דוקטרינה + מנגנון הוכחה-מענף (`source_ref`)

**Acceptance:**
- [x] `docs/reliability-layer.md` מגדיר קריטריוני-קבלה 2.x/queue-safe, חוזה גשר-emit, שלוש
      שכבות, מגבלת Error-Workflow, טקסונומיה.
- [x] `refresh-system-agents.yml` מקבל input `source_ref` (default ריק = התנהגות זהה),
      ו-checkout מושך את ה-ref הזה; ה-WIF נשאר ברוקר-על-main.
- [x] CI ירוק (yamllint/shellcheck, changelog, devplan) — 6/6 ירוק.

**הוכחה תפקודית (באותו שלב):** *לא-התנהגותי לבוט* — שינוי תיעוד + input ל-workflow. ה-`source_ref`
מוכח בפועל בשלב 1 (כשמחילים את ענף-העבודה על or-edri-4 דרכו).

**הוכחת E2E (artifact):** לא-התנהגותי (אין שינוי ב-`workflows/n8n/*` / `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם ומוזג ל-main ב-PR #459 (squash 43d08c8), 6/6 שערים ירוקים.
`source_ref` חי על main; משמש כעת בשלב 1.

**שינוי תוכנית:** הוספת מנגנון ה-`source_ref` היא תוספת מול ההנדאוף — נדרשה כי
`refresh-system-agents.yml` נעול-main ומעתיק רק מ-main, ולכן לא יכול להחיל שינוי-ענף לא-ממוזג
על or-edri-4 לצורך ההוכחה החיה. זהו ה-enabler לכל שלב התנהגותי.

---

### שלב 1 — גשר ה-emit + Error Workflow סטנדרטי

**Acceptance:**
- [ ] `POST /factory/<system>/emit` בשער: אימות זהה ל-`/factory/<system>/mcp`
      (401/403/200), זהות נגזרת מה-claim, גוף מאומת, קורא `emitEvent()`; rate-limit +
      kill-switch; טסט-יחידה (401/403/200/400).
- [ ] `error-handler.json` חדש (Error Trigger → HTTP-Request emit `factory.n8n.workflow_failed`,
      `onError:continueRegularOutput`).
- [ ] `configure-agent-router.yml` מייבא את ה-error-handler ראשון, ואז מזריק
      `settings.errorWorkflow=<id>` לכל workflow אחר לפני ה-upsert.
- [ ] `error-handler.json` רשום ב-`watchdog-registry.json`; golden מרוענן.

**הוכחה תפקודית (באותו שלב):** אחרי `deploy-mcp-server.yml` — smoke ל-`/factory/or-edri-4/emit`
(בלי bearer 401; עם bearer 200 + שורת-Axiom + Telegram). אחרי החלת-ענף על or-edri-4 —
כשל-צומת מאולץ ב-workflow `dev-` → התראת-Telegram אחת + issue ב-Linear; כל workflow מראה
`settings.errorWorkflow` (דרך `list_n8n_workflows`).

**הוכחת E2E (artifact):** התנהגותי — מכוסה ע"י proof-ה-or-edri-4 שיופק באבן-הדרך אחרי שלב 5.

**הערת התקדמות אחרונה:** הקוד נכתב ועבר build+test+golden מקומית: route `POST /factory/<system>/emit`
(אימות תאום ל-`/factory/<system>/mcp`, זהות מה-claim, rate-limit+kill-switch, 10 טסטים ירוקים);
`error-handler.json` (Error Trigger→HTTP emit); הזרקת `settings.errorWorkflow` בכל workflow דרך
`_upsert_wf`; exempt בפנקס השומר; golden רוענן. נשאר: CI ירוק → אישור Or ל-`deploy-mcp-server` +
הוכחה חיה על or-edri-4 (כשל מאולץ → התראת Telegram אחת + issue ב-Linear).

**שינוי תוכנית:** הזרקת ה-errorWorkflow נעשית בנקודת-החנק היחידה `_upsert_wf` (לא ב-~20 אתרי-קריאה),
וה-emit-bridge הוא route חדש ב-`index.ts` (לא ב-`factory-scope.ts`) כדי לא להפעיל את שער ה-deploy-smoke
של `factory-mcp` לשווא. `error-handler.json` נרשם ב-`registry-exempt.txt` (error-sink, לא קרון).

**Acceptance:**
- [x] `system-runtime-audit.yml` בודק `…/healthz/readiness` עם retry על 503 (עד 3×10ש לפני
      `failed`) + fallback ל-`/healthz` אם readiness לא נתמך (404). preflight של ה-deploy נשאר `/healthz`.
- [x] אומת חי ש-2.25.7 מגיש `/healthz/readiness` על or-edri-4 (200 `{"status":"ok"}`).

**הוכחה תפקודית (באותו שלב):** `probe_endpoint .../healthz/readiness` → **200** (אומת חי). הרצת
`system-runtime-audit.yml` אחת אחרי מיזוג → or-edri-4 בריא דרך readiness. *לא-התנהגותי לבוט.*

**הוכחת E2E (artifact):** לא-התנהגותי (workflow פקטורי, לא `templates/system`).

**הערת התקדמות אחרונה:** מומש — ה-probe עבר ל-`/healthz/readiness` עם retry על 503 (טרנזיינט) +
fallback ל-`/healthz` על 404. readiness אומת חי על or-edri-4 (200). נשאר: CI ירוק → מיזוג.

**שינוי תוכנית:** הוספת fallback ל-liveness על 404 — שמירה על universal-across-lifecycle (n8n ישן
שלא מגיש readiness לא ייתן אזעקת-שווא).

---

### שלב 2 — "אות חיות" פר-אוטומציה → **מוזג לשלב 3 (refinement factory-native)**

**Acceptance:**
- [x] גילוי "אוטומציה הפסיקה לרוץ / הריצה האחרונה נכשלה" מושג ע"י **השומר שקורא את ה-executions
      של n8n ישירות** (שלב 3: `n8n-workflow-cadence` + ה-`n8n-workflow-liveness` הקיים) — לא ע"י
      הוספת צומת heartbeat ל-24 ה-workflows.

**הוכחה תפקודית:** ראו שלב 3 (אותה הוכחה — קו ה-cadence/liveness בשומר).

**הוכחת E2E (artifact):** לא-התנהגותי (אין שינוי ב-`workflows/n8n/*`; השומר הוא factory-side).

**הערת התקדמות אחרונה:** מוזג לשלב 3. ה-executions של n8n *הם* ה-heartbeat — השומר קורא אותם.

**שינוי תוכנית:** **refinement מהותי (factory-native).** ההנדאוף תכנן heartbeat-node פר-קרון
(ניתוח של 6 workflows מורכבים — branching, `onError:continueRegularOutput` בכל מקום, golden churn +
E2E re-proof). אבל ה-watchdog **כבר** קורא executions (`n8n-workflow-liveness`), והרחבתו ל-cadence
(שלב 3) מזהה "הפסיק לרוץ" לכל ה-crons **בלי שום ניתוח-workflow** — יותר factory-native (הרחב את
הקיים), אפס סיכון, ויותר מידע (סטטוס+זמן לכל workflow). ה-fleet-rollup (שלב 6) יקרא את אירועי-השומר
במקום heartbeats. "רץ אבל ריק" (status=success אך פלט-ריק) עדיין דורש שלב 5 (assertion).

---

### שלב 5 — assertion "רץ אבל ריק" — תבנית + דוגמה

**Acceptance:**
- [ ] `docs/reliability-layer.md` מתעד את התבנית (צומת IF על אינווריאנט-פלט → emit
      `factory.automation.empty_result` `warning`).
- [ ] דוגמה מחווטת אחת (`spend-track.json` או `pending-actions-cleanup.json`); golden מרוענן.

**הוכחה תפקודית (באותו שלב):** אילוץ תנאי ריק/שגוי על variant `dev-` ב-or-edri-4 → התראת
`warning` אחת; ריצה בריאה — שקט.

**הוכחת E2E (artifact):** התנהגותי — מכוסה ע"י proof-ה-or-edri-4 (אבן-הדרך הבאה).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** ההנדאוף הניח כלי-MCP `claim_actual_mismatch` — הוא **לא קיים**. לכן השלב
הופך לתבנית מתועדת + דוגמה (emit `warning`), לא כלי חדש.

---

### אבן-דרך E2E — proof יחיד מ-or-edri-4 (אחרי שלב 5)

קבצי-ה-n8n קופאים כאן. החלת-ענף על or-edri-4 (`refresh-system-agents.yml source_ref=<branch>
paths=workflows/n8n,.github/workflows/configure-agent-router.yml`), ואז `e2e-verify.yml`
(`system_name=or-edri-4`, `gcp_project=factory-test-21`, `target_ref=<branch>`,
`slug=reliability-layer`) → מחתים `e2e-proofs/reliability-layer.json` על הענף
(`system==or-edri-4`, `result==pass`, `content_hash` = עץ סופי). אם commit מאוחר נוגע שוב
ב-n8n/configure — להריץ מחדש.

---

### שלב 3 — watchdog `n8n-workflow-cadence` (dead-man)

**Acceptance:**
- [x] `run-watchdog.sh`: `_n8n_wf_last_age_h` + `proof_n8n_workflow_cadence` (גיל >
      `max_age_hours` → 🔴), מחווט ל-dispatch לפי `proof_method` (`n8n-workflow-cadence`).
- [x] רשומת `system-n8n-cadence` ב-`watchdog-registry.json` עם `evidence.expected` פר-קרון.
- [x] טסט מבוסס-fixture (fresh→✅, stale→🔴, unregistered→דילוג) — 51/51 bats עוברים, shellcheck נקי.

**הוכחה תפקודית (באותו שלב):** 3 טסטי-bats עוברים (כולל stale→🔴). live: הרצת ה-watchdog על
or-edri-4 (`meta-monitoring-watchdog.yml` או `WATCHDOG_SYSTEMS_OVERRIDE=or-edri-4`) → קו cadence ✅.

**הוכחת E2E (artifact):** לא-התנהגותי (scripts + monitoring).

**הערת התקדמות אחרונה:** הושלם + מוזג (#462, `85d3778`) + הוכח. 51/51 bats (כולל stale→🔴);
הרצת watchdog חיה (run 27524643130) — `done ok=18 red=0 unknown=5`, אפס אזעקות-שווא, נפלט
`factory.watchdog.ok`. **מגבלה ידועה (follow-up):** ה-n8n-proofs של השומר (cadence+liveness) מונים
את תיקיית-המערכות וקוראים סוד ב-`--project=<system>` → מכסים מערכות-רגילות, **לא** את or-edri-4
(adopt, project `factory-test-21`, מחוץ-לתיקייה) ולא reuse-mode. or-edri-4 עצמה מכוסה ע"י שלב 1
(התראת-כשל) + שלב 4 (readiness); להרחיב את כיסוי-ה-cadence ל-adopt/always-include — follow-up.

**שינוי תוכנית:** ה-watchdog כבר כולל `n8n-workflow-liveness` (תופס "מעולם-לא-רץ" + "אחרון
נכשל"). השלב מוסיף רק את ממד ה-cadence/staleness — לא בנייה מאפס.

---

### שלב 7 — אימות Task-Runner/queue (verify-only)

**Acceptance:**
- [ ] תיעוד ב-`docs/reliability-layer.md`: כל צמתי-הרובד הם HTTP-Request (לא Code/env),
      רצים ירוק תחת ה-Task-Runner החי על or-edri-4, binary נשאר ב-DB. אין שינוי deploy.

**הוכחה תפקודית (באותו שלב):** ביצועי ה-Error-Workflow + ה-heartbeat על or-edri-4 (משלבים
1–2) הם הוכחת בטיחות-ה-runner; מתעדים.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** 2.25.7 + `binary=database` כבר מומשו (`n8n-2x-upgrade`) — אימות בלבד, אין שכפול.

---

### שלב 6 — rollup-צי מעל Axiom

**Acceptance:**
- [ ] `.github/workflows/fleet-rollup.yml` (מתוזמן) + סקריפט שאילתת-Axiom → דייג'סט חוצה-מערכות
      בעברית ל-Telegram (Linear ל-actionable). Grafana = אופציה דחויה מסומנת ב-`docs/observability.md`.

**הוכחה תפקודית (באותו שלב):** הרצת ה-workflow → הודעת-דייג'סט אחת מסכמת את אירועי-האמינות
(`workflow_failed`/`heartbeat`/`empty_result`/`runtime_audit`) מ-Axiom. *לא-התנהגותי.*

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 8 — retrofit למערכות קיימות (post-merge, Or-gated)

**Acceptance:**
- [ ] runbook ב-`docs/reliability-layer.md`. אחרי המיזוג, לכל מערכת קיימת:
      `refresh-system-agents.yml system_name=<sys> paths=workflows/n8n,.github/workflows/configure-agent-router.yml
      post_merge_workflow=configure-agent-router.yml` (מ-main) → מזריק errorWorkflow + heartbeats לחי.
      כל הרצה חיה **באישור Or**.

**הוכחה תפקודית (באותו שלב):** פר-מערכת אחרי refresh: `list_n8n_workflows` מראה
`settings.errorWorkflow`; כשל מאולץ → התראה; readiness ירוק.

**הוכחת E2E (artifact):** פר-מערכת דרך מסלול-ה-refresh הפנימי (אם המערכת אוכפת שער).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 9 — רענון golden סופי + סגירה

**Acceptance:**
- [ ] `bash scripts/check-system-golden.sh --update` אם יש drift; חמשת השערים ירוקים.
- [ ] `status: completed` (ב-PR תיעוד-בלבד אם תוכנית אחרת `active` במקביל; אחרת ב-PR הקוד).

**הוכחה תפקודית (באותו שלב):** `scripts/check-system-golden.sh` (בלי `--update`) נקי;
`check-golden-sync.sh` עובר. *לא-התנהגותי.*

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## אופציונלי — Day-0 throwaway birth check (Or-gated, עולה כסף)

מערכת throwaway ב-reuse mode (`shared_gcp_project=factory-test-25`) להוכיח שמערכת *שזה-עתה
נולדה* מקבלת את הרובד מהלידה (מה ש-or-edri-4, מערכת Day-2, לא יכול להראות), ואז
`decommission-test-system.yml`. לעולם לא בשרשור-אוטומטי; לשאול את Or קודם.

## גבולות באישור-Or (אישור מפורש לפני כל אחד)

- `deploy-mcp-server.yml` redeploy (שלב 1).
- כל הרצת-retrofit על מערכת קיימת (שלב 8).
- ה-Day-0 throwaway האופציונלי (עולה כסף).
- **`or-edri-4` קבועה — לא מפרקים אותה לעולם.**

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 0 (הושלם, מוזג) — כתבתי את "ספר-החוקים" של הרובד והוספתי מתג שמאפשר לבדוק שינוי על
  המערכת החיה or-edri-4 לפני שמקבעים. נכנס ל-main לבד (PR #459).
- שלב 1 (הושלם + הוכח חי ✅) — "צינור ההתראות" + ה-Error Workflow. הוכח מקצה-לקצה על or-edri-4:
  כשל-לדוגמה → התראה הגיעה לטלגרם + כרטיס Linear + Axiom. הצינור עובד. נכנס ל-main (PR #460).
- שלב 4 (הושלם + הוכח חי ✅) — שדרגתי את בדיקת-הבריאות התקופתית לבדוק "מוכן באמת" (DB+מיגרציות),
  לא רק "חי", עם הגנה מפני אזעקות-שווא. אומת חי: הבדיקה רצה, or-edri-4 דווחה בריאה, אפס אזעקות-שווא.
- שלב 2 (חידוד) — מצאתי דרך בטוחה ונקייה יותר ל"לדעת אם אוטומציה הפסיקה לרוץ": במקום להוסיף קוד
  ל-24 האוטומציות (ניתוח מסוכן), ה"שומר" המרכזי יקרא את היסטוריית-ההרצות שלהן ישירות. אותה הגנה,
  הרבה פחות סיכון. (מתממש בשלב 3.)
- שלב 3 (הושלם + הוכח ✅) — ה"שומר" יודע עכשיו לזהות קרון שהפסיק לרוץ בשקט. 51/51 בדיקות עוברות,
  והרצתי אותו חי על הצי — נקי, אפס אזעקות-שווא. (יחד עם שלב 1 שתופס נפילות — הצי מכוסה.)
