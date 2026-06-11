<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: סטנדרט אכיפת E2E כללי
slug: e2e-enforcement-standard
opened: 2026-06-11
status: active
---

# תוכנית פיתוח — סטנדרט אכיפת E2E כללי לפקטורי

## מטרה

להכליל את בלם ה-E2E הספציפי-לבוט (`e2e-verification-gate`, merged) למסגרת **מבוססת-סיכון,
registry-driven** שמכסה כל משטח-ריצה שדורש E2E — לא רק הבוט. כל משטח מצהיר על עצמו ברשם
(`e2e-surfaces.json`), ורק משטחים בסיכון גבוה מקבלים שער-חובה (כדי לא לחנוק delivery).
הבוט נשאר ערך #1 בלי שינוי התנהגות. תוכנית מאושרת מלאה: התכנון מ-2026-06-11.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מסמך הסטנדרט + מטריצת-סיכון | completed | `docs/e2e-enforcement-standard.md` |
| 2 | תשתית הרשם (בוט=ערך #1, אפס שינוי התנהגות) | completed | `e2e-surfaces.json`, `scripts/lib.sh`, `scripts/check-e2e-proof.sh`, `provision-system.yml` |
| 3 | משטח Deploy/Caddy-HMAC (enforce) | in-progress | `scripts/deploy-verify.sh`, `*/deploy-verify.yml`, רשם, provision |
| 4 | 3 שערי MCP (חובה+חתומים, factory-wide) | pending | smoke scripts → proof-producers, רשם, gates |
| 5 | Day-0 + Observability + MCP health (מייעץ) | pending | drivers, רשם (enforce:false) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח על קלט אמיתי *באותו שלב*. שלב שמשנה התנהגות
> נוגעת-משתמש (deploy/edge/MCP) מוכח **חי** לפני קידום.

---

### שלב 1 — מסמך הסטנדרט + מטריצת-סיכון

**Acceptance:**
- [ ] `docs/e2e-enforcement-standard.md`: הסטנדרט המקצועי (מקורות מתוארכים), מטריצת-הסיכון
      (קריטריון "האם הפיתוח דורש E2E אכיף?"), מפת הפערים, ומבנה הרשם
- [ ] מתאר את ה-5-חלקים שמוכללים מהבלם הקיים

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד).

**הוכחת E2E (artifact):** לא-התנהגותי (שלב תוכן).

**הערת התקדמות אחרונה:** הושלם — `docs/e2e-enforcement-standard.md` עם הסטנדרט המתוארך,
רוּבריקת-הסיכון, מפת הפערים, ועיצוב הרשם.

**שינוי תוכנית:** —

---

### שלב 2 — תשתית הרשם (בוט=ערך #1, אפס שינוי התנהגות)

**Acceptance:**
- [ ] `e2e-surfaces.json` עם הבוט כערך #1 (trigger_paths/hash_inputs/proof/enforce כיום)
- [ ] `scripts/lib.sh` — `e2e_behavior_*` קוראות מהרשם (לא קבוע-בקוד)
- [ ] `scripts/check-e2e-proof.sh` — surface-aware (לולאה על משטחי enforce)
- [ ] fixtures מקומיים (5 מקרים) עוברים בדיוק כמו היום; shellcheck נקי; golden מעודכן

**הוכחה תפקודית (באותו שלב):** הרצת ה-fixtures המקומיים → אותן תוצאות כמו הבלם הקיים
(no-op / חוסם בלי proof / content_hash שגוי / תקף / ישן). הבוט = ערך #1, אפס רגרסיה.

**הוכחת E2E (artifact):** תשתית-שער; הבוט החי כבר מוכח (לא נדרש proof חדש לשינוי תשתית
שאינו משנה התנהגות — רגרסיה אפס מוכחת ב-fixtures).

