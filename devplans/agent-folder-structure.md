---
dev_name: סוכן-כתיקיה — איחוד מבנה הסוכן
slug: agent-folder-structure
opened: 2026-06-22
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — סוכן-כתיקיה (Agent-as-a-folder)

## מטרה

היום "סוכן" של מערכת מפוזר על 5 מקומות שונים בריפו (הגדרת n8n, כרטיס-סקיל, רישום במניפסט,
חיווט ב-configure, ותיעוד ב-AGENTS) — וזה מבלבל. הפיתוח הזה הופך כל סוכן ל**תיקייה אחת**
(`agents/<name>/`) שהיא מקור-האמת היחיד: `agent.yaml` + `instructions.md` + `tools.yaml`.
**מתרגם דטרמיניסטי** (סקריפט bash, לא AI) גוזר מהתיקייה את ה-JSON של n8n. הסוכן הוא הבוס,
n8n/טלגרם הם כלים. תוספת עוטפת, מדורגת, הוכחת-היתכנות-קודם — לא כתיבה-מחדש; כל השערים הקיימים
(`check-agent-single-voice.sh`, capability-first, החוזה, הזהב) נשמרים.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תקן תיקיית-הסוכן (spec + schema) | completed | `templates/system/agents/_spec/**` |
| 2 | הוכחה: code-agent כתיקייה | completed | `templates/system/agents/code/**` |
| 3 | המתרגם הדטרמיניסטי (round-trip) | completed | `scripts/compile-agent.sh`, `scripts/tests/compile-agent.bats` |
| 4 | שער CI: ולידציה + generated-in-sync | completed | `scripts/check-agent-folder.sh`, `changelog-check.yml` (factory) |
| 5 | חיווט המתרגם למנוע ההרכבה | completed | `configure-agent-router.yml`, `templates/system/scripts/compile-agent.sh` |
| 6 | `/build-agent` → "צור תיקיית-סוכן" | pending | `.claude/commands/build-agent.md` + מראה-מערכת |
| 7 | הגירת 5 הסוכנים הגנריים | pending | `templates/system/agents/{ops,code,research,infra,unknown}/` |
| 8 | תיעוד + מניפסט (סגירה) | pending | `AGENTS.md.template`, `agents.manifest.json` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*.
> שלבים 1/2/4/8 הם תבנית/סקריפט/תיעוד — לא משנים מה מערכת *טרייה* מריצה בהתקנה.
> שלבים 3/5/6/7 משנים את תוצר ה-provisioning → חייבים הוכחה חיה על or-edri-4 *לפני* מיזוג
> (`/dev-stage-factory`, `docs/live-test-loop.md`).

---

### שלב 1 — תקן תיקיית-הסוכן (spec + schema)

**Acceptance:**
- [x] קיים `templates/system/agents/_spec/agent-folder.spec.md` הממפה **שדה-בשדה** מ-
      `subagent.contract.md` / `subagent.template.json` / `agent-design-spec.md` (לא מומצא).
- [x] התקן מצהיר את החוזה הבלתי-עביר (executeWorkflowTrigger ב־, `{reply}` החוצה, אין טלגרם)
      ואת חוק שתי-פאזות-ה-placeholders (scaffold-time מול install-time).
- [x] קיימים סכמות JSON ל-`agent.yaml` ו-`tools.yaml` תחת `_spec/` (לשער שלב 4).
- [x] הזהב רוענן (`bash scripts/check-system-golden.sh --update`) ו-`check-system-golden.sh` עובר.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — אין התנהגות רצה. אימות: סקירה ידנית שכל שדה
בחוזה/בתבנית הקיימים מופיע במיפוי בתקן, + הזהב ירוק.

