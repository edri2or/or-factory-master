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
| 3 | המתרגם הדטרמיניסטי (round-trip) | pending | `scripts/compile-agent.sh`, `templates/system/scripts/` |
| 4 | שער CI: ולידציה + generated-in-sync | pending | `scripts/check-agent-folder.sh`, `changelog-check.yml` (×2) |
| 5 | חיווט המתרגם למנוע ההרכבה | pending | `templates/system/.github/workflows/configure-agent-router.yml` |
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

### שלב 3 — המתרגם הדטרמיניסטי (round-trip)  *(הוכחה-חיה)*

**Acceptance:**
- [ ] `scripts/compile-agent.sh` קורא `agents/<name>/`, מרנדר מ-`subagent.template.json`,
      ממלא scaffold-time, משאיר install-time `@@…@@`, וכותב `workflows/n8n/<name>-agent.json`
      + מעדכן `agents.manifest.json`. v1 = ללא כלים.
- [ ] מוחלט איך משיגים byte-exact מול ה-id-ים של n8n (נרמול id-ים בדיף או `node_id_prefix`
      ב-`agent.yaml`) + יישוב פער משפט-ה-orchestrator משלב 1.

**הוכחה תפקודית (באותו שלב):** פלט `compile-agent.sh code` == `code-agent.json` הקיים
(דיף מנורמל = ריק). זו הוכחת-הלבנה על fixture אמיתי.

**הוכחת E2E (artifact):** החלה על or-edri-4 + re-import דרך `configure-agent-router.yml` +
הודעת-קוד אמיתית עוברת → `e2e-proofs/agent-folder-structure.json` טרי — לפני מיזוג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — שער CI: ולידציה + generated-in-sync

**Acceptance:**
- [ ] `scripts/check-agent-folder.sh` מאמת `agent.yaml`/`tools.yaml` מול הסכמות (fail-closed, `yq`).
- [ ] בדיקת generated-in-sync: שינוי בתיקייה ⇒ ה-JSON הנגזר חודש ותואם (תאום ל-`check-golden-sync.sh`).
- [ ] השער מחווט ל-"Changelog gates" ב-`.github/workflows/changelog-check.yml` וב-
      `templates/system/.github/workflows/changelog-check.yml`.

**הוכחה תפקודית (באותו שלב):** הרצה מקומית — תיקייה תקינה עוברת, תיקייה פגומה (שדה חסר)
נכשלת ב-exit 1; שינוי-תיקייה-בלי-regenerate נכשל.

**הוכחת E2E (artifact):** לא-התנהגותי (שער CI בלבד).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — חיווט המתרגם למנוע ההרכבה  *(הוכחה-חיה)*

**Acceptance:**
- [ ] `configure-agent-router.yml` סורק `agents/*/` ומריץ את המתרגם (regenerate לפני upsert),
      במקום קריאה שטוחה מ-JSON-ים מעורכים-ביד. סיכון נמוך: ה-JSON הנגזר כבר מקומיט ונבדק-בשער.

**הוכחה תפקודית (באותו שלב):** הרצה על or-edri-4 — סוכן עדיין עונה אחרי re-import דרך
המסלול החדש.

**הוכחת E2E (artifact):** `e2e-proofs/agent-folder-structure.json` טרי — לפני מיזוג.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

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
