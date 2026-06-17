---
dev_name: מנוע פרסום אתרים — Cloudflare Pages
slug: publish-static-site
opened: 2026-06-17
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — מנוע פרסום אתרים (Cloudflare Pages Direct Upload)

## מטרה

היום הפקטורי יודע *לבנות* אתר אבל אין דרך אוטונומית *לשגר* אותו לאוויר עם כתובת ציבורית.
הפיתוח מוסיף "מנוע פרסום" אחד — workflow בר-הפעלה (`publish-static-site.yml`) שלוקח תיקיית
אתר סטטי, מעלה אותה ל-Cloudflare Pages (Direct Upload, ללא חיבור-Git), מחבר כתובת
`<slug>.or-infra.com`, מאמת שהיא חיה, ומבטל את הטוקנים — הכול חינם, מאובטח (טוקנים קצרי-מועד),
וחוזר. אחרי זה "רעיון → אתר → URL חי" הוא תהליך אחד אוטונומי. השינוי לא נוגע ב-`templates/system/`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הוכחת-יכולת חיה (הלבנה הקשה: Pages Direct Upload + חיבור דומיין) | pending | `.github/workflows/publish-static-site.yml`, `scripts/publish-static-site.sh`, `monitoring/registry-exempt.txt`, `docs/capability-cards/publish-static-site.md` |
| 2 | הקשחה לגרסת-ייצור (פרמטרים, מקור-ריפו דרך טוקן broker, idempotency, מלכודת-ביטול, המתנת-SSL, emit) | pending | `scripts/publish-static-site.sh`, `.github/workflows/publish-static-site.yml` |
| 3 | End-to-end על האתר האמיתי (`or-edri-4/site` → `<slug>.or-infra.com`) | pending | (הפעלה חיה; ללא שינוי קוד) |
| 4 | חיווט ל-MCP allowlist + תיעוד | pending | `services/mcp-server/src/tools.ts`, `CLAUDE.md` |
| 5 | redeploy ל-MCP + smoke | pending | (הפעלה חיה; ללא שינוי קוד) |
| 6 | Skills + כרטיס יכולת | pending | `skills/build-site/SKILL.md`, `skills/publish-site/SKILL.md`, `docs/capability-cards/publish-static-site.md` |
| 7 | ניקוי חוצה-ריפו ב-or-edri-4 + סגירה | pending | `or-edri-4`: `.github/workflows/deploy-pages.yml`, `vercel.json` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*. הלבנה הקשה
> כאן (מינט טוקן Pages חוצה-חשבון + העלאת Direct Upload + חיבור דומיין + SSL) מוכחת ראשונה
> (שלב 1), לא אחרונה.
>
> **מגבלת develop-on-main:** workflow שמזדהה כ-broker רץ רק על `main` (ה-WIF CEL נועל
> `ref=refs/heads/main`). אין מסלול בדיקה מענף. לכן הקוד נוחת על `main` דרך PR (כל שערי ה-CI),
> וכל הוכחה חיה מופעלת על `main` דרך ה-GitHub MCP (`actions_run_trigger`).
>
> **הוכחת E2E:** אף שלב לא נוגע בקבצי-התנהגות של בוט (`workflows/n8n/*.json` /
> `configure-agent-router.yml`), לכן בכל השלבים: "לא-התנהגותי". ההוכחה החיה היא probe ל-URL.

---

### שלב 1 — הוכחת-יכולת חיה (הלבנה הקשה)

**Acceptance:**
- [ ] גרסה מינימלית של ה-workflow + הסקריפט נחתה על `main` (PR ירוק) עם רשומת `registry-exempt`, פתק changelog, ונגיעת devplan.
- [ ] הופעל חי על `main`: גילוי קבוצת-הרשאת Pages בזמן-ריצה → מינט טוקן Pages (חוצה-חשבון) + טוקן DNS (חוצה-zone) → `wrangler pages deploy` של index.html מינימלי → חיבור `<test-slug>.or-infra.com` + CNAME → probe.
- [ ] שני הטוקנים בוטלו (גם בכישלון) — אומת שאין טוקן שריד.
- [ ] go/no-go נרשם ב-`docs/capability-cards/publish-static-site.md` עם מזהה קבוצת-ההרשאה שהתגלה.

**הוכחה תפקודית (באותו שלב):** קלט = הפעלת ה-workflow עם `slug=pages-proof`. פלט מצופה =
`probe_endpoint https://pages-proof.or-infra.com` מחזיר HTTP 200 עם ה-HTML המינימלי. נצפה בעיניים
דרך ה-MCP (`get_workflow_run` → success; `probe_endpoint` → 200; `verify_cloudflare_system`/
`list_dns_records` → CNAME קיים; אין טוקן `publish-*` שריד ב-`GET /user/tokens`).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — הקשחה לגרסת-ייצור