**הוכחת E2E (artifact):** לא-התנהגותי (אינו נוגע ב-`workflows/n8n/*.json` ולא ב-
`configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הושלם — נכתב `agent-folder.spec.md` + 2 סכמות JSON; הזהב רוענן.
ממתין לאישור Or למעבר לשלב 2.

**שינוי תוכנית:** ממצא חשוב — `code-agent.json` הקיים **חסר** את משפט-הבוילרפלייט
"You return your answer to the orchestrator…" שכן יש בתבנית. לכן ה"זנב הקבוע" שהמתרגם
יוסיף הוגדר במדויק כמתחיל ב-" Answer in the user's language…", ומשפט-ה-orchestrator תועד
כחלק מומלץ של `instructions.md`. הפער הזה ייושב סופית בשלב 3 (round-trip byte-exact).

---

### שלב 2 — הוכחה: code-agent כתיקייה

**Acceptance:**
- [x] קיים `templates/system/agents/code/` (`agent.yaml`+`instructions.md`+`tools.yaml`)
      המייצג את ה-code-agent הקיים.
- [x] התיקייה תקפה מול הסכמות משלב 1 (בדיקה ידנית; השער האוטומטי בא בשלב 4).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד — ההוכחה המלאה (round-trip) נדחית לשלב 3 (תלויה
במתרגם). כאן מאמתים רק התאמה-לסכמה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם — נכתבו 3 הקבצים תחת `agents/code/`, כל הערכים נשלפו מילולית
מ-`code-agent.json` + `agents.manifest.json`. אומת מתוכנת ש-`agent.yaml`/`tools.yaml` עוברים את
חוקי הסכמות (שלב 1), ושגוף `instructions.md` זהה byte-exact ל-prompt המקומיט (פחות הזנב הקבוע
ופסקת-הסגנון). הזהב רוענן. ממתין לאישור Or למעבר לשלב 3 (המתרגם — שלב הוכחה-חיה).

**שינוי תוכנית:** `instructions.md` נכתב **בלי** משפט-ה-orchestrator הפותח (כפי שה-`code-agent.json`
המקומיט אכן משמיט אותו) — נדרש ל-round-trip byte-exact בשלב 3. הקובץ נשמר עם newline סופי יחיד;
המתרגם בשלב 3 יחתוך אותו (`rstrip`) לפני ההרכבה.

---

### שלב 3 — המתרגם הדטרמיניסטי (round-trip)  *(הוכחה אופליין; ההרצה החיה נדחתה לשלב 5)*

**Acceptance:**
- [x] `scripts/compile-agent.sh` קורא `agents/<name>/`, מרנדר מ-`subagent.template.json`,
      ממלא scaffold-time, **משאיר install-time `@@…@@`**, ופולט את ה-JSON ל-STDOUT. v1 = ללא כלים
      (מסרב לסוכן עם כלים בהודעה ברורה). כתיבת הקובץ עצמו + סנכרון `agents.manifest.json` נדחים
      לשלב 5 (כשהחיווט באמת משתמש במתרגם) — כדי לא לשנות קובץ מקומיט עכשיו.
- [x] שאלת ה-byte-exact הוכרעה: **נרמול id-ים בדיף** (לא `node_id_prefix`) — המבחן עוטף את
      `scripts/lib/normalize-n8n.sh` בנוסף-walk שמוחק כל `.id` בכל עומק (כולל ה-id המקונן ב-Set).
      פער משפט-ה-orchestrator יושב: המתרגם **בונה** את הודעת-המערכת (גוף `instructions.md` + הזנב
      הקבוע + פסקת-הסגנון) ולא מזריק לתבנית, אז המשפט מ-הקיים בתבנית פשוט לא נכלל.

**הוכחה תפקודית (באותו שלב):** ✅ `scripts/tests/compile-agent.bats` (6 מבחנים, עוברים): דיף
מנורמל ריק מול `code-agent.json` הקיים + install-time `@@…@@` נשמרים + JSON תקין/single-voice +
3 שערי-סירוב (כלים, תיקייה חסרה, slug≠שם). זו הוכחת-הלבנה על fixture אמיתי. shellcheck נקי.

**הוכחת E2E (artifact):** **נדחתה לשלב 5** (החלטה מאושרת מול Or): בשלב 3 המתרגם לא מחובר לשום
מסלול חי, אז אין מה להוכיח חי. ההרצה החיה הראשונה על or-edri-4 (re-import דרך
`configure-agent-router.yml` + הודעת-קוד אמיתית → `e2e-proofs/agent-folder-structure.json` טרי)
תקרה בשלב 5, כשהחיווט מפעיל את המתרגם.

**הערת התקדמות אחרונה:** הושלם — נכתב `compile-agent.sh` (bash+jq+גשר Python YAML→JSON, ללא `yq`)
ומבחן ה-round-trip. הוכח אופליין שהמתרגם משחזר את `code-agent.json` בדיוק (אחרי נרמול). ממתין
לאישור Or למעבר לשלב 4 (שער ה-CI).

**שינוי תוכנית:** שניים, שניהם מצמצמים סיכון/עלות: (1) ההרצה החיה נדחתה משלב 3 לשלב 5 (אין מסלול
חי בשלב 3). (2) עותק-המערכת של הסקריפט (`templates/system/scripts/compile-agent.sh`) **לא** נשלח
עכשיו — יישלח בשלב 5 יחד עם החיווט שמשתמש בו + התלות (`normalize`/`subagent.template.json`), כדי
לא לשלוח קוד-מת ולא לרענן זהב לחינם. לכן שלב 3 לא נגע כלל ב-`templates/system/`.

---

### שלב 4 — שער CI: ולידציה + generated-in-sync

**Acceptance:**
- [x] `scripts/check-agent-folder.sh` מאמת `agent.yaml`/`tools.yaml` מול הסכמות (fail-closed) —
      דרך בודק draft-07 ב-`python3`+`pyyaml` (לא `yq`, שהריפו נמנע ממנו במכוון).
- [x] בדיקת generated-in-sync: לכל סוכן-תיקייה שיש לו גם JSON מקומיט, פלט המתרגם חייב לשחזר אותו
      (דיף מנורמל = ריק) — תאום ל-`check-golden-sync.sh`. no-op כשאין תיקיית `agents/`.
- [x] השער מחווט ל-"Changelog gates" ב-`.github/workflows/changelog-check.yml` (השער הנדרש שחוסם מיזוג).

**הוכחה תפקודית (באותו שלב):** ✅ `scripts/tests/check-agent-folder.bats` (8 מבחנים, עוברים):
העץ האמיתי עובר; אין-תיקייה = no-op; שדה-חובה חסר / enum פסול / מפתח לא-מוכר / כלי לא-מוכר —
כולם נכשלים ב-exit 1; drift בין תיקייה ל-JSON נכשל. shellcheck + yamllint נקיים.

**הוכחת E2E (artifact):** לא-התנהגותי (שער CI בלבד).

**הערת התקדמות אחרונה:** הושלם — נכתב השער + מבחן ה-bats שמוכיח את השיניים שלו, וחוּוט ל-CI.
ממתין לאישור Or למעבר לשלב 5 (חיווט המתרגם למנוע ההרכבה — **שלב ההוכחה-החיה הראשון** על or-edri-4).

**שינוי תוכנית:** השער חוּוט ל-workflow של **הפקטורי בלבד**. החיווט לצד-המערכת
(`templates/system/.github/workflows/changelog-check.yml`) + שליחת `check-agent-folder.sh` והמתרגם
לתוך מערכות דרך `provision-system.yml` — נדחים ל**שלב 7**, כשתיקיות-הסוכן באמת נשלחות למערכות (עד אז
למערכת אין `agents/` לבדוק). לכן שלב 4 לא נגע ב-`templates/system/` ולא נדרש רענון זהב — עקבי עם שלב 3.

---

### שלב 5 — חיווט המתרגם למנוע ההרכבה  *(הוכחה-חיה — בעיצומה)*

**Acceptance:**
- [x] **(קוד סטטי, הושלם)** `configure-agent-router.yml` מחדש כל סוכן-תיקייה דרך המתרגם לפני
      ה-upsert (בלוק עוטף + soft-fail: סוכן ללא תיקייה/עם כלים → נופל-לאחור ל-JSON המקומיט, אז
      מסלול ההתקנה לא יכול לסגת). המתרגם הועבר ל-`templates/system/scripts/compile-agent.sh`
      (מקור-אמת יחיד; ברירות-המחדל עובדות בפקטורי ובמערכת). הזהב רוענן.
- [x] **(הוכחה חיה — בוצעה ✅)** הוחל על or-edri-4 דרך `refresh-system-agents.yml`
      (`source_ref=הענף`, paths = configure + compile-agent.sh + agents; PR #45 מוזג, configure הופעל
      חי run 27930531022). `e2e-verify.yml` (run 27930637538) הניע הודעה אמיתית דרך or-edri-4 — הבוט
      ענה ("שם המערכת שלך הוא `or-edri-4`") → `e2e-proofs/agent-folder-structure.json` (`result: pass`,
      content_hash תואם, חתום) נדחף לענף. שער ה-E2E ב-PR ירוק.

**הוכחה תפקודית (באותו שלב):** ✅ סטטי: הודמה הפעלה-בתוך-מערכת — המתרגם רץ עם ברירות-מחדל,
שומר install-time `@@…@@`, והפלט **זהה** (מנורמל) ל-`code-agent.json` המקומיט, כך שההתנהגות החיה
לא משתנה. שערים סטטיים + מלוא ה-bats ירוקים. ⏳ חי: בהמתנה.

**הוכחת E2E (artifact):** `e2e-proofs/agent-folder-structure.json` טרי מ-or-edri-4 — **חובה לפני
מיזוג** (שער ה-E2E ב-`e2e-surfaces.json` מופעל ע"י שינוי ב-`configure-agent-router.yml` ומצמיד את
ההוכחה ל-or-edri-4). עד שהוא ירוץ, ה-PR יראה את שער ה-E2E אדום — צפוי.

**הערת התקדמות אחרונה:** הושלם — כולל ההוכחה החיה על or-edri-4. הערת מסע: ה-refresh הראשון נכשל
ב-clone עם "Repository not found" — אובחן כתקלה חולפת (הברוקר קורא+דחף ל-or-edri-4 שוב ושוב ב-15.6,
והקריאה דרך ה-MCP עבדה); הרצה חוזרת עברה נקי. ממתין לאישור Or למעבר לשלב 6/7.

**שינוי תוכנית:** המתרגם הושכן תחת `templates/system/scripts/` (לא factory `scripts/`) כדי שיגיע חי
ל-or-edri-4 דרך המנגנון התקני (שמעתיק רק תחת `templates/system/`). שליחת המתרגם + תיקיות-הסוכן
למערכות **חדשות** דרך `provision-system.yml` נדחית לשלב 7 (מערכת בלי הקבצים נופלת-לאחור בבטחה).

---

### שלב 6 — `/build-agent` → "צור תיקיית-סוכן"

**Acceptance:**
- [ ] `.claude/commands/build-agent.md` (+ מראה-המערכת) — הסקאפולד כותב **תיקייה אחת**,
      ו-Step 3 מצטמצם מ-sync-של-5-מקומות ל-"כתוב את התיקייה; המתרגם גוזר את השאר".
- [ ] capability-first + 3 השערים נשמרים. `scripts/sync-skills-mirror.sh` הורץ אם תגי audience השתנו.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד-סקיל). אימות: `check-skills-mirror.sh` ירוק.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — הגירת 5 הסוכנים הגנריים  *(הוכחה-חיה)*

**Acceptance:**
- [ ] `ops`/`code`/`research`/`infra`/`unknown` הומרו ל-`agents/<name>/`; ה-JSON-ים שלהם
      הפכו לתוצרי-מתרגם. רק אחרי שהמבנה+המתרגם+החיווט הוכחו על הדוגמה.
- [ ] שער watchdog-registry (surfaces של n8n) ושער workflow↔skill-pair נשמרים ירוקים.

**הוכחה תפקודית (באותו שלב):** דיף מנורמל ריק לכל 5 ה-JSON-ים מול הקיים + הזהב ירוק.

**הוכחת E2E (artifact):** `e2e-proofs/agent-folder-structure.json` טרי (router עדיין מנתב ל-5) — לפני מיזוג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 8 — תיעוד + מניפסט (סגירה)

**Acceptance:**
- [ ] `AGENTS.md.template` + `agents.manifest.json` מצהירים `agents/` כמקור-האמת, ומוסר
      הבלבול "agent"="system".
- [ ] התוכנית נסגרת (`status: completed`).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בלי ז'רגון.

- שלב 1 הושלם — כתבתי את "התקן" של תיקיית-הסוכן: מסמך שמסביר בדיוק אילו 3 קבצים יש בכל
  תיקיית-סוכן ומאיפה כל שדה מגיע (מיפוי מהקבצים הקיימים, לא המצאה). זה השלב התיעודי — לא נגעתי
  בשום מערכת חיה.
- שלב 2 הושלם — לקחתי את סוכן-הקוד הקיים והצגתי אותו בפעם הראשונה כ**תיקייה אחת** (3 קבצים
  קטנים וברורים), כל ערך הועתק מילה-במילה מההגדרה הקיימת. בדקתי שזה תקין ושהטקסט זהה במדויק
  למקור — זו ההוכחה שהמבנה החדש נאמן. עדיין לא נגעתי בשום מערכת חיה.
- שלב 3 הושלם — בניתי את ה"מתרגם": תוכנה פשוטה שלוקחת את תיקיית-הסוכן ובונה ממנה אוטומטית את
  ההגדרה שה-n8n מריץ. הוכחתי "על השולחן" (בלי לגעת במערכת חיה) שמה שהמתרגם מייצר עבור סוכן-הקוד
  **זהה** למה שקיים היום. כלומר אפשר לסמוך עליו שהוא נאמן למקור. אפס עלות, אפס נגיעה במערכת חיה.
- שלב 4 הושלם — הוספתי "שומר" אוטומטי שרץ על כל שינוי: הוא בודק שכל תיקיית-סוכן בנויה נכון, ושאם
  שינו תיקייה — מה שהמתרגם מייצר עדיין תואם להגדרה הקיימת. אם מישהו יקלקל תיקייה או ייצור פער, ה-CI
  יעצור אותו אדום. כתבתי גם מבחן שמוודא שהשומר באמת תופס תקלות. עדיין אפס נגיעה במערכת חיה.
- שלב 5 הושלם — **המבחן החי הראשון, על המערכת שלך or-edri-4.** חיברתי את המתרגם למנוע שמטעין את
  הבוט, החלתי את השינוי חי על or-edri-4, ושלחתי הודעת-בדיקה אמיתית — **הבוט ענה כשורה**. כלומר מעכשיו
  סוכן-הקוד של or-edri-4 נבנה מהתיקייה, וההתנהגות לא השתנתה (כמו שהבטחנו). היתה תקלת-רשת חולפת בניסיון
  הראשון; הרצה חוזרת עברה חלק.
