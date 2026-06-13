---
dev_name: קיבוע or-edri-4 כמערכת-הניסוי הקבועה
slug: or-edri-4-standing-proving-system
opened: 2026-06-13
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — קיבוע or-edri-4 כמערכת-הניסוי הקבועה

## מטרה

להפוך את `or-edri-4` למערכת-הניסוי הקבועה שהולכת יד-ביד עם הפקטורי: כל שינוי בתהליך-ההקמה
(מה שמערכת מקבלת) קודם **מוכח חי על or-edri-4**, ורק אז **מקובע בקוד התבנית של הפקטורי**.
מקבעים את זה בכתב בכל מקום שהדוקטרינה חיה, מוסיפים **בלם CI** שדורש שההוכחה תבוא דווקא
מ-or-edri-4, ו**דופק בריאות** שמונע שהמערכת תירקב בשקט (החולשה שהרגה את מערכת-הייחוס הישנה).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הדוקטרינה בכתב | completed | `CLAUDE.md`, `docs/live-test-loop.md`, `.claude/commands/dev-stage-factory.md` |
| 2 | בלם ה-CI עם השיניים | completed | `e2e-surfaces.json`, `scripts/check-e2e-proof.sh`, `scripts/lib.sh`, `scripts/tests/e2e-proof-systems.bats` |
| 3 | דופק בריאות נגד ריקבון | completed | `.github/workflows/system-runtime-audit.yml`, `scripts/runtime-audit-targets.sh`, `monitoring/watchdog-registry.json`, `scripts/tests/runtime-audit-targets.bats` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הערה על הפיתוח הזה עצמו:** הוא נוגע בממשל/תיעוד + בלם-CI + ניטור — לא ב-`templates/system/**`
> ולא בקבצי-התנהגות של הבוט. לכן שער ה-E2E והשער הזהב הם no-op כאן (אין נתיב-טריגר מושפע),
> והפיתוח הזה לא דורש הוכחה חיה על or-edri-4. כל השלבים מסומנים "לא-התנהגותי".

---

### שלב 1 — הדוקטרינה בכתב

**Acceptance:**
- [ ] `CLAUDE.md`: הפסקה "Validating provisioning-process changes" מנוסחת מחדש — or-edri-4 = מערכת-הניסוי הקבועה; הכלל "קודם מוכיחים על or-edri-4 → אז מקבעים בקוד"; מערכת-טסט זמנית נשמרת רק לבדיקת-לידה Day-0. שורה חדשה ב-Fixed values.
- [ ] `docs/live-test-loop.md`: הסעיף "Why this, and not a standing reference system" מנוסח מחדש ל-"or-edri-4 כמערכת-הניסוי הקבועה — ואיך היא נמנעת מהריקבון הישן" (3 הסיבות). "What stayed, what went" מעודכן.
- [ ] `.claude/commands/dev-stage-factory.md`: השיטה + Step 3(a.2) מציינים or-edri-4 כברירת-מחדל וסדר מפורש (הוכח על or-edri-4 → קבע); שדה `הוכחת E2E (artifact)` רושם את נתיב הוכחת or-edri-4.
- [ ] אין סתירה שורדת בין שלושת הקבצים ("never a permanent reference system" מנוסח מחדש, לא תלוי באוויר); תפקיד מערכת-הטסט הזמנית לבדיקת-לידה נשמר.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — אין התנהגות רצה. אימות: קריאה חוזרת של שלושת הקבצים לאיתור סתירות; `grep` ל-"throwaway"/"reference system" לוודא שכל מופע עקבי עם הדוקטרינה החדשה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. עודכנו 3 הקבצים: `CLAUDE.md` (הפסקה + שורת Fixed values), `docs/live-test-loop.md` (סעיף "or-edri-4 כמערכת-הניסוי" + reframe ל-3 הסיבות + תיקון merge→prove), `dev-stage-factory.md` (השיטה, Step 3 a.2, Step 5, Safety 4/5, דוגמאות, frontmatter). אומת ב-grep שאין סתירה שורדת ("throwaway" נשאר רק בהקשר Day-0/sandbox; "reference system" רק כהיסטוריה מנוסחת-מחדש). תוכן בלבד — Playground: N/A.

**שינוי תוכנית:** התגלתה אינטראקציה מהותית: השער (שלב 2) ידרוש הוכחה מ-or-edri-4, אבל מסלול ה-prove→merge הקיים (sandbox על factory-test-25) מפיק הוכחה ממערכת אחרת. הוספתי הערת-פיוס בתיעוד. **לאמת בשלב 2**: כיצד מחילים ענף לא-ממוזג על or-edri-4 החיה כדי להפיק את ההוכחה (broker → or-edri-4) — שהשער יהיה בר-קיום ולא יחסום כל מיזוג.

**Acceptance:**
- [ ] `e2e-surfaces.json`: שדה אופציונלי `proof_systems: ["or-edri-4"]` נוסף למשטחים האכופים הפר-מערכתיים (`telegram-bot`, `deploy-edge`). היעדר השדה ⇒ כל מערכת (תאימות-אחורה).
- [ ] `scripts/check-e2e-proof.sh`: `verify_proof()` קורא את `.system` מה-proof ונכשל אם המשטח מצהיר `proof_systems` והמערכת אינה ברשימה. קריאת השדה דרך עוזרי `lib.sh` הקיימים.
- [ ] proof מזויף עם `system != or-edri-4` נדחה למשטחים אלו; 10 ה-proofs הקיימים (כולם or-edri-4) עדיין עוברים; היעדר `proof_systems` ⇒ התנהגות ללא-שינוי.

