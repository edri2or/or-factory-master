<!--
DEVPLAN — worker-extractor-hardening
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון/המצפן של הסוכן (לא חומר קריאה ל-Or).
Or לא פותח אותו; הסוכן קורא ממנו ומסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: הקשחת ה-extractor של ה-worker (ריפו-הסוכן) — בניהול fan-out חי
slug: worker-extractor-hardening
opened: 2026-06-17
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
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
| 1 | fan-out חי "לפני" (נחשון→נתן+ספי→נחשון) — תכן+רשומה+ראיית-רלוונטיות | pending | (לולאות `agent-action.yml`) |
| 2 | הוכחת-שדרוג דטרמיניסטית (before/after) + bats | pending | `tests/agent-repo-extractor.bats` |
| 3 | תיקון התבנית (durable) + PR | pending | `templates/agent-repo/.github/workflows/agent-main.yml` |
| 4 | ★אישור Or★ → יישום חי (3 ריפויים) + הוכחת "אחרי" | pending | (refresh ×3 חי) |
| 5 | סגירה + דיווח ל-Or | pending | `devplans/`, `changelog.d/` |

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

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — הוכחת-שדרוג דטרמיניסטית (before/after)

**Acceptance:**
- [ ] `tests/agent-repo-extractor.bats` — fixture (פרוזה + בלוק json דוגמה + בלוק json סנטינל).
- [ ] ה-awk הישן נכשל (תופס דוגמה/`unstructured`); ה-awk החדש מצליח (תופס סנטינל `status:"ok"`).

**הוכחה תפקודית (באותו שלב):** `bats tests/agent-repo-extractor.bats` ירוק — fail-before/pass-after מקובע.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תיקון התבנית (durable) + PR

**Acceptance:**
- [ ] `templates/agent-repo/.github/workflows/agent-main.yml` — שלב ה-extractor מתוקן (בלוק אחרון).
- [ ] changelog fragment; כל שערי ה-CI ב-PR ירוקים.

**הוכחה תפקודית (באותו שלב):** ה-bats רץ ב-CI (Playground tests) וירוק; ה-diff מראה רק את שלב ה-extractor.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — סגירה + דיווח ל-Or

**Acceptance:**
- [ ] סיכום עברית ל-Or (ראיות לפני/אחרי + bats); דבלן `completed`; יומן-Or מעודכן.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 0 הושלם — פתחתי תיק-פיתוח להקשחת ה-extractor של ה-worker, עם תוכנית שלב-אחר-שלב והוכחות.