**הערת התקדמות אחרונה:** הושלם — `e2e-surfaces.json` (בוט=ערך #1); `lib.sh` ו-
`check-e2e-proof.sh` קוראים מהרשם (surface-aware) עם fallback מובנה לבוט אם הרשם חסר;
`provision-system.yml` שולח את הרשם למערכות חדשות. **הוכחת אפס רגרסיה:** ה-hash זהה
בּית-בּית לישן; כל 5 ה-fixtures עוברים בדיוק כמו קודם; shellcheck/yamllint/actionlint נקי.
golden לא הושפע (אין שינוי ב-templates/system).

**שינוי תוכנית:** —

---

### שלב 3 — משטח Deploy/Caddy-HMAC (enforce)

**Acceptance:**
- [ ] `scripts/deploy-verify.sh`: 401 בלי header, 200 עם header תקין, 429 ב-rate-limit, healthz 200 → proof חתום
- [ ] ערך רשם `deploy-edge` (`enforce:true`, trigger = Caddyfile/caddy/deploy workflow)
- [ ] שער + context נוסף ל-ruleset/provision

**הוכחה תפקודית (באותו שלב):** **חי על מערכת** — דחיית 401 על חתימה רעה, 200 על תקינה.
(costed — אישור Or לפני.)

**הוכחת E2E (artifact):** `e2e-proofs/deploy-edge-*.json` מריצה חיה.

**הערת התקדמות אחרונה:** בנייה הושלמה — `deploy-verify.sh` (no-sig 401 / bad-sig 401 /
valid-sig !=401 / rate-limit 429), ערך רשם `deploy-edge` (enforce:true, high), מפיקי-הוכחה
`deploy-verify.yml` (פקטורי+תבנית), provision שולח, allowlist+exempt+golden. נבדק מקומית:
שינוי Caddyfile בלי הוכחה → חסום (deploy-edge), עם הוכחה → עובר, ושינוי בוט בלבד → רק
הבוט נדרש (משטחים עצמאיים). **אומת חי-מקדים על or-edri-4 דרך probe_endpoint: /healthz=200,
webhook לא-חתום=401.** נשאר: ההוכחה החיה המלאה (deploy-verify.yml) על or-edri-4.

**שינוי תוכנית:** אין צורך ב-context חדש ב-ruleset — `check-e2e-proof.sh` כבר surface-aware,
אז ה-context הקיים "E2E verification gate" מכסה את deploy-edge אוטומטית (שער אחד, פר-משטח).

---

### שלב 4 — 3 שערי MCP (חובה+חתומים, factory-wide)

**Acceptance:**
- [ ] `factory/n8n/google-mcp-smoke` עטופים כ-proof-producers חתומים
- [ ] ערכי רשם factory-wide; שערים אכיפים
- [ ] הוכחה חיה לכל שער

**הוכחה תפקודית (באותו שלב):** הרצת ה-smokes החיים → proofs; שער חוסם בלי proof.

**הוכחת E2E (artifact):** proofs מ-3 ה-smokes.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — Day-0 + Observability + MCP health (מייעץ)

**Acceptance:**
- [ ] בדיקת-לידה Day-0; הוכחת מסירת-אירוע סינתטית; probe אחרי deploy של ה-MCP
- [ ] ערכי רשם `enforce:false` (מייעץ/אובזרבציוני — לא חוסם)

**הוכחה תפקודית (באותו שלב):** הרצה חיה של כל driver; אזהרה (לא חסימה) על משטח מייעץ.

**הוכחת E2E (artifact):** proofs/אירועים מהריצות החיות.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> ימולא כשנעמיד מערכת-טסט (שלבים 3–5): `torn-down — <date/session>` או
> `left-alive by user decision — <date/session>`.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — נכתב מסמך הסטנדרט: הבסיס המקצועי לאכיפת E2E בכל פיתוח שצריך, מטריצת-סיכון
  שמחליטה מתי זה חובה, ומפה של כל המקומות בפקטורי שבהם "ירוק" עדיין מתחזה ל"עובד".
- שלב 2 הושלם — הפכתי את הבלם ל"מבוסס-רשם" (תשתית להכללה), בלי לשנות שום דבר בהתנהגות
  שלו: ה-hash זהה בּית-בּית והבדיקות עוברות בדיוק כמו קודם. עכשיו אפשר להוסיף משטחים נוספים.
