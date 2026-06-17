---
dev_name: מנוע פרסום אתרים — Cloudflare Pages
slug: publish-static-site
opened: 2026-06-17
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 1 | הוכחת-יכולת חיה (הלבנה הקשה: Pages Direct Upload + חיבור דומיין) | completed | `.github/workflows/publish-static-site.yml`, `scripts/publish-static-site.sh`, `monitoring/registry-exempt.txt`, `docs/capability-cards/publish-static-site.md` |
| 2 | הקשחה לגרסת-ייצור (פרמטרים, מקור-ריפו דרך טוקן broker, idempotency, מלכודת-ביטול, המתנת-SSL, emit) | completed | `scripts/publish-static-site.sh`, `.github/workflows/publish-static-site.yml` |
| 3 | End-to-end על האתר האמיתי (`or-edri-4/site` → `<slug>.or-infra.com`) | completed | (הפעלה חיה; ללא שינוי קוד) |
| 4 | חיווט ל-MCP allowlist + תיעוד | in-progress | `services/mcp-server/src/tools.ts`, `CLAUDE.md` |
| 5 | redeploy ל-MCP + smoke | completed | (הפעלה חיה; ללא שינוי קוד) |
| 6 | Skills + כרטיס יכולת | completed | `skills/build-site/SKILL.md`, `skills/publish-site/SKILL.md`, `docs/capability-cards/publish-static-site.md` |
| 7 | ניקוי חוצה-ריפו ב-or-edri-4 + סגירה | completed | `or-edri-4`: `.github/workflows/deploy-pages.yml`, `vercel.json` |

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

**הערת התקדמות אחרונה:** הרצה חיה ראשונה (run 27674330970) נכשלה: בורר קבוצת-הרשאה תפס בטעות
את `Access: Custom Pages Write` (מוצר Cloudflare Access, לא Pages) → ה-API החזיר 10000
"Authentication error". האבטחה החזיקה — שני הטוקנים בוטלו במלכודת. תוקן: הבורר מחריג
`access/custom` ודורש את קבוצת ה-Pages האמיתית, + הדפסת כל המועמדים.
הרצה שנייה (run 27674750310): הבורר תקין (`Pages Write`), הפרויקט נוצר, wrangler העלה, הדומיין
חובר, ה-CNAME נוצר — **והאתר עלה חי** (אומת 200 ישירות דרך `probe_endpoint`). אבל ה-run נכשל כי
ה-probe מתוך runner של GitHub קיבל 403: ה-CNAME היה proxied (כתום) ו-Bot Fight Mode של ה-zone
חוסם IP של דאטה-סנטר (דפדפנים אמיתיים עוברים). תוקן: CNAME ב-DNS-only (`proxied=false`) + UA דפדפן
ל-probe.
הרצה שלישית (run 27678930371): **ירוק מקצה-לקצה** — wrangler העלה, ה-CNAME עודכן ל-DNS-only,
וה-probe מתוך ה-runner קיבל 200. אומת עצמאית: `https://pages-proof.or-infra.com` → 200, שני
הטוקנים בוטלו. קבוצת-ההרשאה: `Pages Write` (id `8d28297797f24fb8a0c332fe0866ec89`). **שלב 1 הושלם** —
כרטיס-היכולת נרשם ב-`docs/capability-cards/publish-static-site.md` (verdict: go).

**שינוי תוכנית:** (1) תיקון בורר קבוצת-הרשאה; (2) מעבר ל-CNAME ב-DNS-only כדי שהאתר הציבורי יהיה
נגיש לכולם (כולל אימות מ-CI) ולא ייחסם ע"י Bot Fight Mode. ללא שינוי ארכיטקטורה.

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

