### מנוע פרסום אתרים — Cloudflare Pages Direct Upload

- **שלב 1 — הוכחת-יכולת חיה (הלבנה הקשה).** נוסף `scripts/publish-static-site.sh` +
  `.github/workflows/publish-static-site.yml` (גרסה מינימלית): מזדהה כ-broker דרך WIF, קורא את
  `cloudflare-account-id`/`cloudflare-token-creator`/`cloudflare-zone-id-or-infra` מ-SM של ה-control,
  מגלה את קבוצת-הרשאת "Pages Write" בזמן-ריצה (`GET /user/tokens/permission_groups`), מנפיק טוקן
  Pages חוצה-חשבון + טוקן DNS חוצה-zone (שניהם 1h, מבוטלים במלכודת `EXIT`), יוצר פרויקט Pages
  (אידמפוטנטי דרך ה-API), מעלה תיקייה ב-Direct Upload עם `wrangler pages deploy`, מחבר
  `<slug>.or-infra.com` (POST domains + CNAME ל-`<slug>.pages.dev`), וממתין ל-200 חי. נוסף
  `.github/workflows/publish-static-site.yml` ל-`monitoring/registry-exempt.txt` (dispatch-only,
  בלי cadence). השינוי לא נוגע ב-`templates/system/` (אין רענון golden).
- **שלב 1 — תיקון בורר קבוצת-ההרשאה.** ההרצה החיה הראשונה נכשלה כי הבורר תפס את קבוצת
  Cloudflare **Access** `Access: Custom Pages Write` (מוצר אחר עם שם דומה) → 10000
  "Authentication error". הבורר תוקן: מחריג `access/custom`, דורש את קבוצת ה-**Pages** האמיתית
  (`pages` + `write`/`edit`), ומדפיס את כל קבוצות-ה"pages" המועמדות לשקיפות. המלכודת ביטלה את
  שני הטוקנים גם בכישלון — אבטחה החזיקה.
- **שלב 1 — CNAME ב-DNS-only.** ההרצה השנייה העלתה את האתר בהצלחה (`wrangler` Direct Upload +
  חיבור דומיין + CNAME), אך ה-run נכשל כי ה-probe מ-runner של GitHub קיבל 403: ה-CNAME היה
  proxied ו-Bot Fight Mode של ה-zone חוסם IP של דאטה-סנטר (האתר עצמו עלה חי — אומת 200 ישירות).
  תוקן: ברירת המחדל של ה-CNAME היא עכשיו **DNS-only** (`proxied=false`) כדי שהאתר הציבורי יהיה
  נגיש לכולם וניתן לאימות מ-CI; Cloudflare Pages עדיין מגיש את הדומיין עם תעודה משלו. ה-probe
  קיבל גם `-L` + UA דפדפן.
- **שלב 1 הושלם — היכולת מוכחת חיה.** הרצה `27678930371` עברה **ירוק מקצה-לקצה** ו-
  `https://pages-proof.or-infra.com` מחזיר 200 (אומת עצמאית). נוסף `docs/capability-cards/publish-static-site.md`
  (verdict: go; קבוצת-הרשאה `Pages Write` id `8d28297797f24fb8a0c332fe0866ec89`; ממצא ה-DNS-only).
  שלב 1 (הוכחת-יכולת) סגור.
- **שלב 2 — הקשחה לגרסת-ייצור.** ה-workflow קיבל פרמטרים `source_repo`/`source_ref`/`source_dir`
  (ברירת מחדל `edri2or/or-edri-4`@`main`:`site`), checkout של מקור-הריפו דרך טוקן broker קצר-מועד
  (`contents:read`, דפוס `create-throwaway-repo.yml`), `setup-node` נעוץ-SHA ל-wrangler, ופליטת
  `factory.publish.{started,completed,failed}` (כולל `action_required` בכישלון). הסקריפט כבר נשא
  idempotency + מלכודת-ביטול-כפולה + לולאת-המתנה ל-SSL מ-שלב 1.
- **שלבים 2+3 הושלמו (הוכחה חיה).** הרצה `27679859622` עברה **ירוק**: המנוע משך את `or-edri-4/site`
  דרך טוקן broker והעלה אותו, ו-`https://pages-proof.or-infra.com` מגיש עכשיו את אתר ה-Caden האמיתי
  (אומת 200 + תוכן RTL). זו גם הרצה אידמפוטנטית (הפרויקט + ה-CNAME כבר היו קיימים) — לכן שלב 3
  (E2E על האתר האמיתי) הוכח באותה הרצה.
- **שלב 4 — חיווט ל-MCP allowlist + תיעוד.** `publish-static-site.yml` נוסף ל-`DISPATCHABLE_WORKFLOWS`
  + תיאור הכלי ב-`services/mcp-server/src/tools.ts`, ושורת Workflows ב-`CLAUDE.md`. (ה-redeploy של
  ה-MCP — שלב 5 — מופעל בנפרד באישור Or, כי הוא נוגע בשירות-הליבה.)
- **שלב 5 — redeploy ל-MCP + smoke.** הופעל `deploy-mcp-server.yml` (נבנה מחדש מ-main → ה-allowlist
  חי), ו-`factory-mcp-smoke.yml` עבר **ירוק** על or-edri-4 (handshake + 8 כלים + חומות חוצה-tenant).
- **שלב 6 — Skills + כרטיס יכולת.** נוספו `skills/publish-site/SKILL.md` (מפת-ההפעלה לפרסום) +
  `skills/build-site/SKILL.md` (הכנת הבייטים לריפו); כרטיס-היכולת `docs/capability-cards/publish-static-site.md`
  כבר סופי משלב 1 (verdict go).
- **שלב 7 + סגירה.** ב-`edri2or/or-edri-4` (PR #44, מוזג) הוסרו `deploy-pages.yml` (מפרסם GitHub-Pages
  מוחלף) + `vercel.json` (אינרטי); `site/` נשמר כמקור הפרסום. אומת ש-`https://pages-proof.or-infra.com`
  עדיין מחזיר 200 (העותק ב-Cloudflare לא הושפע). הפיתוח נסגר — `devplans/publish-static-site.md`
  → `status: completed`.
