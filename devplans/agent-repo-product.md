<!--
DEVPLAN — agent-repo-product
מנוהל על-ידי /dev-stage-factory. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
Or לא פותח אותו; הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: טיפוס-מוצר "ריפו-סוכן" (agent-repo)
slug: agent-repo-product
opened: 2026-06-17
status: completed
closed: 2026-06-17
---

# תוכנית פיתוח — טיפוס-מוצר "ריפו-סוכן"

## מטרה

להוסיף לפקטורי טיפוס-מוצר **נוסף** (לא מחליף את ה-n8n): **"ריפו-סוכן"** — ריפו פרטי קל
שקובץ-ההוראות שלו הוא `CLAUDE.md`(=@AGENTS.md) + `AGENTS.md` + `.claude/` + `.mcp.json` +
workflow דק, מופעל ע"י Claude Code, ויודע לשלוח/לקבל יחידות-עבודה מריפו-סוכנים אחרים
אוטומטית ובבטחה — דרך **broker מרכזי**. בלי GCP/n8n/Railway/Caddy. מודל ה-n8n הקיים
({reply}/agent-router) לא נוגעים בו. הגל הראשון (נחשון/נתן/ספי) הוא **פיתוח נפרד** אחרי
שהתשתית הזו סגורה ומוכחת.

> **יש יכולת חדשה** — הפועל החדש: "ריפו מריץ עבודה שהתקבלה, headless, ומחזיר תוצאה
> ניתנת-לניתוב דרך ה-broker". לכן Step 0 של capability-first **לא מדולג**: שלב 1
> (ה-walking-skeleton) הוא ההוכחה-החיה של הטיפוס הזה — לא ה-`e2e-verify` של or-edri-4/טלגרם
> (לריפו-סוכן אין נתיב-קלט כזה; אומת — אף surface אכוף ב-`e2e-surfaces.json` לא תופס
> `templates/agent-repo/**`).

