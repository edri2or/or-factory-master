<!--
DEVPLAN — agent-repo-product
מנוהל על-ידי /dev-stage-factory. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
Or לא פותח אותו; הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: טיפוס-מוצר "ריפו-סוכן" (agent-repo)
slug: agent-repo-product
opened: 2026-06-17
status: active
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
| 2 | תבניות המוצר + golden אינטגריטי מקביל | in-progress | `templates/agent-repo/**`, `scripts/render-agent-repo-golden.sh`, `scripts/check-agent-repo-golden.sh`, `scripts/check-agent-repo-golden-sync.sh`, `tests/golden/agent-repo/**`, `.github/workflows/{changelog-check,pipeline-tests,playground-tests}.yml` |
| 3 | provisioner (GitHub-scaffold בלבד) | in-progress | `.github/workflows/provision-agent-repo.yml`, `monitoring/registry-exempt.txt` |
| 4 | שער-סיכון + אישור-טלגרם ל-red + MCP allowlist + דוק-מוצר | pending | `policy/agent-risk-tiers.yml`, `scripts/agent-classify.sh`, `services/mcp-server/src/agent-approval.ts`, `services/mcp-server/src/index.ts`, `services/mcp-server/src/tools.ts`, `docs/agent-repo-product.md`, `monitoring/doc-bindings.json` |
| 5 | לולאת "iterate על ריפו-סוכן חי אחד" | pending | `.github/workflows/refresh-system-agents.yml` (פרמטריזציה) או `refresh-agent-repo.yml`, `monitoring/registry-exempt.txt` |

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

**הערת התקדמות אחרונה:** התבניות + ה-golden + חיווט-CI נבנו ועברו shellcheck/yamllint/actionlint + ה-golden gate מקומית. ערוץ ה-requester = קבצים (Or אישר, בלי issues). ממתין למיזוג.

**שינוי תוכנית:** ה-MVP מספק 4 קבצי-ליבה (CLAUDE.md=@AGENTS.md, AGENTS.md, .mcp.json, ה-worker). **`.claude/settings.json` נדחה**: ה-hook של devplan דורש `scripts/` שאין לריפו-סוכן, אז לא רוצים לשגר hook שבור. מכונת `.claude/` (commands/dev-stage) היא שיפור לשלב מאוחר.

---

### שלב 3 — provisioner (GitHub-scaffold בלבד)

**Acceptance:**
- [x] `.github/workflows/provision-agent-repo.yml` — fork של החצי-GitHub-בלבד מ-`provision-system.yml` (validate → broker token → create repo → render+push scaffold (envsubst, allow-list זהה ל-golden) → bind לדלת-ה-WIF דרך `bootstrap-agent-repo-identity.sh`). **מדלג** GCP/n8n/Railway/Caddy. **הגנת-main קשוחה נדחתה** (ראה "שינוי תוכנית").
- [x] `monitoring/registry-exempt.txt` += `provision-agent-repo.yml`. (part B של golden-sync — parity של allow-list — פעיל עכשיו ועובר.)
- [ ] CI ירוק + הרצה חיה: provision של ריפו-`zz-` → לולאה עליו עוברת.

**הוכחה תפקודית (באותו שלב):** dispatch ל-`provision-agent-repo.yml` עם שם `zz-` → הריפו נולד עם 4 הקבצים + קשור לדלת → ואז dispatch ל-`agent-action.yml` עם הריפו החדש כ-worker → התוצאה חוזרת. אף פרויקט GCP לא נגע.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ה-provisioner נבנה ועבר yamllint/actionlint + parity של allow-list מול ה-golden. ממתין למיזוג + הרצה חיה (provision ריפו-`zz-` ולולאה עליו).

**שינוי תוכנית:** (1) **הגנת-main קשוחה נדחתה** — ה-broker כותב `results/<corr>.json` ישירות ל-main של ריפו-המבקש (contents); הגנת PR+CI הייתה חוסמת זאת, וצריך נתיב-כתיבה תואם-broker (ref ייעודי או PR ב-0-contexts) — hardening נפרד. ה-MVP משאיר main כתיב (ריפו פרטי). (2) ה-bind לדלת מבוצע ע"י שימוש-חוזר ב-`bootstrap-agent-repo-identity.sh` (אידמפוטנטי), לא set-repo-vars (ל-worker אין placeholders פר-ריפו).

---

