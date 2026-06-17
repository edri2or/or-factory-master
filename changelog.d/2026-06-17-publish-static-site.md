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
