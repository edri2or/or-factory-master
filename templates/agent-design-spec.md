<!--
תבנית אפיון-סוכן (agent design-spec) — ממולאת על ידי /build-agent בשלב Step 0.
זהו תוצר תכנון: סיכום קצר ל-Or חי בצ'אט (עברית) — את הקובץ הגולמי Or לא פותח.
הסוכן שומר את הגרסה הממולאת ל-docs/agent-specs/<intent>.md (intent תואם ל-manifest
ול-slug של workflows/n8n/<intent>-agent.json). שמור על ≤ עמוד אחד (fast) / ≤ 2 (full).
הרציונל המלא + מטריצת ההחלטה + רצף השערים: docs/research/agent-role-decomposition-planning.md
שיטות הוכחה-בבידוד (Pin data / sub-workflow / n8n Public API): docs/agent-isolation-testing.md
-->
---
intent: @@INTENT@@
date: @@YYYY-MM-DD@@
architecture: single-agent   # single-llm-call | single-agent | orchestrating-workflow | multi-agent
depth: fast                  # fast | full
---

# Agent design-spec — @@INTENT@@

## Fast path (ברירת המחדל — סוכן יחיד, בלי כלים)

מלא רק את ארבע השורות. אם הסוכן מחזיק כאן — **עצור**; כל מה שמתחת הוא לסוכן מורכב בלבד.

- **Job:** <משפט אחד — מה הסוכן עונה / עושה>
- **Architecture:** single agent → מחזיר `{reply}` ל-orchestrator. ללא כלים. ללא שערים מיוחדים.
- **Golden cases:** <3–5 משפטי-ניתוב אמיתיים → tests/router_battery.yaml>
- **הוכחת-תפקוד (לבד):** <fixture אחד — קלט אמיתי נעוץ — + הפלט המצופה ממנו, ואיך
  מריצים את הסוכן לבד ורואים שזה הפלט. ראה docs/agent-isolation-testing.md.>

> אם סימנת `architecture: single-llm-call` (תשובה טריוויאלית) — ציין זאת כאן וסיים.

---

## Full path (רק כשהמטריצה נוחתת על orchestrating-workflow או multi-agent)

### 0. כרטיס יכולת (Capability Card) — Phase 1: הוכח את היכולת הגולמית **מחוץ ל-n8n** (לפני §1)

לפני פירוק ועיצוב — לכל יכולת-ליבה שהסוכן תלוי בה (ה*פועל*: "קרא / מלא / שלח / חלץ"), הוכח שהיא
עובדת על קלט אמיתי **מחוץ ל-n8n** (curl או ~20 שורות node/python ישירות ל-API), ורק אז עבור לעיצוב.
שער ההיתכנות למטה נסגר על סמך הכרטיס הזה. המתודולוגיה המלאה + 3 דוגמאות-עבודה: docs/capability-first.md.

| יכולת | הוכחה גולמית (כלי + פקודה, מחוץ ל-n8n) | fixture אמיתי | פלט מצופה | הכרעה (go/no-go) | סיכונים / הנחות (`משוער`) |
|---|---|---|---|---|---|
| <היכולת> | <curl / ~20 שורות node/python> | <קובץ/payload אמיתי> | <פלט מאומת-ביד> | <go / no-go / partial> | <מה לא מאומת — סמן `משוער`> |

> אם ההכרעה no-go/partial — **עצור ושנה-סקופ לפני בנייה** (כלי אחר / OCR בסיסי + LLM חיצוני / לומר ל-Or
> שלא ישים). base64-בתוך-JSON מוכיח מחרוזת בלבד; binary אמיתי — אל תסמוך על pinning (ראה §3 + capability-first.md).

### 1. מטרה + למה סוכן
<מה המטרה; למה סוכן ולא קריאת-LLM בודדת ולא workflow קבוע מראש>

### 2. מטריצת ההחלטה (קריאת הארכיטקטורה)
| קריטריון | קריאה | משמעות |
|---|---|---|
| read vs. write (קריאה מול כתיבה) | <…> | <…> |
| parallelism (מקביליות) | <…> | <…> |
| context pressure (לחץ הקשר) | <…> | <…> |
| מספר מצבים (retrieve/reason/decide/act/verify) | <…> | <…> |
| 3–5 פונקציות נבדלות | <…> | <…> |
| value > cost (ערך מול עלות) | <…> | <…> |

**Verdict:** <single-agent | orchestrating-workflow | multi-agent> — <שורה אחת למה>

### 3. רכיבים, אחריות, ו**הוכחת-תפקוד לכל רכיב**
ל-orchestrating-workflow: רשום כל תת-סוכן, האחריות *היחידה* שלו, וה-`{reply}` שהוא מחזיר.
ה-workflow המתזמר קורא לכל אחד דרך executeWorkflow ומרכיב `{reply}` **יחיד** ל-orchestrator.
לעולם לא handoff/transfer — זה שובר את חוק הקול-האחד (ראה מחקר §7).

