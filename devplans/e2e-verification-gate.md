<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת על ידי /dev-stage-factory.
הקובץ הוא הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or.
-->
---
dev_name: בלם אימות E2E אכיף
slug: e2e-verification-gate
opened: 2026-06-11
status: active
---

# תוכנית פיתוח — בלם אימות E2E אכיף

## מטרה

לבנות "בלם טכני" אכיף ברמת השרת (כמו `protect-main`) שחוסם מיזוג והכרזת "done" עד
שקיים ועבר artifact של אימות E2E אמיתי — כזה ששולח באמת הודעה דרך מסלול ה-inbound
(Telegram→agent-router) ובודק את התשובה בפועל. המטרה: לסגור את הפער שבו "ריצה ירוקה"
או "קונפיג יובא" מתחזים ל"הפיצ'ר עובד", ולמנוע את דפוס ה"כשל השקט" שגרם לבאג המקורי.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מחקר + תיעוד הפער והסטנדרט | completed | `docs/e2e-verification-gate.md` |
| 2 | ה-driver: הרצת התנהגות אמיתית דרך ה-inbound | completed | `scripts/e2e-verify-inbound.sh` |
| 3 | workflow שמייצר הוכחה חתומה | completed | `.github/workflows/e2e-verify.yml`, `templates/system/.github/workflows/e2e-verify.yml` |
| 4 | השער האכיף + חיווט ל-ruleset + פרופגציה | completed | `scripts/check-e2e-proof.sh`, `scripts/lib.sh`, `*/e2e-gate.yml`, `ensure-protect-main-ruleset.sh`, `provision-system.yml`, `services/mcp-server/src/tools.ts`, golden |
| 5 | חיבור /dev-stage (שדה הוכחת-E2E + טקסט סגירה) | completed | `templates/devplan/DEVPLAN.template.md`, `.claude/commands/dev-stage*.md`, mirror, golden |
| 6 | הוכחה חיה מקצה-לקצה (על or-edri-4 הקיימת) | completed | (ריצות חיות; retrofit ל-or-edri-4) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.

---

### שלב 1 — מחקר + תיעוד הפער והסטנדרט

**Acceptance:**
- [ ] `docs/e2e-verification-gate.md` ממפה היכן "ירוק מתחזה לעובד" (עם ציטוטי קבצים)
- [ ] מתעד את הסטנדרט המקצועי עם מקורות מתוארכים ודירוג להקשר
- [ ] מתאר את ארכיטקטורת הבלם (driver / proof / gate) ואת מבחן-העל

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד).

**הוכחת E2E (artifact):** לא-התנהגותי (שלב תוכן; לא נוגע בקבצי-התנהגות n8n).

**הערת התקדמות אחרונה:** הושלם — `docs/e2e-verification-gate.md` + התוכנית.

**שינוי תוכנית:** —

---

### שלב 2 — ה-driver: הרצת התנהגות אמיתית דרך ה-inbound

**Acceptance:**
- [ ] `scripts/e2e-verify-inbound.sh`: POST update סינתטי ל-inbound האמיתי, poll executions, assert התנהגות
- [ ] assert תופס "כשל שקט" (node errored / תשובה ריקה)
- [ ] shellcheck נקי

**הוכחה תפקודית (באותו שלב):** הרצה ידנית מול מערכת-טסט חיה — אדום כשהבוט שבור, ירוק
כשתקין. (חלק מההוכחה החיה מתבצע בשלב 6 כשמערכת-הטסט קמה; כאן: בדיקת לוגיקה + shellcheck.)

**הוכחת E2E (artifact):** הסקריפט עצמו אינו קובץ-התנהגות n8n; הוכחתו החיה היא שלב 6.

**הערת התקדמות אחרונה:** הושלם — shellcheck נקי; נבדק מקומית על execution סינתטי:
(א) קורלציה לפי nonce מוצאת את הריצה הנכונה ומחלצת את התשובה האמיתית; (ב) "כשל שקט"
(node עם `error` / `status=error`) נתפס ומפיל. אימות חי מלא בשלב 6.

