---
dev_name: מנגנון מניעת סחיפת-תיעוד
slug: doc-drift-prevention
opened: 2026-06-17
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — מנגנון מניעת סחיפת-תיעוד

## מטרה

הפקטורי כבר אוכף שתיעוד *קיים* ומסונכרן *מבנית*, אבל לא שהוא *אומר אמת*. בונים שער CI ילידי
(bash, בלי תלות חיצונית) שרץ בכל PR ותופס סחיפת-**תוכן**: הקוד אומר X והתיעוד אומר Y — בדיוק
כמו אירוע "8 שאילתות בקוד מול 4 בתיעוד". שכבה דטרמיניסטית חוסמת (C1–C6) עכשיו; שופט-LLM
מייעץ (C7) נדחה לפיתוח נפרד בתשלום. v1 = צד-הפקטורי בלבד, בלי לגעת במערכת חיה, בלי golden.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיעוד-הכלל + ספריית-נרמול n8n (C5 + C1) | completed | `docs/doc-drift-prevention.md`, `scripts/lib/normalize-n8n.sh`, `scripts/tests/normalize-n8n.bats`, `CLAUDE.md`, `monitoring/README.md` |
| 2 | שער בדיקת-עובדות (C4 + חיווט C6a) | completed | `scripts/check-doc-facts.sh`, `monitoring/doc-fact-checks.json`, `scripts/tests/check-doc-facts.bats`, `.github/workflows/changelog-check.yml` |
| 3 | שער כבילה (C2 + C3 + חיווט C6b) + סגירה | pending | `monitoring/doc-bindings.json`, `monitoring/doc-binding-exempt.txt`, `scripts/check-doc-binding.sh`, `scripts/tests/check-doc-binding.bats`, `.github/workflows/changelog-check.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **החלטת יישום (סוטה מה-handoff, מתועדת):** שני המניפסטים הם **JSON שנקרא ב-`jq`**, לא YAML+yq.
> ה-`yq` בסביבה הוא בבילד Python (kislyuk) ולא Go (mikefarah) — דיאלקטים לא-תואמים, סיכון
> ניידות (R11). JSON+jq הוא הדפוס השולט בפקטורי (`watchdog-registry.json`, `e2e-surfaces.json`)
> ונאמן יותר לעקרון "ילידי, בלי תלות חיצונית".

---

### שלב 1 — תיעוד-הכלל + ספריית-נרמול n8n (C5 + C1)

**Acceptance:**
- [x] `docs/doc-drift-prevention.md` נכתב **קודם** לכל שער (כדי שהודעות-השגיאה יפנו לדוק קיים — R9).
- [x] `scripts/lib/normalize-n8n.sh` מנרמל n8n JSON (מסיר position/id/webhookId/מטא, ממיין מפתחות).
- [x] `CLAUDE.md` + `monitoring/README.md` מצביעים על הדוק החדש.

**הוכחה תפקודית (באותו שלב):** `scripts/tests/normalize-n8n.bats` — 8/8 עברו: שינוי position/id/
key-order מנרמל **שווה**; שינוי parameter/הוספת node מנרמל **שונה**; JSON פגום נכשל בקול;
ה-`postgres-named-queries.json` האמיתי מנרמל בלי שגיאה ושומר את התוכן. shellcheck נקי.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע ב-`workflows/n8n/*.json` ולא ב-`configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם. הספרייה הוכחה (8/8 bats), הדוק והקישורים במקום.

**שינוי תוכנית:** המניפסטים יהיו JSON (jq) ולא YAML (yq) — ראה החלטת היישום למעלה.

---

### שלב 2 — שער בדיקת-עובדות (C4 + חיווט C6a)

**Acceptance:**
- [x] `check-doc-facts.sh` מחלץ את ערכת-השמות מהקוד (`valid` ב-`Normalize Input`) ומה-`AGENTS.md.template` (השורה אחרי "read-only SELECTs"), משווה כקבוצות, ונכשל-סגור על חילוץ ריק.
- [x] מחווט ל-job "Changelog gates" ב-`changelog-check.yml`.
- [x] עובר על ה-templates האמיתיים (8==8) — לא חוסם את main.

**הוכחה תפקודית (באותו שלב):** `scripts/tests/check-doc-facts.bats` — 7/7 עברו: (א) עוגן-רגרסיה: הרצה על
ה-templates האמיתיים → PASS (מוכיח שעובר על main, ושהחילוץ-מהדוק מחריג נכון את `postgres_named_query`);
(ב) תפיסה חיובית: fixture עם דוק שמצהיר 4 שמות מול 8 בקוד → FAIL ומזכיר `claim_actual_mismatch`;
(ג) כשל-סגור: node בלי `valid` / דוק בלי שורת-העוגן → FAIL. וגם `bash scripts/check-doc-facts.sh` מקומי → PASS. shellcheck נקי.

**הוכחת E2E (artifact):** לא-התנהגותי (קורא את ה-n8n JSON כנתון; לא משנה אותו).

**הערת התקדמות אחרונה:** הושלם. השער החוסם המרכזי חי ומוכח שתופס את "8 מול 4" בלי לחסום את main.

**שינוי תוכנית:** —

---

### שלב 3 — שער כבילה (C2 + C3 + חיווט C6b) + סגירה

**Acceptance:**
- [ ] `doc-bindings.json` כובל את `postgres-named-queries.json` ↔ `AGENTS.md.template`; `doc-binding-exempt.txt` קיים.
- [ ] `check-doc-binding.sh`: ארטיפקט כבול ש**באמת** השתנה (n8n מנורמל דרך C1) בלי נגיעת-דוק → FAIL; שינוי קוסמטי → PASS; `doc-waiver:` בפרגמנט-באותו-דיף → PASS + emit.
- [ ] מחווט ל-"Changelog gates"; סוגר את התוכנית (`status: completed`) באותו PR.

**הוכחה תפקודית (באותו שלב):** `scripts/tests/check-doc-binding.bats` — fixtures: שינוי-אמיתי בלי דוק → FAIL;
שינוי-position-בלבד → PASS; דוק נגוע → PASS; waiver → PASS.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כתבנו את המסמך שמסביר את הכלל, ובנינו והוכחנו כלי קטן שמנקה "רעש" מקבצי n8n כדי שלא נקבל התראות-שווא.
- שלב 2 הושלם — השער המרכזי חי: הוא משווה את רשימת השאילתות בקוד מול התיעוד, והוכחנו שהיה תופס בדיוק את "8 מול 4" — בלי להפיל שום מיזוג תקין.
