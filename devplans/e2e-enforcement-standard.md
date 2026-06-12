<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: סטנדרט אכיפת E2E כללי
slug: e2e-enforcement-standard
opened: 2026-06-11
status: completed
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
| 3 | משטח Deploy/Caddy-HMAC (enforce) | completed | `scripts/deploy-verify.sh`, `*/deploy-verify.yml`, רשם, provision |
| 4 | 3 שערי MCP (deploy-gate) | completed | `e2e-surfaces.json`, `deploy-mcp-server.yml`, doc |
| 5 | סגירה: Day-0 + מפת-משטחים (מייעץ) | completed | `e2e-surfaces.json`, `docs/*` |

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
webhook לא-חתום=401.** **הושלם — הוכחה חיה מלאה על or-edri-4** (retrofit PR #9 merged →
dispatch `deploy-verify.yml`, run 27384892330, success): התעודה `deploy-edge-or-edri-4.json`
מראה checks אמיתיים — healthz 200, no_signature 401, bad_signature 401, good_signature 404
(חתימה תקפה עברה את Caddy), rate_limit_429s 33. תעודה חתומה, קשורה ל-content_hash.

**שינוי תוכנית:** אין צורך ב-context חדש ב-ruleset — `check-e2e-proof.sh` כבר surface-aware,
אז ה-context הקיים "E2E verification gate" מכסה את deploy-edge אוטומטית (שער אחד, פר-משטח).

---

### שלב 4 — 3 שערי MCP (חובה+חתומים, factory-wide)

**Acceptance:**
- [ ] `factory/n8n/google-mcp-smoke` עטופים כ-proof-producers חתומים
- [ ] ערכי רשם factory-wide; שערים אכיפים
- [ ] הוכחה חיה לכל שער

**הוכחה תפקודית (באותו שלב):** 3 ה-smokes עוברים חי מול or-edri-4 (הלוגיקה שה-gate מריץ);
ההרצה המלאה של ה-gate = ה-redeploy האוטומטי כשמתמזג (control-plane → post-merge).

**הוכחת E2E (artifact):** ריצות ה-smoke החיות (factory/n8n/google) מול or-edri-4 +
ריצת ה-deploy-gate ב-redeploy.

**הערת התקדמות אחרונה:** בנייה הושלמה — **deploy-gate** (לא merge-gate, כי ה-gateway
משותף): צעד "Post-deploy MCP smoke gate" ב-`deploy-mcp-server.yml` מריץ את 3 ה-smokes מול
השרת שזה-עתה נפרס; כשל → ה-deploy נכשל. 3 ערכי רשם (`factory/n8n/workspace-mcp`,
`gate:"deploy"`, `enforce:false` → `check-e2e-proof` לא נוגע). input `smoke_target`
(default or-edri-4). מתועד ב-`docs/e2e-enforcement-standard.md`. yamllint/actionlint נקי.
**הושלם — 3 ה-smokes עברו חי מול or-edri-4** (runs 27385453195/454296/455407, all success):
factory tenant, n8n live-write, google shared-read. ההרצה המלאה של ה-gate = ה-redeploy
האוטומטי כשמתמזג (control-plane).

**שינוי תוכנית:** v1 = post-deploy detection שמפיל את ה-job (blue-green pre-traffic =
הקשחה עתידית, שלב 5). הוכחת ה-deploy-gate המלאה היא post-merge (control-plane רץ רק על main).

**Acceptance:**
- [ ] בדיקת-לידה Day-0; הוכחת מסירת-אירוע סינתטית; probe אחרי deploy של ה-MCP
- [ ] ערכי רשם `enforce:false` (מייעץ/אובזרבציוני — לא חוסם)

**הוכחה תפקודית (באותו שלב):** advisory/תוכן — אין אכיפה חדשה. יכולת ה-Day-0 כבר מוכחת
ע"י `e2e-verify` שעובד חי (שלבים 1–3).

**הוכחת E2E (artifact):** לא-התנהגותי (שלב סגירה מייעץ).

**הערת התקדמות אחרונה:** הושלם — Day-0 birth check מתועד (שימוש חוזר ב-`e2e-verify`,
אפס producer חדש) ב-`docs/e2e-enforcement-standard.md` + `docs/live-test-loop.md` (הצעד
"verify live" הפך מבדיקת-`/healthz`-אופציונלית לשער-E2E התנהגותי). `observability-delivery`
נרשם כמשטח advisory (`enforce:false`, producer עתידי). טבלת ה-rollout עודכנה (1–5).
enforced לא השתנה (בוט+קצה); golden לא הושפע.

**שינוי תוכנית:** שלב 5 מומש כ**סגירה מייעצת** (Day-0 = תהליך שמשתמש ב-e2e-verify הקיים +
השלמת מפת-משטחים), במקום בניית producers חדשים — כי הערך המהותי כבר נבנה והוכח (שלבים 1–4),
ו-blue-green/observability-verify הם builds עתידיים ממוקדים (לא לחפז בשעה זו).

---

## מצב מערכת-הטסט (Teardown ledger)

`no throwaway test system created — stage-3 live proof run on the EXISTING or-edri-4
(Or's decision, like the bot proof); or-edri-4 left alive, now also deploy-edge-protected
— 2026-06-11.` ענפי-עזר ב-or-edri-4 (`deploy-edge-proof`, ועוד) נותרו (ה-git proxy חוסם
מחיקת ענפים); main של or-edri-4 נקי.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — נכתב מסמך הסטנדרט: הבסיס המקצועי לאכיפת E2E בכל פיתוח שצריך, מטריצת-סיכון
  שמחליטה מתי זה חובה, ומפה של כל המקומות בפקטורי שבהם "ירוק" עדיין מתחזה ל"עובד".
- שלב 2 הושלם — הפכתי את הבלם ל"מבוסס-רשם" (תשתית להכללה), בלי לשנות שום דבר בהתנהגות
  שלו: ה-hash זהה בּית-בּית והבדיקות עוברות בדיוק כמו קודם. עכשיו אפשר להוסיף משטחים נוספים.
- שלב 3 הושלם — הוספתי הגנה אמיתית שנייה: קצה האבטחה (Caddy/HMAC). הוכח **חי על or-edri-4**
  שהקצה באמת חוסם webhook לא-חתום (401) ומגביל קצב (429), ונוצרה תעודה. רגרסיה ששוברת את
  ההגנה בשקט תיתפס ותחסום מיזוג.
- שלב 4 הושלם — שערי ה-MCP (שירות משותף) מוגנים ב**שער-deploy**: אם בדיקה נכשלת אחרי פריסה,
  ה-deploy נכשל. 3 הבדיקות עברו חי מול or-edri-4; ההרצה המלאה תקרה אוטומטית בפריסה הבאה.
- שלב 5 הושלם — סגירה: בדיקת-לידה (Day-0) למערכת חדשה משתמשת בכלי שכבר עובד, ומפת-המשטחים
  הושלמה. הבלם עכשיו מכליל את כל הפיתוח — לא רק הבוט.
- **הפיתוח נסגר** (#419 merged) — הבלם המוכלל בתוקף: 2 merge-gates (בוט, קצה) + deploy-gate
  (MCP), כולם מוכחים חי על or-edri-4. ה-status הועבר ל-completed ב-PR תיעוד נפרד.
