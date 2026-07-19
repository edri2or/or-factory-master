---
audience: factory-only
description: Stand up a brand-new clean sibling system (like or-agents) end-to-end — GCP project + WIF + secrets, a clean repo foundation from templates/new-system/, a live n8n/Caddy deploy, and proof the connections work. Use when Or wants to start a NEW system from scratch that reuses the working infra (Google + secrets + MCP + n8n) but gets a fresh architecture. Runs only in an or-factory-master session (needs the broker). Encodes the exact proven playbook + the gotchas already solved, so no re-research.
---

# /new-system — הקמת מערכת אחות חדשה, נקייה, מקצה-לקצה

זו הפקודה שבונה מערכת חדשה **באותה דרך בדיוק** שבה נבנתה `or-agents` — עם כל המהמורות שכבר פתרנו
מוטבעות בפנים. היא **playbook לביצוע על-ידך (הסוכן)**, לא אוטומציה מלאה: אתה מריץ צעד-צעד, מאמת כל
פלט בכלי קריאה, ועוצר לאישור Or בצעדים היקרים. דווח ל-Or בעברית פשוטה; הוא לא נוגע בטרמינל.

## מתי להשתמש
Or אומר "בוא נקים מערכת חדשה", "אני רוצה מערכת אחות ל-or-aios/or-agents", וכו'. **חייב לרוץ מסשן
`or-factory-master`** — הזהות שמקימה תשתית היא ה-broker, שרץ רק מ-workflow על main של factory.

## תנאים מקדימים (אמת לפני שמתחילים)
- **שם המערכת** (`SYSTEM_NAME`): lowercase, 6–30 תווים, `^[a-z][a-z0-9-]{4,28}[a-z0-9]$`. הוא גם שם ה-GCP project וגם שם הריפו. שאל את Or.
- **הריפו `edri2or/<SYSTEM_NAME>` קיים.** אם לא — צור אותו (auto-init) לפני שממשיכים; `bootstrap-system-infra.yml` דורש שהריפו כבר קיים.
- **backbone חי:** ל-broker SA יש את התפקידים הארגוניים (projectCreator/billing.projectManager/workloadIdentityPoolAdmin + billing.user) — ראה `docs/external-state.md`. אם צעד GCP נכשל ב-PERMISSION_DENIED שלא-חולף, זו הבדיקה הראשונה.

---

## שלב א׳ — תשתית (GCP + WIF + סודות)  ·  **costed → אישור Or**

הצעד היחיד עם עלות אמיתית מתחיל כאן (יצירת פרויקט + billing). קבל אישור מפורש מ-Or קודם.

1. Dispatch `bootstrap-system-infra.yml` עם `system_name=<SYSTEM_NAME>` (זה המנוע הקבוע; ראה ה-header שלו).
   - בסשן web ה-`dispatch_workflow` חסום — השתמש `mcp__github__actions_run_trigger` (`method=run_workflow`, `owner=edri2or`, `repo=or-factory-master`, `workflow_id=bootstrap-system-infra.yml`, `ref=main`, `inputs={system_name}`).
2. עקוב אחרי הריצה (`get_run_jobs`). היא לוקחת ~8 דק' — יש בה חלונות **propagation** של IAM (30–60s, ריטריי מובנה). זה תקין, לא תקוע.
3. **אמת בכלי קריאה לפני שממשיכים:**
   - `verify_gcp_system(<SYSTEM_NAME>)` → 11/11 (פרויקט פעיל, APIs, 2 SAs בלי מפתחות).
   - `list_system_secrets(<SYSTEM_NAME>)` → ~73 סודות (מול `or-aios/docs/secrets-index.md` כרשימת-ייחוס).
   - `list_repo_variables(edri2or, <SYSTEM_NAME>)` → `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_PROJECT_ID`, `SYSTEM_NAME`, `QUEUE_MODE`.
   - שמור את **מספר הפרויקט** (מ-verify/ה-WIF provider var) — צריך אותו למלא את התבנית.

> למה workflow ולא `gcp-action.yml`: יצירת ה-WIF provider דורשת תנאי-CEL עם `&&` ומרכאות, שה-charset-guard של gcp-action חוסם. לכן bootstrap-system-infra.yml הוא workflow אמיתי.

---

## שלב ב׳ — יסוד ריפו נקי (מ-`templates/new-system/`)

1. העתק את **כל** `templates/new-system/**` לריפו החדש (על ענף פיתוח).
2. מלא את ה-placeholders בכל הקבצים:
   - `__SYSTEM_NAME__` → שם המערכת (ב-`.mcp.json`, `AGENTS.md`, `README.md`).
   - `__GCP_PROJECT_NUMBER__` → מספר הפרויקט משלב א׳ (ב-`AGENTS.md`).
