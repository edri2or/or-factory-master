---
dev_name: זניחת מערכת-הייחוס ומעבר ללולאת-תיקון-על-מערכת-חיה
slug: reference-system-overhaul
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — זניחת מערכת-הייחוס ומעבר ללולאת-תיקון-על-מערכת-חיה

## מטרה

מפרקים לגמרי את "מערכת-הייחוס" (המערכת החיה הקבועה + הוולידציה הדו-שכבתית) שלא הוכיחה
את עצמה, ובמקומה הופכים את לולאת-התיקון-על-מערכת-חיה (`refresh-system-agents`) לשיטה
הקבועה, הגנרית והמתועדת לאימות כל שינוי בתהליך-ההקמה — יכולת שהסוכן תמיד יודע שיש לו.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | פירוק המערכת החיה (factory-test-18) | completed | פעולת-ענן (Railway+DNS+repo) + bookkeeping |
| 2 | מחיקת ליבת-הייחוס + workflow הסנכרון + רשומת watchdog | pending | reference-system/, docs/reference-system.md, scripts/reference-*, reference-system-reconcile.yml, watchdog-registry.json |
| 3 | ניתוק שער ה-golden מהשם "reference" (שומר עצמאי) | pending | check-reference-sync.sh→check-golden-sync.sh (+bats), changelog-check.yml |
| 4 | הכללת כלי התיקון-החי לכל סוג תיקון | pending | refresh-system-agents.yml, services/mcp-server/src/tools.ts |
| 5 | שכתוב /dev-stage-factory + שיטה-קבועה ב-CLAUDE.md + תיעוד | pending | dev-stage-factory.md, CLAUDE.md, README.md, docs/roadmap.md, docs/live-test-loop.md |
| 6 | סגירה — אימות "בלי זכר" + status: completed | pending | devplan |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — פירוק המערכת החיה (factory-test-18)

**Acceptance:**
- [ ] פרויקט ה-Railway של or-factory-reference נמחק (העלות השוטפת נעצרה)
- [ ] CNAME + TXT של n8n-or-factory-reference הוסרו מ-Cloudflare
- [x] הריפו edri2or/or-factory-reference אורכב
- [~] הוכרע: Or בחר soft-delete לפרויקט factory-test-18 — נדרשת לחיצה אחת שלו על decommission-test-projects.yml (לא נגיש לסוכן בכוונה). העלות כבר נעצרה (Railway ירד).
- [x] אימות: verify_railway_system (אין פרויקט), /healthz לא-2xx (fetch failed), לוג הריצה PASS על Railway+DNS+archive

**הערת התקדמות אחרונה:** הפירוק האוטונומי הצליח ואומת (run 26740582652): Railway נמחק (העלות נעצרה), CNAME+TXT נמחקו, הריפו אורכב, מפתח OpenRouter בוטל. נותרה רק לחיצה אחת של Or למחיקה-רכה של פרויקט ה-GCP factory-test-18 (Actions → "Delete test GCP projects" → system_names=factory-test-18).

**שינוי תוכנית:** —

---

### שלב 2 — מחיקת ליבת-הייחוס + workflow הסנכרון + רשומת watchdog

**Acceptance:**
- [ ] נמחקו: reference-system/config.yml, docs/reference-system.md, scripts/reference-config.sh, scripts/reference-system-smoke.sh, scripts/tests/reference-system-smoke.bats, .github/workflows/reference-system-reconcile.yml
- [ ] רשומת reference-system-reconcile הוסרה מ-monitoring/watchdog-registry.json באותו commit
- [ ] CI ירוק (שער ה-watchdog מרוצה ממחיקת הרשומה יחד עם ה-workflow)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — ניתוק שער ה-golden מהשם "reference" (שומר עצמאי)

**Acceptance:**
- [ ] scripts/check-reference-sync.sh → scripts/check-golden-sync.sh (לוגיקה ללא שינוי)
- [ ] scripts/tests/check-reference-sync.bats → scripts/tests/check-golden-sync.bats
- [ ] changelog-check.yml קורא ל-check-golden-sync.sh, בלי המילה "reference"
- [ ] check-system-golden.sh / render-system-golden.sh / tests/golden/system/ / צעד ה-Playground נשארים כמות שהם
- [ ] CI ירוק

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — הכללת כלי התיקון-החי לכל סוג תיקון

**Acceptance:**
- [ ] refresh-system-agents.yml מקבל inputs אופציונליים paths (ברירת מחדל workflows/n8n) + post_merge_workflow (ברירת מחדל configure-agent-router.yml), תאימות-לאחור מלאה
- [ ] צעד ההעתקה + טריגר-אחרי-מיזוג קוראים מה-inputs; הערות/כותרות-PR מנוסחות "תיקון תבנית"
- [ ] טקסט התיאור ב-services/mcp-server/src/tools.ts עודכן (לא-פונקציונלי, בלי redeploy)
- [ ] CI ירוק (yamllint/shellcheck)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — שכתוב /dev-stage-factory + שיטה-קבועה ב-CLAUDE.md + תיעוד

**Acceptance:**
- [ ] .claude/commands/dev-stage-factory.md משוכתב סביב לולאת-המערכת-החיה (audience נשאר factory-only); sync-skills-mirror.sh הורץ
- [ ] docs/live-test-loop.md חדש (מחליף את docs/reference-system.md)
- [ ] CLAUDE.md: פסקת dev-stage-factory משוכתבת, שורת reference-system-reconcile הוסרה, שורות Key-files תוקנו, נוספה תת-פסקה קבועה על שיטת הלולאה-החיה
- [ ] README.md + docs/roadmap.md עודכנו
- [ ] היסטוריה סגורה נשארת (devplans/reference-system.md, changelog.d הישן, archives)
- [ ] CI ירוק (skills-mirror, changelog, devplan, golden-sync, watchdog)

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — סגירה

**Acceptance:**
- [ ] grep ל-reference-system / מערכת-ייחוס / מכונית-ייחוס מחזיר רק היסטוריה מכוונת
- [ ] PR ירוק לגמרי, מוכן-לסקירה, על ענף claude/reference-system-overhaul-LyD0J
- [ ] status: completed

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — פירקנו את המערכת החיה: Railway נמחק (עצרנו את התשלום), ה-DNS נמחק, והריפו אורכב. נשארה לך לחיצה אחת קטנה למחיקת פרויקט ה-GCP.
