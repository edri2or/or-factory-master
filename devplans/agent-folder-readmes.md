---
dev_name: README בכל תיקיית סוכן בכל מערכת חדשה
slug: agent-folder-readmes
opened: 2026-06-22
status: completed
---

# תוכנית פיתוח — README בכל תיקיית סוכן

## מטרה

שכל מערכת שהפקטורי מייצר תיוולד עם קובץ `README.md` היברידי בכל תיקיית סוכן
(`agents/<name>/`) — טקסט אנושי שמסביר מה הסוכן עושה + בלוק מטא-דאטה שנוצר אוטומטית
מ-`agent.yaml`+`tools.yaml`, עם שער CI חוסם ששומר את השניים מסונכרנים. בדיוק כמו שעשינו
ב-or-aios, מותאם לפורמט תיקיית-הסוכן של הפקטורי. רק מערכות חדשות (provision-only).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | סקריפט מייצר + שער CI | completed | `scripts/build-agent-readme.sh`, `scripts/check-agent-readme.sh` |
| 2 | README ל-5 הסוכנים + תבנית scaffold | completed | `templates/system/agents/*/README.md`, `_spec/README.template.md` |
| 3 | חיווט CI (פקטורי+מערכת), שליחה למערכות, גולדן, תיעוד | completed | `changelog-check.yml` ×2, `provision-system.yml`, `tests/golden/system/`, `_spec/agent-folder.spec.md` |

---

### שלב 1 — סקריפט מייצר + שער CI

**Acceptance:**
- [x] `build-agent-readme.sh` קורא `agent.yaml`+`tools.yaml` (python3+pyyaml) ומזריק בלוק דטרמיניסטי בין הסימונים.
- [x] `check-agent-readme.sh` תאום מבני של `check-agent-folder.sh` (layout auto-detect, no-op בלי `agents/`).

**הוכחה תפקודית (באותו שלב):** הרצה מקומית: `check-agent-readme.sh` → PASS על 5 הסוכנים;
שינוי זמני של `model` ב-`ops/agent.yaml` → השער **נכשל** עם diff מדויק; שחזור → PASS. מוכיח
שהשער אמיתי ולא קוסמטי.

**הוכחת E2E (artifact):** לא-התנהגותי (CI/docs בלבד; לא נוגע ב-`workflows/n8n/*.json` ולא ב-`configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם ואומת מקומית (drift נתפס, restore עובר).

**שינוי תוכנית:** —

---

### שלב 2 — README ל-5 הסוכנים + תבנית scaffold

**Acceptance:**
- [x] ל-`code/ops/infra/research/unknown` יש `README.md` עם פרוזה אנושית + בלוק מנוהל מיוצר.
- [x] `_spec/README.template.md` קיים ל-scaffold של סוכן עתידי (נשלח למערכות עם `_spec`).

**הוכחה תפקודית (באותו שלב):** הבלוק של כל סוכן נוצר ע"י `build-agent-readme.sh` ותואם
ל-agent.yaml שלו (intent/architecture/model/temperature/confidence/fallback/tools);
`check-agent-folder.sh` עדיין PASS (ה-README לא שובר את שער התיקייה).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 5 README-ים נוצרו, בלוקים מולאו, שני השערים ירוקים.

**שינוי תוכנית:** הבלוק מותאם לסכמת הפקטורי (אין rank/department/owner כמו ב-or-aios) — שדות:
Intent, Architecture, Model, Temperature, Confidence threshold, Fallback, Tools.

---

### שלב 3 — חיווט CI, שליחה למערכות, גולדן, תיעוד

**Acceptance:**
- [x] השער מחווט ב-"Changelog gates" של הפקטורי **וגם** של תבנית המערכת.
- [x] `provision-system.yml` שולח את שני הסקריפטים לכל מערכת חדשה.
- [x] הגולדן רוענן (`check-system-golden.sh --update`) וכולל את 6 ה-README/template.
- [x] `agent-folder.spec.md` מתעד את ה-README כקובץ חובה + הסקריפטים.

**הוכחה תפקודית (באותו שלב):** `check-system-golden.sh` → PASS; ה-README-ים מופיעים ב-MANIFEST.sha256.

**הוכחת E2E (artifact):** לא-התנהגותי. ההוכחה החיה היא **בדיקת לידה (Day-0)** אחרי merge: מערכת
זמינה טרייה נולדת עם `agents/<name>/README.md` וה-`Changelog gates` שלה ירוק.

**הערת התקדמות אחרונה:** הושלם; ממתין ל-CI ירוק ב-PR ואז (באישור אור) בדיקת לידה.

**שינוי תוכנית:** במערכות `check-agent-folder.sh` רץ ב-`changelog-check.yml` (לא pipeline-tests
כפי שהונח בתוכנית המקורית) — חיווטתי בהתאם.

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — בנינו "מכונה" שכותבת אוטומטית את כרטיס הסוכן, ושומר ש-CI שתופס אם הכרטיס לא מעודכן.
- שלב 2 הושלם — כל 5 הסוכנים בתבנית קיבלו README קריא, ויש תבנית לסוכן עתידי.
- שלב 3 הושלם — חיברנו את השומר לפס הייצור (גם בפקטורי וגם בכל מערכת חדשה), ועדכנו תיעוד וחתימות.