**חובה — עמודת "הוכחה לבד":** לכל רכיב הגדר *מראש* (לפני בנייה) איך מוכיחים שהוא עושה
את עבודתו **לבד**: fixture (קלט אמיתי נעוץ) → פלט מצופה → שיטת-בדיקה. בלי השורה הזו אסור
להתחיל לבנות את הרכיב (זה ה-eval-before-build, §6). זה גם מגדיר את **סדר הבנייה הבוטום-אפ**:
מוכיחים כל רכיב לבד → מוכיחים את ההרכבה לבד (בלי ה-orchestrator) → מחברים ל-orchestrator אחרון.

| רכיב | אחריות יחידה | מחזיר | fixture (קלט נעוץ) | פלט מצופה | שיטת-בדיקה |
|---|---|---|---|---|---|
| <sub-agent-1> | <…> | `{reply}` | <דוגמה אמיתית> | <פלט> | <det. assert / field-diff / judge> |
| <sub-agent-2> | <…> | `{reply}` | <…> | <…> | <…> |

> **שיטת-בדיקה — deterministic-first:** קודם בדיקה דטרמיניסטית (JSON תקין → שדות
> קריטיים ב-exact match), ורק לטקסט פתוח LLM-as-judge. למשל יכולת קריאת-טופס: השדה
> `email`/סכומים ב-exact, טקסט חופשי ב-field-diff. ראה docs/agent-isolation-testing.md.

> **fixture עם binary — אזהרה:** fixture שהוא base64 בתוך JSON ניתן לנעיצה אך מוכיח רק
> העברת-מחרוזת (לא decode/stream/multipart). ל-binary אמיתי (קובץ ב-Webhook, attachment) — n8n
> עלול לדווח הצלחת-node תוך השמטת ה-binary בשקט, **כולל ב-pinning**; הוכח end-to-end דרך trigger
> אמיתי, לא ב-pinning. ראה docs/capability-first.md ו-docs/agent-isolation-testing.md §4.

### 4. זהות / פרסונה
<שם ייחודי + תיאור יכולת ברור לניתוב. תיאור מעורפל גורם ל"הרעלת הקשר".>

### 5. מודל
<ברירת מחדל `openrouter/auto`; ספציפי רק עם סיבה. קבע baseline עם מודל חזק, רד היכן שעובר evals.>

### 6. כלים
<לכל כלי: שם · I/O · דירוג סיכון low/med/high. סיכון גבוה (כתיבה/לא-הפיך/יקר) → HITL דרך
request_write_action. לעולם לא SQL חופשי או כלי-כתיבה ישיר.>

### 7. הוראות
<מטרות, do/don't, מקרי קצה, דוגמאות few-shot.>

### 8. חוזה I/O
<לכל רכיב — תמיד חוזה `{reply}`. קלט מה-orchestrator: sanitized/intent/confidence/entity_mention.>

### 9. זיכרון / מצב
<קצר-טווח (חלון שיחה) מול ארוך-טווח (Postgres). ברוב המקרים: window memory בלבד.>

### 10. מעקות בטיחות (guardrails)
<מעקה בודד לא מספיק. מעקות נפרדים עדיפים על אותו LLM שמטפל גם בתשובה. egress validation.>

### 11. קריטריוני הצלחה + evals
<20–50 golden cases מנוסחים *לפני* הבנייה; הערך תוצאה (outcome), לא התאמה מדויקת.
מינימום מעשי: אפילו fixture אמיתי 1 עם פלט-מצופה הוא שער בינארי תקף; גדל מ-traces אמיתיים.>

### 12. מצבי כשל + HITL
<שני טריגרים לעצירה אנושית: (1) חריגה מסף כשלים/ניסיונות; (2) פעולה לא-הפיכה/יקרה.>

---

## רשימת שערים — בסדר בנייה בוטום-אפ (gate list)

לפני בנייה:
- [ ] שער היתכנות (feasibility go/no-go) — אחרי הוכחת היכולת הגולמית מחוץ ל-n8n (Phase 1); ראה docs/capability-first.md
- [ ] סקירת פירוק — כל רכיב = אחריות יחידה + **שורת הוכחה-לבד מוגדרת** (§3)
- [ ] eval-before-build — 20–50 golden cases (או ≥1 fixture/רכיב) נכתבו *לפני* בנייה
- [ ] נקודות HITL זוהו לפעולות סיכון-גבוה

בזמן בנייה — **3 שערים מסודרים** (מחליפים את "E2E gate" היחיד; ראה מחקר §8):
- [ ] **שער 1 — תפקוד כל רכיב לבד:** כל רכיב עובר את ה-fixture→פלט-מצופה שלו, בבידוד
      (Pin data / sub-workflow / n8n Public API — בלי ה-MCP).
- [ ] **שער 2 — הרכבה לבד:** ה-workflow המתזמר מחזיר `{reply}` יחיד נכון על קלט-דוגמה,
      **בלי** לחבר ל-orchestrator (single-step → trajectory).
- [ ] **שער 3 — ניתוב ל-orchestrator:** רק אחרון — `check-agent-single-voice.sh` +
      Macro-F1 ≥ 0.85; בדיקה זו בודקת **ניתוב/העברה** בלבד, לא תפקוד-פנימי (שכבר הוכח).