> **הצורה החיה (אחרי drift — gcp-hands נמחק, PR #506):** ה-broker = or-factory-master =
> ה-MCP + workflow `agent-action.yml` בסגנון `gcp-action.yml` (`workflow_dispatch`, classify
> green/yellow/red, red → אישור-טלגרם דרך ה-MCP), token מתוחם per-request דרך
> `generate-app-token.sh`, audit דרך `emit-event.sh`. בונים על `gcp-action.yml` +
> `publish-static-site` + ה-MCP — **לא** על repository_dispatch/issue-comment של gcp-hands.

> **החלטת מודל-המפתח (Or אישר 2026-06-17): דלת-WIF משותפת (אופציה B).** ריפו-סוכן (בלי GCP
> משלו) מקבל את `anthropic-api-key` בזמן ריצה דרך **GitHub OIDC קצר-מועד → WIF → SA זמן-ריצה
> מינימלי** — אפס סוד קבוע בריפו (בדיוק D6/D9 של המחקר). **מיקום הדלת (אילוץ הרשאות):** ה-broker
> לא יכול לבנות pool/provider/SA בפרויקט ה-control (יש לו רק `secretmanager.admin` שם, לא
> `workloadIdentityPoolAdmin`/`serviceAccountAdmin`). לכן הדלת (pool `agent-repo-pool` /
> provider `github-agent-repo-provider` / SA `agent-repo-runtime-sa`) יושבת ב-`factory-test-25`
> (שם ה-broker admin, ליד זהות ה-sandbox), וה-SA מקבל `secretAccessor` על **סוד יחיד** —
> `anthropic-api-key` שב-control (binding per-secret, חוצה-פרויקט; בתוך ה-`secretmanager.admin`
> של ה-broker). CEL: org `edri2or` + `main` בלבד; הרשאת impersonation היא per-agent-repo
> (`workloadIdentityUser`), כך שרק ריפו-סוכן מאושר במפורש יכול להשתמש בדלת.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | פתיחת תיק-פיתוח + capability-card skeleton | completed | `devplans/agent-repo-product.md`, `changelog.d/2026-06-17-agent-repo-product.md`, `docs/capability-cards/agent-broker-handoff.md` |
| 1a | "הדלת" — WIF משותף + הוכחת-מפתח (ריפו בלי GCP שולף את מפתח Claude) | completed | `scripts/bootstrap-agent-repo-identity.sh`, `.github/workflows/bootstrap-agent-repo-identity.yml`, `.github/workflows/agent-skeleton-seed.yml`, `spikes/agent-skeleton/cred-probe.yml`, `monitoring/registry-exempt.txt` |
| 1b | "הלולאה" — broker → worker מריץ Claude → תוצאה חוזרת ל-requester (go/no-go) | completed | `.github/workflows/agent-action.yml`, `spikes/agent-skeleton/agent-main.yml`, `monitoring/registry-exempt.txt`, `docs/capability-cards/agent-broker-handoff.md` |
| 2 | תבניות המוצר + golden אינטגריטי מקביל | completed | `templates/agent-repo/**`, `scripts/render-agent-repo-golden.sh`, `scripts/check-agent-repo-golden.sh`, `scripts/check-agent-repo-golden-sync.sh`, `tests/golden/agent-repo/**`, `.github/workflows/{changelog-check,pipeline-tests,playground-tests}.yml` |
| 3 | provisioner (GitHub-scaffold בלבד) | completed | `.github/workflows/provision-agent-repo.yml`, `monitoring/registry-exempt.txt` |
| 4a | שער-סיכון — ה-classifier (policy + script), נבדק לבד | completed | `policy/agent-risk-tiers.yml`, `scripts/agent-classify.sh` |
| 4b | חיווט ל-broker (propose/execute) + גשר-אישור-טלגרם ב-MCP + allowlist + דוק-מוצר | completed | `.github/workflows/agent-action.yml`, `services/mcp-server/src/agent-approval.ts`, `services/mcp-server/src/index.ts`, `services/mcp-server/src/tools.ts`, `services/mcp-server/test/agent-approval.test.mjs`, `docs/agent-repo-product.md`, `monitoring/doc-bindings.json` |
| 5 | לולאת "iterate על ריפו-סוכן חי אחד" | completed | `.github/workflows/refresh-agent-repo.yml`, `templates/agent-repo/.github/workflows/agent-main.yml`, `tests/golden/agent-repo/MANIFEST.sha256`, `monitoring/registry-exempt.txt` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב* — לא "CI ירוק"
> לבד. ה-walking-skeleton (שלב 1) הוא הלבנה הקשה והוא נבנה ראשון (capability-first).
>
> **כל קבצי-ההתנהגות פה לא-n8n:** אף שלב לא נוגע ב-`workflows/n8n/*.json` או
> `configure-agent-router.yml`, ולכן **הוכחת E2E = "לא-התנהגותי"** בכל השלבים, ושער ה-E2E של
> or-edri-4 הוא no-op (אומת מול `e2e-surfaces.json`).
>
> **גל ראשון (נחשון/נתן/ספי):** פיתוח נפרד שייפתח אחרי סגירת התוכנית הזו (W18–W19).

---

### שלב 0 — פתיחת תיק-פיתוח + capability-card skeleton

**Acceptance:**
- [ ] `devplans/agent-repo-product.md` נוצר (`status: active`) — משחרר את שער ה-devplan.
- [ ] `changelog.d/2026-06-17-agent-repo-product.md` נוסף.
- [ ] `docs/capability-cards/agent-broker-handoff.md` נוצר כ-skeleton עם `verdict: pending`.
- [ ] CI ירוק (PR של קבצי-md בלבד — אף שער-קוד לא מופעל).

**הוכחה תפקודית (באותו שלב):** "תוכן בלבד" — שלב תיעוד/scaffolding בלי התנהגות רצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הקבצים נוצרו; השלב נסגר על CI ירוק. עוצרים לפני שלב 1 (costed) לאישור Or.

**שינוי תוכנית:** —

---

### שלב 1a — "הדלת": WIF משותף + הוכחת-מפתח

הלבנה הקשה והחדשה: ריפו בלי GCP משלו שולף את `anthropic-api-key` בזמן ריצה דרך OIDC קצר-מועד.
מוכיחים אותה לבד (bottom-up) לפני בניית הלולאה.

**Acceptance:**
- [ ] `scripts/bootstrap-agent-repo-identity.sh` — בונה אידמפוטנטית את `agent-repo-pool`/`github-agent-repo-provider`/`agent-repo-runtime-sa` ב-`factory-test-25` (CEL: org `edri2or` + `main`), binding `workloadIdentityUser` per-repo, ו-`secretAccessor` על סוד יחיד `anthropic-api-key` ב-control. Hard-guards: WIF רק ב-`factory-test-25`, סוד רק ב-control.
- [ ] `.github/workflows/bootstrap-agent-repo-identity.yml` — מריץ את הסקריפט כ-broker (WIF, main-locked), קלט `bind_repos`.
- [ ] `.github/workflows/agent-skeleton-seed.yml` (throwaway) — יוצר ריפו-`zz-` ומזריע אליו את `spikes/agent-skeleton/*.yml` דרך token מתוחם.
- [ ] `spikes/agent-skeleton/cred-probe.yml` — ב-worker: auth דרך הדלת → קורא `anthropic-api-key` → מדפיס **רק אורך** (אף פעם לא הערך).
- [ ] `monitoring/registry-exempt.txt` += `bootstrap-agent-repo-identity.yml`, `agent-skeleton-seed.yml`.
- [ ] מוזג ל-main; הדלת הורצה; `zz-agentskel-worker` נוצר+נזרע+נקשר; ה-probe רץ והצליח.

**הוכחה תפקודית (באותו שלב):** ריצת ה-`cred-probe` ב-`zz-agentskel-worker` (ריפו בלי GCP) חוזרת
PASS עם `length>0` — כלומר שלפה את המפתח דרך OIDC קצר-מועד, **בלי סוד קבוע ובלי שהמפתח מודפס**.
נצפה דרך `get_workflow_run`/`get_run_jobs` של אותה ריצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ **הוכח חי (GO).** הדלת נבנתה ואומתה (PRs #512+#513 מוזגו; `agent-repo-pool`/`github-agent-repo-provider` ACTIVE ב-factory-test-25). ה-seed יצר+זרע את `zz-agentskel-worker` והריץ את ה-probe: ריצת `cred-probe` (worker run 27686971862) → `conclusion=success`, לוג: "read anthropic-api-key via short-lived OIDC. length=108 chars (value masked, never printed). No standing secret was used." כלומר ריפו בלי GCP משלו שלף את המפתח דרך OIDC קצר-מועד, הערך לא נחשף. הלבנה הקשה עובדת.

**שינוי תוכנית:** מודל-המפתח עוגן ל-WIF משותף (אופציה B, אישור Or 2026-06-17); השלב המקורי "שלב 1" פוצל ל-1a (הדלת) + 1b (הלולאה) כדי להוכיח את לבנת-המפתח לבד לפני הלולאה. מיקום הדלת = `factory-test-25` (אילוץ הרשאות broker ב-control).

---

### שלב 1b — "הלולאה": broker → worker מריץ Claude → תוצאה חוזרת (go/no-go)

**Acceptance:**
- [ ] `.github/workflows/agent-action.yml` (broker): `workflow_dispatch`, קלטים מתוקפי-charset, `if: refs/heads/main`, `permissions:{contents:read,id-token:write}`. מנפיק dispatch-token מתוחם, מפעיל את ה-worker, **polling** עד טרמינל, מוריד artifact, מפרסם תוצאה ל-issue של ה-requester, פולט 4 אירועי `factory.agent_action.*`.
- [ ] `spikes/agent-skeleton/agent-main.yml` (worker): `workflow_dispatch`, auth דרך הדלת (1a), מריץ `anthropics/claude-code-action@v1` read-only (`Read,Grep,Glob`), כותב `result/<corr>.json` ומעלה artifact. בלי git push, בלי סוד קבוע.
- [ ] `monitoring/registry-exempt.txt` += `agent-action.yml` (dispatch-only).
- [ ] שני ריפו-ניסוי `zz-` (requester+worker) קיימים ונזרעו. הריצה החיה עברה; capability-card מעודכן עם go/no-go.

**הוכחה תפקודית (באותו שלב):** ריצה חיה — dispatch ל-`agent-action.yml` → ה-issue של ה-requester
מציג תוצאת-Claude → לוג ה-worker מאשר אפס-סוד-קבוע + אפס-יציאה-החוצה → 4 אירועי emit בלוג →
כל token חוצה-ריפו מתוחם לריפו-בודד. **GO רק אם כל הקריטריונים ב-capability-card מתקיימים.**

**הוכחת E2E (artifact):** לא-התנהגותי (ה-walking-skeleton הוא ההוכחה החיה, לא `e2e-verify`).

**הערת התקדמות אחרונה:** ✅ **הוכח חי מקצה-לקצה (GO).** broker run 27688427006 → dispatch ל-worker → worker run 27688451409 (`conclusion=success`, Claude קריאה-בלבד) → ה-broker משך את ה-artifact וכתב את התשובה ל-`edri2or/zz-agentskel-requester/results/skel-loop-1.json` (JSON תקין, `status:ok`, התשובה של Claude). שלושת אירועי ה-audit (started/dispatched/completed) הגיעו ל-Axiom. כל token חוצה-ריפו מתוחם לריפו-בודד. תיקון בדרך: ה-broker App חסר `issues` → ערוץ ה-requester עבר לקבצים (`contents`). **שלב 1 (ה-walking-skeleton) הושלם — ההוכחה-החיה של הטיפוס הושגה.**

**שינוי תוכנית:** —

---

### שלב 2 — תבניות המוצר + golden אינטגריטי מקביל

**Acceptance:**
- [x] `templates/agent-repo/{CLAUDE.md.template,AGENTS.md.template,.mcp.json.template,.github/workflows/agent-main.yml}` — מראה של `templates/system/` (ה-.mcp.json עם server `factory` בלבד; ה-worker מקודם מ-`spikes/`). (`.claude/` machinery נדחה — ראה "שינוי תוכנית".)
- [x] golden מקביל: `scripts/render-agent-repo-golden.sh` (allow-list של 7 משתנים), `scripts/check-agent-repo-golden.sh`, `scripts/check-agent-repo-golden-sync.sh` (מפתח על `^templates/agent-repo/`), `tests/golden/agent-repo/{MANIFEST.sha256,rendered/AGENTS.md,rendered/CLAUDE.md}`.
- [x] חיווט CI: compare ב-Playground tests (`check-agent-repo-golden.sh`), sync-gate ב-Changelog gates (`check-agent-repo-golden-sync.sh`), והעובד נוסף ל-yamllint ב-pipeline-tests.
- [ ] CI ירוק (אחרי דחיפה).

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-agent-repo-golden.sh` עובר מקומית (✅); ה-golden הופק (4 קבצים) ומקובע. שינוי-בייט מכוון בתבנית יפיל את השער עד רענון golden.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם ומוזג. התבניות + ה-golden + חיווט-CI נבנו ועברו את כל השערים; ה-golden משמש את ה-provisioner (שלב 3) וה-refresh (שלב 5). ערוץ ה-requester = קבצים (Or אישר, בלי issues). (תיקון-סטטוס: השורה נותרה "in-progress" בטעות אחרי המיזוג — נסגר בניקוי.)

**שינוי תוכנית:** ה-MVP מספק 4 קבצי-ליבה (CLAUDE.md=@AGENTS.md, AGENTS.md, .mcp.json, ה-worker). **`.claude/settings.json` נדחה**: ה-hook של devplan דורש `scripts/` שאין לריפו-סוכן, אז לא רוצים לשגר hook שבור. מכונת `.claude/` (commands/dev-stage) היא שיפור לשלב מאוחר.

---

### שלב 3 — provisioner (GitHub-scaffold בלבד)

**Acceptance:**
- [x] `.github/workflows/provision-agent-repo.yml` — fork של החצי-GitHub-בלבד מ-`provision-system.yml` (validate → broker token → create repo → render+push scaffold (envsubst, allow-list זהה ל-golden) → bind לדלת-ה-WIF דרך `bootstrap-agent-repo-identity.sh`). **מדלג** GCP/n8n/Railway/Caddy. **הגנת-main קשוחה נדחתה** (ראה "שינוי תוכנית").
- [x] `monitoring/registry-exempt.txt` += `provision-agent-repo.yml`. (part B של golden-sync — parity של allow-list — פעיל עכשיו ועובר.)
- [ ] CI ירוק + הרצה חיה: provision של ריפו-`zz-` → לולאה עליו עוברת.

**הוכחה תפקודית (באותו שלב):** dispatch ל-`provision-agent-repo.yml` עם שם `zz-` → הריפו נולד עם 4 הקבצים + קשור לדלת → ואז dispatch ל-`agent-action.yml` עם הריפו החדש כ-worker → התוצאה חוזרת. אף פרויקט GCP לא נגע.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ **הוכח חי (completed).** מוזג (#518). provision של `zz-agentrepo-prov1` (run 27690894574, success) → הריפו נולד נכון (AGENTS.md מרונדר מלא, קשור לדלת). אז לולאת broker עם הריפו החדש כ-worker (run 27691008815, success) → `results/prov-loop-1.json` נכתב ל-`zz-agentskel-requester` עם תשובת-Claude. כלומר **provision → ריפו-סוכן עובד, מקצה לקצה.** ניקוי קבצי-ה-skeleton + ריפויי-ה-`zz-` נדחה ל-follow-up קצר (ראה יומן).

**שינוי תוכנית:** (1) **הגנת-main קשוחה נדחתה** — ה-broker כותב `results/<corr>.json` ישירות ל-main של ריפו-המבקש (contents); הגנת PR+CI הייתה חוסמת זאת, וצריך נתיב-כתיבה תואם-broker (ref ייעודי או PR ב-0-contexts) — hardening נפרד. ה-MVP משאיר main כתיב (ריפו פרטי). (2) ה-bind לדלת מבוצע ע"י שימוש-חוזר ב-`bootstrap-agent-repo-identity.sh` (אידמפוטנטי), לא set-repo-vars (ל-worker אין placeholders פר-ריפו).

---

### שלב 4 — שער-סיכון + אישור-טלגרם ל-red + MCP allowlist + דוק-מוצר

**Acceptance:**
- [x] `policy/agent-risk-tiers.yml` + `scripts/agent-classify.sh` (תאום דק של `gcp-classify.sh`): green=קריאה/ניתוח/תכנון; yellow=כתיבה-עצמית/PR; red=תשתית/חציית-גבול/עריכת `.github/**`|`AGENTS.md`|`CLAUDE.md`. **[4a, מוזג]**
- [x] `services/mcp-server/src/agent-approval.ts` (תאום של `gcp-approval.ts`, אבל יחידת-עבודה של 4 שדות + task freeform → base64(JSON) בתוך הסנטינלים `⟦AGENT⟧…⟦/AGENT⟧`; corr בכפתור = corr ב-blob) + route `/agent-action-register` ב-`index.ts` (admin-gated) + ניתוב-callback (`agentok:`/`agentno:`) + `agent-action.yml` נוסף ל-`DISPATCHABLE_WORKFLOWS` ב-`tools.ts` **עם חסם `phase=execute`** (execute רק דרך גשר-הטלגרם). **[4b]**
- [x] `agent-action.yml` משוכתב ל-`phase=propose|execute`: classify (`agent-classify.sh`) → green/yellow מתווך מיד; red → POST `/agent-action-register` (לא רץ); execute רץ ללא-תלות-tier (אחרי ✅). **[4b]**
- [x] בדיקות יחידה `services/mcp-server/test/agent-approval.test.mjs` (10/10 עובר) + כל החבילה (128/128) + `tsc` נקי + yamllint נקי. **[4b]**
- [x] `docs/agent-repo-product.md` + רשומת binding ב-`monitoring/doc-bindings.json` (`templates/agent-repo/AGENTS.md.template` ↔ הדוק). **[4b]**
- [x] מוזג ל-main (#522, כל ה-CI ירוק); redeploy של ה-MCP (run 27693405042, push-triggered מהמיזוג, success) + `/health` 200.
- [x] **הוכחה חיה (GO) ✅:** משימת-red → כרטיס-טלגרם → ✅ של Or → execute רץ ומחזיר תוצאה.

**הוכחה תפקודית (באותו שלב):** משימת-red → כרטיס-טלגרם; ✅ של Or מפעיל execute (כמו ה-smoke של gcp-action). `verify_mcp_server` לא רלוונטי ל-MCP של ה-control (הוא מאמת MCP פר-מערכת ב-Railway) — האימות הוא `/health` 200 + צעד ה-issuer בתוך ה-deploy.

**הוכחת E2E (artifact):** לא-התנהגותי. (נגיעה ב-`tools.ts` תופסת את surface `factory-mcp` שהוא `enforce:false` — מייעץ, לא חוסם.)

**הערת התקדמות אחרונה:** ✅ **הושלם והוכח חי מקצה-לקצה (GO).** propose-run 27693714834: Classify→red ✅, "Send Telegram approval card"→success (POST `/agent-action-register`→200) ✅, "Broker the work"→**skipped** ✅ (אדום לא מתווך בלי ✅). אור לחץ ✅ → ה-callback של ה-MCP שחזר את יחידת-העבודה מטקסט-הכרטיס ודיספּטצ׳ את execute (run 27693777393, `triggering_actor=factory-master-broker[bot]` — דרך נתיב-האישור, לא דרכי) → ה-broker הריץ את העובד (`zz-agentrepo-prov1`, Claude קריאה-בלבד) → התשובה נכתבה ל-`zz-agentskel-requester/results/agent-redproof-1.json` (`status:ok`, `correlation_id` תואם). **שער ה-RED עובד: AI מציע, Or מאשר, רק ✅ מריץ.**

**שינוי תוכנית:** שלב 4 פוצל ל-4a (classifier, נבדק לבד) ו-4b (חיווט+MCP+redeploy). **חסם-execute חדש ב-`tools.ts`:** מאחר ש-`agent-action.yml` חייב להיות ב-allowlist כדי ש-requester יוכל לבקש עבודה (`phase=propose`), הוספתי חסם נקודתי שמסרב `phase=execute` דרך הכלי — כך ש-execute נשאר נגיש רק דרך callback-הטלגרם (שער-ה-red לא ניתן לעקיפה). זו ההקבלה ל-`gcp-action.yml` שכולו מחוץ ל-allowlist.

---

### שלב 5 — לולאת "iterate על ריפו-סוכן חי אחד"

**Acceptance:**
- [x] `refresh-agent-repo.yml` חדש (לא פרמטריזציה של תאום-המערכת — נקי יותר, כמו ה-fork ב-provision): מנפיק token מתוחם, משכפל, מעתיק non-.template subpaths, **דוחף ישירות ל-main** (main של ריפו-סוכן כתיב), אידמפוטנטי, מסרב `.template`/control/factory. `source_ref` לפרוּב-מענף.
- [x] `monitoring/registry-exempt.txt` += `refresh-agent-repo.yml` (dispatch-only).
- [x] diff להוכחת ה-push: `timeout-minutes: 15` ל-job של העובד (`agent-main.yml`) + רענון golden.
- [x] מוזג ל-main (#524, כל ה-CI ירוק).
- [x] **הוכחה חיה (GO) ✅:** refresh ל-`zz-agentrepo-prov1` → `timeout-minutes: 15` נחת בקובץ החי.

**הוכחה תפקודית (באותו שלב):** refresh לריפו-סוכן `zz-` חי → אימות שהקובץ סונכרן (push אמיתי, לא רק no-diff).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ **הושלם והוכח חי (GO).** refresh-run 27694931374 (success): הניב token מתוחם ל-`zz-agentrepo-prov1`, שכפל, זיהה diff אמיתי (ה-`agent-main.yml` החי קדם ל-`timeout-minutes`), ודחף ישירות ל-main. אימות: קריאת `zz-agentrepo-prov1/.github/workflows/agent-main.yml` החי מראה `timeout-minutes: 15`. **לולאת ה-refresh עובדת — אפשר לְאַיטֵר על העובד ולהחיל על ריפו-סוכן חי, 0 קליקים, 0 עלות.**

**שינוי תוכנית:** בחרתי **`refresh-agent-repo.yml` ייעודי** (לא פרמטריזציה של `refresh-system-agents.yml`) — הלוגיקה דומה אבל פשוטה יותר (אין PR מוגן, אין reimport ל-n8n, direct-push), אז fork נקי עדיף על צימוד. ההוכחה דורשת diff אמיתי, אז כרכתי שיפור-עובד קטן (`timeout-minutes`) — זה גם בדיוק תרחיש-השימוש ("לְאַיטֵר על העובד, להחיל על ריפו-סוכן חי").

---

## יומן ל-Or (עברית)

- 2026-06-17: התוכנית נפתחה. עיגנתי מחדש לקוד החי (gcp-hands נמחק — בונים על `gcp-action`+ה-MCP). שלב 0 (פתיחת תיק) הושלם, PR #512 ירוק.
- 2026-06-17: Or בחר את מודל-המפתח — "דלת-WIF משותפת". פיצלתי את שלב 1 ל-1a (הדלת + הוכחת-מפתח) ו-1b (הלולאה המלאה), כדי להוכיח קודם שריפו בלי GCP שולף את המפתח בבטחה, ורק אז לבנות את הלולאה.
- 2026-06-17: שלב 1a הושלם והוכח חי ✅ — ריפו-ניסוי בלי GCP שלף את מפתח-Claude דרך הדלת (OIDC רגעי), המפתח לא נחשף, אפס סוד קבוע. הלבנה הקשה ביותר עובדת. הבא: שלב 1b — הלולאה המלאה (broker→worker מריץ Claude→תוצאה חוזרת).
- 2026-06-17: שלב 1b הושלם והוכח חי ✅ — **כל הלולאה עובדת מקצה-לקצה.** ה-broker שלח משימה לריפו-עובד, העובד הריץ Claude (קריאה בלבד), והתשובה חזרה לריפו-המבקש כקובץ. זו ה-**go** של ה-walking-skeleton — ההוכחה שטיפוס "ריפו-סוכן" אפשרי ובטוח. תוך כדי גיליתי שה-broker App חסר הרשאת issues, אז ערוץ-התוצאה הוא קבצים (לא issues) — נמנע שינוי ל-App המרכזי. **שלב 1 סגור.**
- 2026-06-17: Or הכריע סופית — **קבצים, בלי issues** (אחרי הוכחה: קבצים מנצחים במשתלם/יציב/אמין, issues עדיפים רק לנראוּת-אנושית; נמנע הרחבת-כוח ל-App המרכזי). שלב 2 נבנה: `templates/agent-repo/` (CLAUDE.md=@AGENTS.md, AGENTS.md, .mcp.json עם server factory בלבד, ה-worker) + golden מקביל + חיווט-CI. הכול עבר את השערים מקומית. הבא: שלב 3 — provisioner.
- 2026-06-17: שלב 3 הושלם והוכח חי ✅ — ה-provisioner יצר ריפו-סוכן אמיתי מהתבנית (`zz-agentrepo-prov1`, נולד נכון), קשר אותו לדלת, ולולאת-broker רצה עליו בהצלחה (התשובה חזרה למבקש כקובץ). **provision → ריפו-סוכן עובד.** הגנת-main קשוחה נדחתה (תיעוד ב-changelog). **שלבים 0–3 סגורים — טיפוס "ריפו-סוכן" בנוי ומוכח מקצה-לקצה.** נותרו: שלב 4 (שער-סיכון+אישור-טלגרם, costed — redeploy ל-MCP), שלב 5 (לולאת-refresh), ניקוי spike/zz-, ושלב 6 (גל ראשון — פיתוח נפרד).
- 2026-06-17: שלב 4 פוצל ל-4a (classifier) ו-4b (חיווט+MCP+redeploy). **4a נבנה ונבדק לבד ✅** — `agent-classify.sh` (סורק red-flags על משימה freeform: RED→YELLOW→GREEN ברירת-מחדל) הוכח על דגימות green/yellow/red. כי המשימה היא טקסט חופשי (לא פקודה מובנית כמו gcloud), זה שער-היוריסטי הגנתי + הכנה ל-workers עתידיים עם כתיבה (ה-worker הנוכחי read-only = בטוח ממילא). הבא: 4b — חיווט ל-broker + גשר-טלגרם ב-MCP + redeploy (costed).
- 2026-06-17: **קוד 4b הושלם ✅ (מקומית).** בניתי את גשר-האישור ב-MCP (`agent-approval.ts`) בדיוק כמו ה-GCP, רק שהמשימה היא 4 שדות + טקסט חופשי, אז כל היחידה נוסעת כ-base64 בתוך טקסט-הכרטיס (כך טלגרם מחזיר אותה בלחיצה, בלי DB). חיברתי route + ניתוב ב-`index.ts`, הוספתי את `agent-action.yml` ל-allowlist עם חסם שמונע עקיפת שער-ה-red, ושכתבתי את ה-broker ל-propose/execute עם הסיווג. 10 בדיקות-יחידה חדשות + 128 הכלליות + tsc + yamllint — הכול ירוק. הבא (Or אישר "תעשה הכל"): מיזוג → redeploy ל-MCP (costed) → הוכחה חיה: אשלח לך כרטיס-טלגרם של משימת-red, תלחץ ✅, וה-execute ירוץ ויחזיר תוצאה.
- 2026-06-17: **שלב 4b הושלם והוכח חי מקצה-לקצה ✅ — שער ה-RED עובד.** מוזג (#522, CI ירוק), ה-MCP נפרס מחדש (הroute החדש חי, `/health` 200). הרצתי משימה "אדומה" (מכילה "delete"): המערכת סיווגה אותה אדום, **עצרה**, ושלחה לאור כרטיס-אישור בטלגרם. אור לחץ ✅ → המשימה רצה (סוכן-עובד קרא וניתח, קריאה-בלבד) → התשובה נכתבה אוטומטית לריפו-המבקש. כלומר: שום משימה מסוכנת לא רצה בלי אישור אנושי מפורש — בדיוק כמו OIL ו-gcp-action. **שלבים 0–4 סגורים — טיפוס "ריפו-סוכן" בנוי, מתוקף-סיכון, ומוכח חי.** נותרו: שלב 5 (לולאת-refresh), ניקוי spike/zz-, ושלב 6 (גל ראשון — פיתוח נפרד). עוצר בגבול לאישור אור מה הלאה.
- 2026-06-17: אור בחר שלב 5. **שלב 5 הושלם והוכח חי ✅ — לולאת ה-refresh.** בניתי `refresh-agent-repo.yml` (תאום ה-refresh של המערכות, אבל direct-push כי main של ריפו-סוכן כתיב), הוספתי שיפור-עמידוּת קטן לעובד (`timeout-minutes:15`) — שגם שימש כ-diff להוכחה — מוזג (#524), והרצתי refresh חי על `zz-agentrepo-prov1`: ה-`timeout-minutes` נחת בקובץ החי. כלומר אפשר עכשיו לְאַיטֵר על לוגיקת-העובד ולהחיל אותה על ריפו-סוכן חי בלי לבנות אותו מחדש, בלי קליקים ובלי עלות. **שלבים 0–5 סגורים — טיפוס "ריפו-סוכן" בנוי, מתוקף-סיכון, מוכח חי, וניתן-לאיטרציה.** נשאר רק ניקוי (קבצי-spike + 3 ריפויי zz-) לפני סגירת התיק; שלב 6 (נחשון/נתן/ספי) הוא פיתוח נפרד. עוצר בגבול.
- 2026-06-17: אור בחר "רק קבצי-ניסוי" לניקוי. **התיק נסגר (`status: completed`).** מחקתי את קבצי-הספייק (`spikes/agent-skeleton/*`, `agent-skeleton-seed.yml`; רשומת ה-exempt הפכה ל-tombstone כדי לרצות את שער ה-watchdog למחיקה). תיקנתי סטטוס תקוע של שלב 2 (נשאר "in-progress" בטעות אחרי המיזוג). **3 ריפויי ה-`zz-` נשארים בכוונה** (לבקשת Or) — מחיקתם פעולה עצמאית דרך אישור-טלגרם, מתי שיבחר. ⚠️ **[תוקן 17.6 — לא נכון יותר: שלושתם נמחקו בפועל אחרי אישור-טלגרם. ראה תיקון בשורה הבאה.]** **שלב 6 (גל ראשון — נחשון/נתן/ספי) ייפתח כפיתוח נפרד עם devplan משלו.** טיפוס-המוצר "ריפו-סוכן" הושלם והוכח מקצה-לקצה.
- 2026-06-17 (תיקון-רשומה): **3 ריפויי ה-`zz-` נמחקו בפועל — אומת 404.** אחרי הסגירה למעלה, אור אישר את המחיקה בכרטיס-הטלגרם (proposal run `27696837645`, correlation `del-zz-agentrepo-1`), ושלושתם — `zz-agentskel-worker`, `zz-agentskel-requester`, `zz-agentrepo-prov1` — נמחקו (אומת חי: `get_repo` → 404 לשלושתם). המשפט "נשארים בכוונה" למעלה היה נכון ברגע #526 והוחלף כשאור אישר את המחיקה. **שורש הפער:** שלחתי את הכרטיס והמשכתי הלאה בלי לאמת+לתעד את התוצאה, והתיק כבר היה סגור — אז הרשומה נתקעה על "נשמרו" וסשן מאוחר נאלץ לנחש. **חוסם להבא:** CLAUDE.md §7 ("אמת ותעד שינויי-מצב לפני סגירה"), צעד "Verify AND record" בסקיל `delete-repos`, ו-audit-עם-שמות-ריפו ב-`repo-approval.ts`.
