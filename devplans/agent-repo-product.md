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

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | פתיחת תיק-פיתוח + capability-card skeleton | in-progress | `devplans/agent-repo-product.md`, `changelog.d/2026-06-17-agent-repo-product.md`, `docs/capability-cards/agent-broker-handoff.md` |
| 1 | שלד-מהלך (walking skeleton) — ההוכחה-החיה (go/no-go) | pending | `.github/workflows/agent-action.yml`, `spikes/agent-skeleton/agent-main.yml`, `monitoring/registry-exempt.txt`, `docs/capability-cards/agent-broker-handoff.md` |
| 2 | תבניות המוצר + golden אינטגריטי מקביל | pending | `templates/agent-repo/**`, `scripts/render-agent-repo-golden.sh`, `scripts/check-agent-repo-golden.sh`, `scripts/check-agent-repo-golden-sync.sh`, `tests/golden/agent-repo/**`, `.github/workflows/{changelog-check,pipeline-tests}.yml` |
| 3 | provisioner (GitHub-scaffold בלבד) | pending | `.github/workflows/provision-agent-repo.yml`, `monitoring/registry-exempt.txt`, `tests/golden/agent-repo/**` |
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

### שלב 1 — שלד-מהלך (walking skeleton) — ההוכחה-החיה

**Acceptance:**
- [ ] `.github/workflows/agent-action.yml` (broker): `workflow_dispatch`, קלטים מתוקפי-charset, `if: refs/heads/main`, `permissions:{contents:read,id-token:write}`. מנפיק dispatch-token מתוחם, מפעיל את ה-worker, **polling** עד טרמינל, מוריד artifact, מפרסם תוצאה ל-issue של ה-requester, פולט 4 אירועי `factory.agent_action.*`.
- [ ] `spikes/agent-skeleton/agent-main.yml` (worker): `workflow_dispatch`, קורא `anthropic-api-key` (WIF, מוסתר), מריץ `anthropics/claude-code-action@v1` read-only (`Read,Grep,Glob`), כותב `result/<corr>.json` ומעלה artifact. בלי git push, בלי סוד קבוע.
- [ ] `monitoring/registry-exempt.txt` += `agent-action.yml` (dispatch-only).
- [ ] שני ריפו-ניסוי `zz-` נוצרו ונזרעו (דרך `create-throwaway-repo.yml` + push מתוחם).
- [ ] CI ירוק. הריצה החיה עברה והוכרעה go/no-go ב-capability-card.

**הוכחה תפקודית (באותו שלב):** ריצה חיה — dispatch ל-`agent-action.yml` → ה-issue של ה-requester
מציג תוצאת-Claude → לוג ה-worker מאשר אפס-סוד-קבוע + אפס-יציאה-החוצה → 4 אירועים ב-Axiom →
כל token חוצה-ריפו מתוחם לריפו-בודד. **GO רק אם כל ארבעת התנאים מתקיימים.**

**הוכחת E2E (artifact):** לא-התנהגותי (ה-walking-skeleton הוא ההוכחה החיה, לא `e2e-verify`).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — תבניות המוצר + golden אינטגריטי מקביל

**Acceptance:**
- [ ] `templates/agent-repo/{CLAUDE.md.template,AGENTS.md.template,.mcp.json.template,.claude/settings.json,.github/workflows/agent-main.yml}` — מראה של `templates/system/` (ה-.mcp.json עם server `factory` בלבד; ה-worker מקודם מ-`spikes/`).
- [ ] golden מקביל: `scripts/render-agent-repo-golden.sh` (+allow-list קטן יותר), `scripts/check-agent-repo-golden.sh`, `scripts/check-agent-repo-golden-sync.sh` (מפתח על `^templates/agent-repo/`), `tests/golden/agent-repo/{MANIFEST.sha256,rendered/AGENTS.md,rendered/CLAUDE.md}`.
- [ ] חיווט CI: compare ב-Playground tests, sync-gate ב-Changelog gates.
- [ ] CI ירוק.

**הוכחה תפקודית (באותו שלב):** `bash scripts/check-agent-repo-golden.sh` עובר; שינוי-בייט מכוון בתבנית גורם לשער ליפול עד רענון golden.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — provisioner (GitHub-scaffold בלבד)

**Acceptance:**
- [ ] `.github/workflows/provision-agent-repo.yml` — fork של החצי-GitHub-בלבד מ-`provision-system.yml` (validate → mint broker token → create repo → push scaffold → push orientation docs (envsubst) → `protect-main` ruleset → set repo vars). **מדלג** GCP/n8n/Railway/Caddy לחלוטין.
- [ ] `monitoring/registry-exempt.txt` += `provision-agent-repo.yml`. golden מרוענן.
- [ ] CI ירוק.

**הוכחה תפקודית (באותו שלב):** dispatch ל-`provision-agent-repo.yml` עם שם `zz-` → `verify_github_system`/`get_repo` מאשרים ריפו עם scaffold + ruleset + repo vars; אף פרויקט GCP לא נגע.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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

- 2026-06-17: התוכנית נפתחה. עיגנתי מחדש לקוד החי (gcp-hands נמחק — בונים על `gcp-action`+ה-MCP). שלב 0 (פתיחת תיק) בעבודה; אחריו עוצר ושואל אותך לפני שלב 1 (שעולה כמה סנט — 2 ריפו-ניסוי + הרצת Claude).