**Acceptance:**
- [ ] פרמטרים `slug` + `source_repo`/`source_ref`/`source_dir`; checkout של מקור-הריפו דרך טוקן broker קצר-מועד (דפוס `create-throwaway-repo.yml`).
- [ ] `pages project create` אידמפוטנטי (סבילות ל"כבר קיים"); מלכודת `EXIT` אחת שמבטלת את **שני** הטוקנים בהצלחה ובכישלון.
- [ ] לולאת-המתנה ל-SSL ב-probe; מיסוך (`::add-mask::`); פליטת `factory.publish.*`; שמירת `if: github.ref=='refs/heads/main'`; `setup-node` נעוץ-SHA.
- [ ] הופעל מחדש על `main` ואומת ירוק (re-run נקי עדיין 200).

**הוכחה תפקודית (באותו שלב):** קלט = הפעלה חוזרת עם אותו slug. פלט = 200 + ריצה ירוקה;
`shellcheck`/`actionlint` נקיים. נצפה דרך `get_workflow_run` + `probe_endpoint`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — End-to-end על האתר האמיתי

**Acceptance:**
- [ ] פורסם `edri2or/or-edri-4`@`main`:`site` (אתר ה-RTL הקיים) ל-`<slug>.or-infra.com` דרך הגרסה המוקשחת.
- [ ] re-run אידמפוטנטי הוכח (פרסום שני של אותו slug עובר נקי).

**הוכחה תפקודית (באותו שלב):** קלט = הפעלה עם `source_dir=site`. פלט = `probe_endpoint` 200 עם
ה-HTML של האתר האמיתי; `factory.publish.completed` נפלט; run-id נרשם. (ההוכחה החיה הנושאת — Or רואה URL.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — חיווט ל-MCP allowlist + תיעוד

**Acceptance:**
- [ ] `'publish-static-site.yml'` נוסף ל-`DISPATCHABLE_WORKFLOWS` (`services/mcp-server/src/tools.ts`) ו(מיטבית) לתיאור הכלי.
- [ ] שורת Workflows ב-`CLAUDE.md`.
- [ ] PR ירוק (build TypeScript + `node --test` ב-Playground tests). מוזג ל-`main` לפני שלב 5.

**הוכחה תפקודית (באותו שלב):** קלט = build ה-MCP ב-CI. פלט = ירוק; `DISPATCHABLE_WORKFLOWS`
כולל את הערך. נצפה דרך ה-CI של ה-PR.

**הוכחת E2E (artifact):** לא-התנהגותי (השטח `factory-mcp` הוא `enforce:false` — מסופק ע"י smoke בשלב 5).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — redeploy ל-MCP + smoke

**Acceptance:**
- [ ] הופעל `deploy-mcp-server.yml`; `verify_mcp_server` תקין; `factory-mcp-smoke.yml` ירוק.
- [ ] `dispatch_workflow` עם `publish-static-site.yml` כבר לא מחזיר `workflow_not_allowlisted`.

**הוכחה תפקודית (באותו שלב):** קלט = הפעלת ה-redeploy + ה-smoke. פלט = smoke ירוק; verify תקין.
נצפה דרך `get_workflow_run` + `verify_mcp_server`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — Skills + כרטיס יכולת

**Acceptance:**
- [ ] `skills/build-site/SKILL.md` + `skills/publish-site/SKILL.md` (פורמט skills של הפקטורי — בלי `audience:`).
- [ ] `docs/capability-cards/publish-static-site.md` סופי (verdict + מזהה הקבוצה + ממצאי proxied/SSL).
- [ ] שערי תיעוד ירוקים (`check-doc-facts.sh`/`check-doc-binding.sh`); skills-mirror לא נוגע ב-`skills/*`.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (אין התנהגות רצה) — נצפה דרך CI ירוק של ה-PR.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — ניקוי חוצה-ריפו ב-or-edri-4 + סגירה

**Acceptance:**
- [ ] ב-`edri2or/or-edri-4` (ענף `claude/quirky-ramanujan-tvt92z`): הוסרו `.github/workflows/deploy-pages.yml` (מפרסם GitHub-Pages, מוחלף) + `vercel.json` (שארית אינרטית). `site/` נשמר (מקור הפרסום).
- [ ] CI של or-edri-4 ירוק; ה-URL החי משלב 3 עדיין משרת.
- [ ] `devplans/publish-static-site.md` → `status: completed`.

**הוכחה תפקודית (באותו שלב):** קלט = PR ב-or-edri-4. פלט = CI ירוק; re-`probe_endpoint` ל-URL החי
עדיין 200. נצפה דרך ה-CI של ה-PR + `probe_endpoint`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- (מתמלא תוך כדי)