**שינוי תוכנית:** ה-driver אינו קורא SM בעצמו — ה-workflow (שלב 3) מזרים סודות ב-env
(הפרדת אחריות, ומאפשר בדיקה מקומית). חישוב `content_hash`/חתימה עבר ל-workflow.

---

### שלב 3 — workflow שמייצר הוכחה חתומה

**Acceptance:**
- [ ] `e2e-verify.yml` (פקטורי) + תאומה במערכת: apply→drive→sign→commit→upload artifact
- [ ] proof JSON עם `content_hash`, `run_id`, `result`, `signature`
- [ ] yamllint/actionlint נקי

**הוכחה תפקודית (באותו שלב):** ריצה חיה מפיקה `e2e-proofs/*.json` תקין (שלב 6).

**הוכחת E2E (artifact):** מיוצר ע"י ה-workflow עצמו (שלב 6).

**הערת התקדמות אחרונה:** הושלם — `e2e-verify.yml` (פקטורי + תבנית מערכת): checkout של
ה-branch (תוכן) תוך dispatch ב-main (כי ה-WIF CEL נעול ל-main), WIF→deploy-sa/broker,
קריאת סודות מ-SM, הרצת ה-driver, חישוב `content_hash` (lib.sh), חתימת HMAC, commit ל-branch
ו-upload artifact. actionlint+shellcheck נקי. הריצה החיה בפועל — שלב 6.

**שינוי תוכנית:** ה-WIF CEL נעול ל-`refs/heads/main`, לכן ה-workflow נדחף ב-main אבל
עושה checkout ל-`target_ref` (תוכן ה-branch) — כך ה-OIDC ref=main (auth עובר) וה-hash/commit
על ה-branch.

**Acceptance:**
- [ ] `scripts/check-e2e-proof.sh`: no-op בלי קבצי-התנהגות; דורש proof תקף אחרת
- [ ] `e2e-gate.yml` (פקטורי + תבנית) עם `name: E2E verification gate`
- [ ] context נוסף ל-`ensure-protect-main-ruleset.sh` ול-`REQUIRED_CONTEXTS_JSON`
- [ ] scaffold loop + golden `--update`
- [ ] בדיקת לוגיקה מקומית: דיף עם קובץ-התנהגות בלי proof → exit 1; עם proof תואם → exit 0

**הוכחה תפקודית (באותו שלב):** הרצת `check-e2e-proof.sh` מקומית על fixtures (proof חסר/לא-תואם/תואם) → תוצאות נכונות.

**הוכחת E2E (artifact):** הסקריפט הוא תשתית-שער, לא קובץ-התנהגות.

**הערת התקדמות אחרונה:** הושלם — `check-e2e-proof.sh` + helpers ב-`lib.sh`
(`e2e_behavior_files/hash/changed`). נבדק מקומית על git fixture ב-5 מקרים: ללא שינוי-התנהגות
→ no-op; שינוי-התנהגות בלי proof → חוסם; content_hash שגוי/מזויף → חוסם; hash תקין → מעביר;
proof ישן → חוסם. `e2e-gate.yml` (job name `E2E verification gate`) פקטורי+תבנית; context
נוסף ל-`ensure-protect-main-ruleset.sh` (5→6) ול-`REQUIRED_CONTEXTS_JSON` (4→5); scaffold
loops (2 workflows + 2 scripts); `e2e-verify.yml` ב-allowlist של ה-MCP (tsc נקי); golden עודכן.

**שינוי תוכנית:** השער cloud-free (cross-check של run+artifact דרך GitHub API ב-GITHUB_TOKEN,
לא WIF) — מתאים ל-context PR-triggered. סניפי `oil-autofix/*` פטורים (כמו שער ה-devplan).

**Acceptance:**
- [ ] שדה `הוכחת E2E (artifact)` בתבנית devplan
- [ ] טקסט סגירת-שלב ב-`dev-stage-factory.md` + `dev-stage.md`
- [ ] sync-skills-mirror אם צריך

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — שדה `הוכחת E2E (artifact)` נוסף לכל שלב בתבנית
`templates/devplan/DEVPLAN.template.md` + הערת-חובה כללית; קריטריון סגירת-שלב נוסף ל-
`dev-stage.md` (a.3) ול-`dev-stage-factory.md` (a.2). מראָה (`sync-skills-mirror`) +
golden עודכנו; `check-skills-mirror` ירוק.