**הערת התקדמות אחרונה:** ה-workflow הוקשח: נוספו פרמטרים `source_repo`/`source_ref`/`source_dir`,
checkout של מקור-הריפו דרך טוקן broker קצר-מועד (contents:read, דפוס `create-throwaway-repo.yml`),
`setup-node` נעוץ-SHA, ופליטת `factory.publish.{started,completed,failed}`. הסקריפט כבר נושא
idempotency + מלכודת-ביטול-כפולה + לולאת-SSL מ-שלב 1. מוזג (#507) ואומת חי — run 27679859622 ירוק
(אותה הרצה משמשת גם כהוכחת שלב 3). **שלב 2 הושלם.**

**שינוי תוכנית:** ה-emit ממומש ב-workflow (לא בסקריפט) כי הוא צריך את `GITHUB_RUN_ID` ואת זרימת
ההצלחה/כישלון; הסקריפט נשאר נקי וניתן-לשימוש-חוזר. ללא שינוי אחר.

---

### שלב 3 — End-to-end על האתר האמיתי

**Acceptance:**
- [ ] פורסם `edri2or/or-edri-4`@`main`:`site` (אתר ה-RTL הקיים) ל-`<slug>.or-infra.com` דרך הגרסה המוקשחת.
- [ ] re-run אידמפוטנטי הוכח (פרסום שני של אותו slug עובר נקי).

**הוכחה תפקודית (באותו שלב):** קלט = הפעלה עם `source_dir=site`. פלט = `probe_endpoint` 200 עם
ה-HTML של האתר האמיתי; `factory.publish.completed` נפלט; run-id נרשם. (ההוכחה החיה הנושאת — Or רואה URL.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ע"י run **27679859622** (ירוק): המנוע משך את `or-edri-4/site` דרך
טוקן broker והעלה אותו; `https://pages-proof.or-infra.com` מגיש עכשיו את **אתר ה-Caden האמיתי**
(אומת 200 + תוכן ה-RTL). זו גם הרצה אידמפוטנטית (הפרויקט + ה-CNAME כבר היו קיימים). **שלב 3 הושלם.**

**שינוי תוכנית:** שלבים 2 ו-3 הוכחו באותה הרצה (הקשחה + פרסום האתר האמיתי) — לא נדרשה הרצה נפרדת.

---

### שלב 4 — חיווט ל-MCP allowlist + תיעוד

**Acceptance:**
- [ ] `'publish-static-site.yml'` נוסף ל-`DISPATCHABLE_WORKFLOWS` (`services/mcp-server/src/tools.ts`) ו(מיטבית) לתיאור הכלי.
- [ ] שורת Workflows ב-`CLAUDE.md`.
- [ ] PR ירוק (build TypeScript + `node --test` ב-Playground tests). מוזג ל-`main` לפני שלב 5.

**הוכחה תפקודית (באותו שלב):** קלט = build ה-MCP ב-CI. פלט = ירוק; `DISPATCHABLE_WORKFLOWS`
כולל את הערך. נצפה דרך ה-CI של ה-PR.

**הוכחת E2E (artifact):** לא-התנהגותי (השטח `factory-mcp` הוא `enforce:false` — מסופק ע"י smoke בשלב 5).

**הערת התקדמות אחרונה:** `publish-static-site.yml` נוסף ל-`DISPATCHABLE_WORKFLOWS` + תיאור הכלי
ב-`services/mcp-server/src/tools.ts` (TSC עבר נקי), ושורת Workflows נוספה ל-`CLAUDE.md`. ב-PR; אחרי
מיזוג — שלב 5 (redeploy ל-MCP) ב-gate של Or.

**שינוי תוכנית:** —

---

### שלב 5 — redeploy ל-MCP + smoke

**Acceptance:**
- [ ] הופעל `deploy-mcp-server.yml`; `verify_mcp_server` תקין; `factory-mcp-smoke.yml` ירוק.
- [ ] `dispatch_workflow` עם `publish-static-site.yml` כבר לא מחזיר `workflow_not_allowlisted`.

**הוכחה תפקודית (באותו שלב):** קלט = הפעלת ה-redeploy + ה-smoke. פלט = smoke ירוק; verify תקין.
נצפה דרך `get_workflow_run` + `verify_mcp_server`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הופעל `deploy-mcp-server.yml` (שתי הרצות — `27680383784` + `27680448425`,
שתיהן ירוקות; ריצה כפולה Or+סוכן, לא-מזיקה כי הפריסה אידמפוטנטית). `factory-mcp-smoke` (`27680784587`)
**ירוק** על or-edri-4 (handshake + 8 כלים + שתי חומות חוצה-tenant). ה-MCP נבנה מחדש מ-main → ה-allowlist
חי. (הערה: `verify_mcp_server` עם systemName בודק MCP *של מערכת*, לא את שער-הליבה — לא רלוונטי כאן;
האימות הוא ה-/health המובנה של הפריסה + ה-smoke.) **שלב 5 הושלם.**

**שינוי תוכנית:** —

---

### שלב 6 — Skills + כרטיס יכולת

**Acceptance:**
- [ ] `skills/build-site/SKILL.md` + `skills/publish-site/SKILL.md` (פורמט skills של הפקטורי — בלי `audience:`).
- [ ] `docs/capability-cards/publish-static-site.md` סופי (verdict + מזהה הקבוצה + ממצאי proxied/SSL).
- [ ] שערי תיעוד ירוקים (`check-doc-facts.sh`/`check-doc-binding.sh`); skills-mirror לא נוגע ב-`skills/*`.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (אין התנהגות רצה) — נצפה דרך CI ירוק של ה-PR.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** נכתבו `skills/publish-site/SKILL.md` (מפת-ההפעלה המלאה לפרסום דרך
ה-workflow) + `skills/build-site/SKILL.md` (הכנת הבייטים לריפו). כרטיס-היכולת כבר סופי משלב 1
(verdict go + קבוצת `Pages Write` + ממצא DNS-only). **שלב 6 הושלם.**

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

**הערת התקדמות אחרונה:** or-edri-4 PR #44 מוזג (CI ירוק): הוסרו `deploy-pages.yml` + `vercel.json`,
`site/` נשמר. אומת ש-`https://pages-proof.or-infra.com` עדיין מחזיר 200 עם אתר ה-Caden (העותק
ב-Cloudflare לא הושפע). **שלב 7 הושלם — הפיתוח נסגר (`status: completed`).**

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'גון.

- שלב 1 הושלם — מנוע הפרסום הוכח חי מקצה-לקצה: רעיון → אתר → URL חי (`https://pages-proof.or-infra.com`, 200). בדרך תוקנו שני באגים (קבוצת-הרשאה שגויה; חסימת Bot Fight Mode → מעבר ל-DNS-only).
- שלבים 2+3 הושלמו — המנוע פורס עכשיו אתר אמיתי מ-ריפו: משך את אתר ה-Caden מ-`or-edri-4/site` והעלה אותו אוטומטית, והוא חי בכתובת (אתר RTL מעוצב מלא). אפשר לפרסם כל אתר מכל ריפו עם slug לבחירה.
- שלבים 4+5 הושלמו — המנוע מחובר רשמית לכלי-ההפעלה של הפקטורי (אפשר להפעיל אותו בלחיצה), ושירות-הליבה עודכן ואומת.
- שלבים 6+7 הושלמו — נוספו "כרטיסי הפעלה" (skills) כדי שתמיד נדע איך להפעיל את המנוע, וניקינו שאריות ישנות במערכת or-edri-4. **הפיתוח הסתיים.** 🎉
