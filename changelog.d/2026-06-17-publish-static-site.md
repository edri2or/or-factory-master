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
- **שלב 1 — סגירה: probe מודע-הפעלה.** ההרצה השנייה (run 27674750310) הוכיחה את היכולת מקצה-לקצה
  (`Pages Write` נבחר נכון, wrangler העלה, הדומיין+CNAME חוברו), אך נצבעה אדום כי ה-probe חיכה 5
  דק' בלבד — והפעלת-הדומיין הראשונית של Cloudflare Pages מחזירה 403 עד שהיא מסתיימת (מעבר ל-5 דק').
  הכתובת `https://pages-proof.or-infra.com` עלתה מעט אחרי והחזירה 200 עם ה-HTML המצופה. תוקן
  ב-`scripts/publish-static-site.sh`: ה-probe מאתר עכשיו את סטטוס הדומיין (`…/pages/projects/<slug>/domains/<fqdn>`)
  בנוסף לבדיקת ה-200, סובל 403/000/52x כ"עדיין מופעל", ותקציבו הוארך ל-~13 דק' (40×20s). go/no-go = **go**,
  נרשם ב-`docs/capability-cards/publish-static-site.md` (מזהה קבוצת ההרשאה: `8d28297797f24fb8a0c332fe0866ec89`).