3. שמור `AGENTS.md`/`CLAUDE.md` **נקיים** — אל תוסיף דוקטרינה של or-aios. יש בהם `TODO(human)` שהארכיטקטורה תתוכנן מאפס.
4. PR → CI (secret-scan + shellcheck/yamllint) ירוק → **merge ל-main** (הכרחי: הפריסה חייבת לרוץ מ-main כי ה-WIF נעול ל-`ref=main`).

**מה שלא כלול בשלד בכוונה** (מגיע בשלב תכנון-הסוכנים): `agents/`, `workflows/n8n/*.json`, `configure-agent-router.yml`, GitHub App. ה-deploy לבדו נותן n8n חי.

---

## שלב ג׳ — פריסה (Railway + n8n + Caddy + DNS)  ·  **costed → אישור Or**

עלות: קופסת Railway חדשה (~$5–20/חודש). אישור Or.

1. Dispatch `deploy-railway-cloudflare.yml` **עם `force_caddy_redeploy=true`**.
   - ⚠️ **מהמורה מוטבעת — קרא:** בפריסה **ראשונה** של מערכת, שירות ה-Caddy נבנה מ-repo-source ש-Railway **מקבע** לקומיט. `serviceInstanceDeploy` רגיל בונה מחדש את הקומיט המקובע — **לא** את main העדכני. הקלט `force_caddy_redeploy=true` (שבתבנית) מוסיף `latestCommit:true` כדי לבנות מ-HEAD. בלעדיו, אם ה-Caddyfile שונה מאז יצירת השירות — ה-Caddy יקרוס.
2. עקוב (`get_run_jobs`). שלב "Caddy gateway smoke tests" הכי ארוך (בניית Go image של Caddy, ~5 דק').
   - אם הוא נתקע/נכשל: בדוק את לוגי שירות ה-Caddy ישירות (`tail_railway_deployment_logs`). השגיאה `malformed header matcher ... Caddyfile:100` = בנייה מקוד ישן → ודא `force_caddy_redeploy=true` ושה-deployment החדש בסטטוס SUCCESS ולא CRASHED.
3. **אמת:** `/healthz` 200, תעודת TLS, והפריסה הסתיימה מלא (כולל "Mint n8n Public API key").

---

## שלב ד׳ — הוכחת החיבורים (שער-קבלה)  ·  קריאה בלבד

- **Railway:** `verify_railway_system(<SYSTEM_NAME>)` → 6/6 (Postgres+n8n SUCCESS).
- **מסלול n8n:** `list_n8n_workflows(<SYSTEM_NAME>)` מחזיר workflows — **ולא** `n8n_key_missing`.
- **Google:** ה-bearer `workspace-mcp-bearer` כבר מונפק (שלב א׳); זהות Google משותפת (`edri2or@gmail.com`), ה-gateway מקבל את המערכת. round-trip מלא של Gmail — מסשן של המערכת החדשה.
- דווח ל-Or: השלד חי ומאומת.

---

## מהמורות מוטבעות (למה לא לחזור עליהן)
- **GCP propagation:** קריאות gcloud מול משאב טרי נכשלות ~30–60s (ריטריי רק על PERMISSION_DENIED/does-not-exist).
- **WIF ≠ gcp-action:** ה-CEL חוסם ב-charset — לכן workflow.
- **Caddy `latestCommit`/`force_caddy_redeploy`:** ראה שלב ג׳ — הבאג היחיד שעצר את or-agents.
- **`GPT_BRIDGE_TOKEN`:** ה-Caddyfile בתבנית כבר עם ברירת-מחדל fail-closed (`{$GPT_BRIDGE_TOKEN:__gpt_bridge_disabled__}`).

## נדחה לכל מערכת (לא חלק מהשלד)
- **GitHub App ייעודי** — רק כשסוכן רץ צריך לגעת ב-GitHub לבד (הבנייה של הסוכן, Claude Code, משתמשת בזהות-הסשן, לא ב-App). המנגנון: `register-system-app.yml` (משוחזר מ-git `be9fc99~1`) — 2 הקלקות של Or. הרשאות least-privilege לפי הסוכן.
- **תכנון ארגון-הסוכנים** — הליבה של המערכת החדשה; של Or. עוצרים ושואלים.

## מקורות-ייחוס
`docs/bootstrap-record.md` · `docs/external-state.md` · `CLAUDE.md §Fixed values / §Propagation patterns` · `templates/new-system/` (תבנית-הזהב) · `.github/workflows/bootstrap-system-infra.yml` (המנוע).
