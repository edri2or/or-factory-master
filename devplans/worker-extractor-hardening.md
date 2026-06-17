<!--
DEVPLAN — worker-extractor-hardening
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון/המצפן של הסוכן (לא חומר קריאה ל-Or).
Or לא פותח אותו; הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: הקשחת ה-extractor של ה-worker (ריפו-הסוכן) — בניהול fan-out חי
slug: worker-extractor-hardening
opened: 2026-06-17
closed: 2026-06-17
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הקשחת ה-extractor של ה-worker

## מטרה

ה-worker של ריפו-הסוכן מחלץ את בלוק ה-JSON מתשובת ה-LLM ע"י תפיסת **הבלוק הראשון** — אז תשובה
שמכילה דוגמת-קוד (בלוק ```json קודם) חוזרת `status:"unstructured"`, וזה מסכן גם את חילוץ
תוכנית-הפיצול של נחשון עצמו (ה-fan-out). מקשיחים את ה-extractor שיתפוס את **הבלוק האחרון (הסנטינל)**,
מוכיחים ב-before/after דטרמיניסטי + ב-fan-out חי (נחשון/נתן/ספי), ומחילים על התבנית + 3 הריפויים החיים.
זו גם בדיקה חיה ששלושת הסוכנים עובדים יחד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | פתיחת תיק (devplan + changelog) | completed | `devplans/`, `changelog.d/` |
| 1 | fan-out חי "לפני" (נחשון→נתן+ספי→נחשון) — תכן+רשומה+ראיית-רלוונטיות | completed | (לולאות `agent-action.yml`) |
| 2 | הוכחת-שדרוג דטרמיניסטית (before/after) + bats | completed | `scripts/tests/agent-repo-extractor.bats` |
| 3 | תיקון התבנית (durable) + PR | completed | `templates/agent-repo/.github/workflows/agent-main.yml` |
| 4 | ★אישור Or★ → יישום חי (3 ריפויים) + הוכחת "אחרי" | completed | (refresh ×3 חי) |
| 5 | סגירה + דיווח ל-Or | completed | `devplans/`, `changelog.d/` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח על קלט אמיתי *באותו שלב*. אין "הוכחה בשלב מאוחר".
>
> **אופי:** `/dev-stage` רגיל (לא factory). `templates/agent-repo/**` אינו `templates/system/**`
> → שער ה-E2E-על-or-edri-4 הוא no-op, וה-golden של המערכת לא מושפע. **אין יכולת חדשה** (הקשחת
> verb קיים) → capability-first Step 0 לא חל.

---

### שלב 0 — פתיחת תיק

**Acceptance:**
- [x] `devplans/worker-extractor-hardening.md` נוצר (`status: active`).
- [x] `changelog.d/2026-06-17-worker-extractor-hardening.md` נוצר.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — קובצי-md לפתיחת התיק, אין התנהגות רצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — התיק נפתח. `connector-url-clear` נשאר active+untouched (מותר).

**שינוי תוכנית:** —

---

### שלב 1 — fan-out חי "לפני"

**Acceptance:**
- [ ] SPLIT (נחשון) → תוכנית-פיצול תקינה מוגבלת ל-allow-list (natan-research/sapi-docs).
- [ ] נתן מחזיר תכן-פתרון; ספי מתעד אותו כרשומה; נחשון מאחד (mode:unify).
- [ ] כל ה-run-ids נרשמים; ראיית-רלוונטיות (האם תוצאות חזרו `unstructured`) מתועדת.

**הוכחה תפקודית (באותו שלב):** שרשרת-correlation מלאה בריפו nachshon (`<corr>.json`, `<corr>-a/-b`,
`<corr>-final`); אימות-יד שהאיחוד נשען על נתן וגם ספי. אף worker לא קיבל הרשאה (קריאה-בלבד).

**הוכחת E2E (artifact):** לא-התנהגותי (ריפו-סוכן, אין inbound-Telegram).

**הערת התקדמות אחרונה:** הושלם ✅ — fan-out חי מקצה-לקצה. SPLIT — נחשון (broker `27718697788`
→ `results/wex1.json`): תוכנית-פיצול תקינה ל-natan-research+sapi-docs. FAN-OUT — נתן (broker
`27718961583` → `wex1-a.json`): תכן מלא, ממליץ על בלוק-אחרון-מעוגן+jq, וגם **קרא את הקוד החי
שלו** (שורה 98). ספי (broker `27719494584` → `wex1-b.json`): רשומת 6-בלוקים מסווגת (Admiralty B/3).
UNIFY — נחשון (broker `27719786761`). **ראיית-רלוונטיות חיה:** כל שלוש התוצאות חזרו
`status:"unstructured"` תחת ה-extractor הישן (כולל תוכנית-הפיצול של נחשון עצמו) — התוכן נשמר ב-`answer`.

**שינוי תוכנית:** —

---

### שלב 2 — הוכחת-שדרוג דטרמיניסטית (before/after)

**Acceptance:**
- [ ] `tests/agent-repo-extractor.bats` — fixture (פרוזה + בלוק json דוגמה + בלוק json סנטינל).
- [ ] ה-awk הישן נכשל (תופס דוגמה/`unstructured`); ה-awk החדש מצליח (תופס סנטינל `status:"ok"`).

**הוכחה תפקודית (באותו שלב):** `bats scripts/tests/agent-repo-extractor.bats` ירוק — fail-before/pass-after מקובע.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ✅ — `scripts/tests/agent-repo-extractor.bats` נכתב ועובר (4/4),
וכל חבילת ה-bats ירוקה (אפס כשלים). אומת גם על הנתונים החיים של נחשון: הישן→ריק→`unstructured`,
החדש→משחזר תוכנית-פיצול מלאה.

**שינוי תוכנית:** מיקום הבדיקה `scripts/tests/` (שם CI מריץ bats), לא `tests/`.

---

### שלב 3 — תיקון התבנית (durable) + PR

**Acceptance:**
- [ ] `templates/agent-repo/.github/workflows/agent-main.yml` — שלב ה-extractor מתוקן (בלוק אחרון).
- [ ] changelog fragment; כל שערי ה-CI ב-PR ירוקים.

**הוכחה תפקודית (באותו שלב):** ה-bats רץ ב-CI (Playground tests) וירוק; ה-diff מראה רק את שלב ה-extractor.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ✅ — PR #531 מוזג ל-main (squash `50c5656`). תוקן ה-golden של
agent-repo (`tests/golden/agent-repo/MANIFEST.sha256`) אחרי ששער ה-CI תפס את החוסר; כל 6 שערי ה-CI ירוקים.

**שינוי תוכנית:** נדרש עדכון `tests/golden/agent-repo/` (golden נפרד ל-agent-repo, לא רק למערכת) —
שער ה-CI `check-agent-repo-golden-sync` תפס זאת. הוסף ל-PR ועבר.

---

### שלב 4 — ★אישור Or★ → יישום חי + הוכחת "אחרי"

**Acceptance:**
- [ ] (post-✅) מיזוג ה-PR.
- [ ] `refresh-agent-repo.yml` הוחל על `nachshon`/`natan-research`/`sapi-docs` עם ה-extractor המתוקן,
      בלי לדרוס prompt (ענף-מקור נושא את ה-agent-main.yml החי + התיקון).
- [ ] re-run של אותו fan-out → תוצאות נתן/ספי `status:"ok"` מובנה (במקום unstructured).

**הוכחה תפקודית (באותו שלב):** `get_file_contents` על כל extractor חי = הגרסה החדשה + prompt נשמר;
ה-fan-out "אחרי" מחזיר JSON מובנה (before/after חי מלא, run-ids נרשמים).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ✅ — Or אישר "הכל". יושם חי על שלושת הריפויים דרך
`refresh-agent-repo.yml` (runs `27720761526`/`27720763248`/`27720774370`, כולם success) מענפי-מקור
זרוקים (`wave/extrfix-nachshon` לנחשון; `wave/extrfix-roleanchored` לנתן+ספי) הנושאים את ה-prompt
החי **מילה-במילה** + ה-extractor המתוקן (אומת `diff` ריק מול ה-prompt החי לפני הדחיפה). אומת חי:
`get_file_contents` על שלושתם מראה extractor מעוגן חדש + prompt-פרסונה שלם. **הוכחת "אחרי" חיה:**
re-run של אותו SPLIT (broker `27720850378` → `results/wex2-after.json`) חזר עכשיו
`status:"ok","mode":"fanout"` עם תוכנית-פיצול נקייה — מול `unstructured` ב-wex1. הבאג שהפיל את
ה-fan-out מתוקן חי.

**שינוי תוכנית:** —

---

### שלב 5 — סגירה + דיווח ל-Or

**Acceptance:**
- [x] סיכום עברית ל-Or (ראיות לפני/אחרי + bats); דבלן `completed`; יומן-Or מעודכן.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם ✅ — דווח ל-Or; הדבלן נסגר (`status: completed`).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 0 הושלם — פתחתי תיק-פיתוח להקשחת ה-extractor של ה-worker, עם תוכנית שלב-אחר-שלב והוכחות.
- שלב 1 הושלם — הרצתי את הצוות חי: נחשון פיצל, נתן תכנן את הפתרון הכי אמין, ספי תיעד אותו כרשומה, ונחשון איחד. תוך כדי תפסנו את הבאג חי שלוש פעמים — אפילו על תוכנית-הפיצול של נחשון עצמו.
- שלב 2 הושלם — בניתי בדיקה שמוכיחה שחור-על-לבן: הקוד הישן מחזיר "לא-מובנה", החדש מחזיר את התשובה הנכונה. עובר.
- שלב 3 הושלם — תיקנתי את התבנית ומיזגתי (אחרי שאישרת). כל ריפו-סוכן עתידי כבר נולד עם התיקון.
- שלב 4 הושלם — החלתי חי על שלושת הריפויים בלי לגעת ב-prompt של אף אחד, והרצתי את אותה בקשה שוב: עכשיו היא חוזרת תקין במקום "לא-מובנה". הבאג מתוקן גם חי.
- שלב 5 הושלם — הפיתוח נסגר. הראיות, ה-run-ids והבדיקה שמורים בתיק.