**הוכחה תפקודית (באותו שלב):** fixture — להריץ `scripts/check-e2e-proof.sh` במצב לוקאלי (לא-CI) על proof תקין עם `system:"factory-test-099"` → צפוי **דחייה**; אותו proof עם `system:"or-edri-4"` → צפוי **מעבר**. בנוסף: re-validate של 10 ה-proofs ב-`e2e-proofs/` → כולם עוברים. מתעדים פקודה + פלט.

**הוכחת E2E (artifact):** לא-התנהגותי (משנה את לוגיקת השער עצמו, לא קובץ-התנהגות בוט; אין נתיב-טריגר E2E מושפע).

**הערת התקדמות אחרונה:** הושלם והוכח. הוספתי 2 עוזרים ב-`lib.sh` (`e2e_surface_proof_systems` + העוזר הטהור `e2e_proof_system_allowed`), חיווט ב-`check-e2e-proof.sh` (`verify_proof` קורא `.system` ומאמת מול `proof_systems`), `proof_systems:["or-edri-4"]` ב-2 המשטחים האכופים. **הוכחות:** (1) bats חדש 7/7 (`e2e-proof-systems.bats`) כולל ש-10 ה-proofs הקיימים עוברים; (2) **מבחן-אינטגרציה על השער עצמו** ב-repo-fixture: שינוי בקובץ-טריגר + proof עם `factory-test-099` → השער נדחה (exit 1, הודעה ברורה); אותו שינוי + proof `or-edri-4` (hash תואם) → השער עבר דרך `verify_proof` (exit 0). (3) `bash -n` + shellcheck נקיים (רק 2 הערות קודמות בשורות שלא נגעתי). מנגנון ההפקה אומת קיים: כל 10 ה-proofs הם מ-or-edri-4. הוספתי `gcp_project=factory-test-21` לתיעוד (שם סודות or-edri-4). Playground: ירוץ ב-CI (bats auto-discovery).

**שינוי תוכנית:** הנקודה שצוינה בשלב 1 נסגרה — הבלם בר-קיום: e2e-verify תומך ב-`system_name=or-edri-4`+`gcp_project=factory-test-21`, וקיומם של 10 proofs מ-or-edri-4 מוכיח שהמסלול עובד. לא נדרשה מכונת-החלה חדשה.

---

### שלב 3 — דופק בריאות נגד ריקבון

**Acceptance:**
- [ ] `.github/workflows/system-runtime-audit.yml`: `ALWAYS_PROBE="or-edri-4"` נוסף לרשימת-המערכות (מצורף לרשימת-התיקייה + dedup), כך שה-probe ל-`/healthz` + אירועי `factory.runtime_audit.*` הקיימים מכסים אותה.
- [ ] `monitoring/watchdog-registry.json`: רשומת-תיעוד אחת למערכת-הניסוי הקבועה.
- [ ] קבוצת ה-probe כוללת את or-edri-4; dispatch ידני (read-only) מראה אירוע `factory.runtime_audit.ok/failed` עבורה.

**הוכחה תפקודית (באותו שלב):** חילצתי את הרכבת רשימת-המערכות ל-`scripts/runtime-audit-targets.sh` (ניתן-לבדיקה בלי gcloud דרך `RUNTIME_AUDIT_FOLDER_LIST`), והוספתי 5 בדיקות bats (`runtime-audit-targets.bats`) — **5/5 עוברות**: or-edri-4 תמיד נכלל, dedup אם הוא גם בתיקייה, אין שורות ריקות, ריבוי מערכות. בנוסף: `jq empty` על שני ה-JSON תקין, shellcheck נקי על הסקריפט החדש, ו-`run-watchdog.sh` עדיין רץ תקין מול הרשומה המעודכנת. אימות חי (read-only) של dispatch ל-`system-runtime-audit.yml` יבוצע לאחר מיזוג (gcloud אינו זמין לוקאלית).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. `system-runtime-audit.yml` קורא עכשיו ל-`runtime-audit-targets.sh` עם `ALWAYS_PROBE=or-edri-4`, כך ש-or-edri-4 (על factory-test-21, מחוץ לתיקיית-המערכות) תמיד נבדקת — ה-probe הקיים ל-`/healthz` + אירועי `factory.runtime_audit.*` (כולל התראת error+action_required על כשל) מכסים אותה. רשומת `system-runtime-audit` ב-watchdog-registry תועדה עם `always_probe`.

**שינוי תוכנית:** במקום רשומת-registry חדשה (proof_method לא-נתמך היה מופיע כ-❓ לנצח ב-run-watchdog), תיעדתי את ה-always_probe בתוך ה-evidence של רשומת `system-runtime-audit` הקיימת — מכסה את אותה מטרה בלי רעש וללא סיכון לרץ. הוספתי גם `scripts/runtime-audit-targets.sh` כדי שהלוגיקה תהיה ניתנת-לבדיקת-יחידה.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — כתבנו בכל מקום שהדוקטרינה חיה (CLAUDE.md, מסמך השיטה, הסקיל) ש-or-edri-4 היא מערכת-הניסוי הקבועה, והכלל "קודם מוכיחים עליה חי, ואז מקבעים בקוד".
- שלב 2 הושלם — הוספנו את "השיניים": שער ה-CI עכשיו דורש שההוכחה החיה תבוא דווקא מ-or-edri-4, אחרת המיזוג חסום. הוכחנו על השער עצמו שהוא דוחה מערכת אחרת ומקבל את or-edri-4.
- שלב 3 הושלם — בדיקת-הבריאות התקופתית בודקת מעכשיו תמיד גם את or-edri-4, כך שאם היא תיפול נדע מיד (דופק נגד ריקבון). הפיתוח הושלם.