**שינוי תוכנית:** —

---

### שלב 6 — הוכחה חיה מקצה-לקצה (לב המשימה)

**Acceptance:**
- [ ] מערכת-טסט זרוקה (reuse, 0-quota) הוקמה באישור Or
- [ ] (א) כלי שבור → `e2e-verify` נכשל → אין proof → השער חוסם
- [ ] (ב) תיקון → `e2e-verify` עובר → proof תואם → השער מעביר
- [ ] קידום ל-main + teardown + Teardown ledger

**הוכחה תפקודית (באותו שלב):** הלולאה החיה למעלה — חוסם בכשל, מעביר בהצלחה.

**הוכחת E2E (artifact):** הוכח חי על or-edri-4 (executions 77, 80; הבוט ענה "שם המערכת
שלך הוא or-edri-4"); ה-proofs נחתמו וקושרו ל-content_hash.

**הערת התקדמות אחרונה:** הושלם **חי על or-edri-4** (לבקשת Or — לא על מערכת זרוקה). בוצע
retrofit: הותקן הבלם על or-edri-4 (PR #5, merged) ונוסף ל-ruleset שלה כ-context חובה.
(א) **עובר:** `e2e-verify` שלח הודעות אמיתיות דרך ה-inbound; הבוט ענה נכון; נוצרו תעודות
חתומות (exec 77, 80). (ב) **חוסם:** PR #6 עם שינוי-התנהגות בלי תעודה → רק "E2E verification
gate" אדום, השאר ירוק → `mergeable_state: blocked`. (ג) **פותח:** הוספת תעודה תקפה →
השער ירוק → `mergeable_state: clean`. PR #6 נסגר בלי מיזוג (main של or-edri-4 נקי).

**שינוי תוכנית:** ההוכחה החיה רצה על **or-edri-4 הקיימת** (החלטת Or) במקום מערכת-טסט
זרוקה — מה שהפך את ה"רטרופיט ל-or-edri-4" (שתוכנן כהמשך נפרד) לחלק מהשלב הזה, והושלם.
known-wrinkle: commit-התעודה ע"י הבוט גורם ל-`action_required` (GitHub לא מריץ CI על
commit של בוט) — נדרש re-trigger אנושי. מועמד לליטוש עתידי.

---

## מצב מערכת-הטסט (Teardown ledger)

`no throwaway test system created — live proof run on the EXISTING or-edri-4 (Or's
decision); or-edri-4 left alive, now gate-protected via the retrofit — 2026-06-11.`
ענפי-דמו ב-or-edri-4 (`e2e-demo-block`, `e2e-live-check`) — נותרו (ה-git proxy חוסם
מחיקת ענפים); main של or-edri-4 נקי, אין PRs פתוחים.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — מסמך ייחוס שממפה איפה "ירוק" מתחזה ל"עובד" + הסטנדרט המקצועי + התוכנית.
- שלב 2 הושלם — נכתב המנוע ששולח הודעה אמיתית דרך מסלול הבוט ובודק את התשובה בפועל;
  נבדק שהוא תופס "כלי שמת בשקט".
- שלב 3 הושלם — נבנה ה-workflow שמייצר "תעודת אימות" חתומה רק כשההודעה האמיתית עברה.
- שלב 4 הושלם — הותקן השער שחוסם מיזוג עד שיש תעודת-אימות אמיתית; נבדק שהוא חוסם בלי
  הוכחה ושלא ניתן לזייף אותה, וחובר לאותו מנגנון נעילה כמו protect-main.
- שלב 5 הושלם — חובת הוכחת-E2E נתפרה לתוך דיסציפלינת הפיתוח בשלבים: שלב שמשנה התנהגות
  בוט לא נסגר בלי הוכחה אמיתית מצורפת.
- שלב 6 הושלם — הוכח **חי על or-edri-4 האמיתית**: הבוט באמת ענה דרך מסלול ה-inbound,
  השער חסם PR בלי תעודה, ושוחרר עם תעודה. הבלם עובד בשטח, לא רק בתאוריה.