### שלב 4 — שער-סיכון + אישור-טלגרם ל-red + MCP allowlist + דוק-מוצר

**Acceptance:**
- [ ] `policy/agent-risk-tiers.yml` + `scripts/agent-classify.sh` (תאום דק של `gcp-classify.sh`): green=קריאה/ניתוח/תכנון; yellow=כתיבה-עצמית/PR; red=תשתית/חציית-גבול/עריכת `.github/**`|`AGENTS.md`|`CLAUDE.md`.
- [ ] `services/mcp-server/src/agent-approval.ts` (תאום של `gcp-approval.ts`) + route `/agent-action-register` ב-`index.ts` (admin-gated) + `agent-action.yml` נוסף ל-`DISPATCHABLE_WORKFLOWS` ב-`tools.ts`. `phase=propose` ב-`agent-action.yml`.
- [ ] `docs/agent-repo-product.md` + רשומת binding ב-`monitoring/doc-bindings.json` (`templates/agent-repo/AGENTS.md.template` ↔ הדוק).
- [ ] redeploy של ה-MCP (Or-gated) + smoke.

**הוכחה תפקודית (באותו שלב):** פקודת-red → כרטיס-טלגרם; ✅ של Or מפעיל execute (כמו ה-smoke של gcp-action); `verify_mcp_server` + `factory-mcp-smoke.yml` אחרי ה-redeploy.

**הוכחת E2E (artifact):** לא-התנהגותי. (נגיעה ב-`tools.ts` תופסת את surface `factory-mcp` שהוא `enforce:false` — מייעץ, לא חוסם.)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — לולאת "iterate על ריפו-סוכן חי אחד"

**Acceptance:**
- [ ] פרמטריזציה של `refresh-system-agents.yml` לקבל מקורות `templates/agent-repo/` (או `refresh-agent-repo.yml` חדש + exempt) — סנכרון תיקון-תבנית לריפו-סוכן חי דרך PR→CI→merge.
- [ ] CI ירוק.
- [ ] `status: completed` ב-`devplans/agent-repo-product.md`.

**הוכחה תפקודית (באותו שלב):** refresh לריפו-סוכן `zz-` חי → אימות שהקובץ סונכרן.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- 2026-06-17: התוכנית נפתחה. עיגנתי מחדש לקוד החי (gcp-hands נמחק — בונים על `gcp-action`+ה-MCP). שלב 0 (פתיחת תיק) הושלם, PR #512 ירוק.
- 2026-06-17: Or בחר את מודל-המפתח — "דלת-WIF משותפת". פיצלתי את שלב 1 ל-1a (הדלת + הוכחת-מפתח) ו-1b (הלולאה המלאה), כדי להוכיח קודם שריפו בלי GCP שולף את המפתח בבטחה, ורק אז לבנות את הלולאה.
- 2026-06-17: שלב 1a הושלם והוכח חי ✅ — ריפו-ניסוי בלי GCP שלף את מפתח-Claude דרך הדלת (OIDC רגעי), המפתח לא נחשף, אפס סוד קבוע. הלבנה הקשה ביותר עובדת. הבא: שלב 1b — הלולאה המלאה (broker→worker מריץ Claude→תוצאה חוזרת).
- 2026-06-17: שלב 1b הושלם והוכח חי ✅ — **כל הלולאה עובדת מקצה-לקצה.** ה-broker שלח משימה לריפו-עובד, העובד הריץ Claude (קריאה בלבד), והתשובה חזרה לריפו-המבקש כקובץ. זו ה-**go** של ה-walking-skeleton — ההוכחה שטיפוס "ריפו-סוכן" אפשרי ובטוח. תוך כדי גיליתי שה-broker App חסר הרשאת issues, אז ערוץ-התוצאה הוא קבצים (לא issues) — נמנע שינוי ל-App המרכזי. **שלב 1 סגור.**
- 2026-06-17: Or הכריע סופית — **קבצים, בלי issues** (אחרי הוכחה: קבצים מנצחים במשתלם/יציב/אמין, issues עדיפים רק לנראוּת-אנושית; נמנע הרחבת-כוח ל-App המרכזי). שלב 2 נבנה: `templates/agent-repo/` (CLAUDE.md=@AGENTS.md, AGENTS.md, .mcp.json עם server factory בלבד, ה-worker) + golden מקביל + חיווט-CI. הכול עבר את השערים מקומית. הבא: שלב 3 — provisioner.
