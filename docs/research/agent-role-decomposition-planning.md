# מחקר + תקן: פירוק תפקיד-סוכן, ובנייה שמוכיחה כל לבנה לבד

> **מה זה המסמך הזה:** ההפניה הקנונית של הפקטורי לשני דברים שקורים *לפני ותוך-כדי*
> בניית סוכן: (א) **פירוק התפקיד** — ממה הסוכן מורכב, האם זה סוכן אחד או כמה, אחריות
> לכל רכיב; ו-(ב) **משמעת הבנייה הבוטום-אפ** — להוכיח כל רכיב שעובד *לבד* על קלט
> אמיתי לפני שמניחים עליו את הבא, ולחבר את הקצה החיצוני אחרון. מוכלל לכל מערכת
> מסופקת (ה-orchestrator = הראוטר/מתזמר היחיד של המערכת, שם-קוד משתנה בין מערכות).
>
> נכתב כבסיס להחלטה ולתכנון. השיטות המעשיות: `docs/agent-isolation-testing.md`.
> התבנית למילוי: `templates/agent-design-spec.md`. המשמעת הנאכפת: `/dev-stage`.

---

## 0. תקציר (TL;DR)

- **שני פערים, לא אחד.** `/build-agent` המקורי היה טוב ב*איך לחבר* סוכן, אבל (1) דילג
  על פירוק התפקיד — *מה* לבנות והאם בכלל סוכן אחד; ו-(2) ריכז את כל ההוכחה האמיתית
  בשער-E2E יחיד בסוף, כך ש"לבדוק כל שלב" הצטמצם ל-CI-ירוק. שני הפערים מתוקנים כאן.
- **עיקרון-על אחד:** התחל מהפתרון הכי פשוט, והוסף מורכבות רק כשהיא **מוכיחה** שיפור.
  הסולם: קריאת-LLM אחת → workflow → סוכן → כמה סוכנים. (Anthropic, *Building Effective Agents*)
- **"סוכן אחד מול כמה" יש לו כלל מדיד**, לא תחושה: קריאה/מקבילות מתפצל יפה; כתיבה/
  תלוי-הקשר שובר פיצול. (LangChain מפייס בין Anthropic ל-Cognition.)
- **בנייה בוטום-אפ, מוכחת-לבד:** כל רכיב מוכח על fixture אמיתי *לבד* → ההרכבה מוכחת
  *לבד* (בלי ה-orchestrator) → החיבור ל-orchestrator אחרון. דחיית הכל ל"מפץ גדול"
  היא **אנטי-דפוס מתועד** (big-bang integration).
- **CI-ירוק הכרחי אך לא מספיק** — הוא בודק שהקוד תקין ומחובר, לא שהלבנה עושה את עבודתה.

---

## 1. הפער — מאושר מקריאה בקוד

`/build-agent` מתאר תהליך מצוין ל**מכניקה**: אסוף spec → שכפל תבנית → רשום אצל
ה-orchestrator (manifest + router + workflow + AGENTS) → הוסף golden cases → הרץ שער →
פרוס. מה ש"אסוף spec" כלל: intent, משפט-משימה, 3–5 דוגמאות ניתוב, מודל, שאלה על כלים.

**שני דברים חסרו:**
1. **פירוק:** איש לא שאל אם זו בכלל משימה לסוכן אחד, מה האחריות המדויקת של כל רכיב,
   ולפי איזו שיטה הוחלט — ולא "לפי תחושה".
2. **הוכחה-לבד פר-שלב:** "הרץ שער" היה שער-E2E **יחיד בסוף** (single-voice סטטי +
   Macro-F1 ניתוב). אף רכיב לא הוכח שעושה את עבודתו *לבד* על קלט אמיתי לפני ההרכבה.
   זה בדיוק מה שנשבר בפיילוט "סוכן הטפסים": כל שלב כתב "☐ הוכחה (חי) — בשלב 6".

---

## 2. סולם המורכבות — התחל פשוט, פצל רק בהוכחה

מקור מרכזי: **Anthropic, "Building Effective Agents"** (Schluntz & Zhang, 20.12.2024).

- *workflows* = LLM+כלים מתוזמרים ב**מסילות קוד קבועות**; *agents* = ה-LLM **מכוון את
  עצמו** דינמית. הציר = מידת האוטונומיה.
- עיקרון-העל: "מצא את הפתרון הכי פשוט, והגדל מורכבות רק כשצריך — ייתכן שזה אומר לא
  לבנות מערכת סוכנים בכלל".
- סולם: קריאת-LLM בודדת → workflow → סוכן. אבן-הבניין היא *augmented LLM* (מודל +
  retrieval + כלים + זיכרון); כל הדפוסים הם הרכבות מדורגות שלה.

> השלב חייב להתחיל בשאלה "האם זה צריך להיות סוכן בכלל, או שמספיק workflow / קריאה?".

---

## 3. מתי לפצל לכמה סוכנים — קריטריונים מדידים

מחלוקת מתועדת עם הכרעה. **בעד-פיצול** (Anthropic, multi-agent research, 6/2025): מנצח +
3–5 תתי-סוכנים מקבילים, חלון-הקשר נפרד לכל אחד; לפצל כשהמשימה חורגת מחלון, מקבילית, או
עתירת-כלים. מחיר: ~15× טוקנים; 80% מהשונות מוסברת בכמות הטוקנים → לפצל רק כש**ערך > עלות**.
**נגד-פיצול** (Cognition, *Don't Build Multi-Agents*, 6/2025): סוכנים מקבילים מפצלים הקשר →
פלט שביר; ברירת מחדל = סוכן יחיד ליניארי + דחיסת-הקשר. **ההכרעה** (LangChain, Harrison
Chase): *מערכות שבעיקר **קוראות** קל לפצל; שבעיקר **כותבות** קשה לפצל.*

**מטריצת ההחלטה** (לתבנית design-spec §2): read↔write · מקביליות · לחץ-הקשר · מספר מצבים
(retrieve/reason/decide/act/verify) · 3–5 פונקציות נבדלות · value>cost. ספים שעלו:
בהירות-כלים > ספירת-כלים (פתרון ל"יותר מדי כלים" = לסנן את הרשימה, לא לפצל); 3–5 פונקציות
נבדלות = הסף לארכיטקטורה רב-רכיבית.

---

## 4. קטלוג דפוסי הפירוק (אוצר המילים)

| דפוס | מתי | הערה |
|---|---|---|
| Prompt chaining | שלבים רצופים קבועים | אפשר **שערים** בין שלבים |
| Routing | קלט נופל לקטגוריות נבדלות קבועות | הראוטר שלנו הוא routing קלאסי |
| Parallelization | תת-משימות עצמאיות / הצבעה | להימנע כשהשלבים בונים זה על זה |
| Orchestrator-workers | מנצח מחליט בזמן ריצה איך לפרק | תת-המשימות לא קבועות מראש |
| Evaluator-optimizer | קריטריון הערכה ברור + לולאת שיפור | תנאי עצירה (max_attempts) |
| Planner-Executor (ReAct / Plan-and-Execute / ReWOO) | תכנון-מראש מול תגובה צעד-צעד | ReWOO יעיל-טוקנים |

---

## 5. מבנה "מסמך אפיון סוכן" (לתבנית)

הצלבת OpenAI / Google / Anthropic / MongoDB נותנת מקטעים מוסכמים: (1) מטרה + הצדקת
"למה סוכן" · (2) זהות/פרסונה (תיאור מעורפל = "הרעלת הקשר") · (3) מודל (baseline חזק →
רד היכן שעובר evals) · (4) כלים עם דירוג סיכון (גבוה → HITL) · (5) הוראות · (6) חוזי
I/O (אצלנו `{reply}`) · (7) זיכרון · (8) guardrails שכבתיים · (9) קריטריוני הצלחה +
evals *לפני* בנייה · (10) מצבי כשל + HITL. הכל ב-`templates/agent-design-spec.md`.

---

## 6. שיטתיות מדידה — מ"נתונים" ל"סף שער"

שרשרת אחת: ניתוח שגיאות → טקסונומיית כשלים → רוּבריקה משוקללת → קריטריון קבלה מדיד
לכל רכיב → סף שער ב-CI. **eval-before-build:** כתוב 20–50 golden cases (או ≥1 fixture
לרכיב) *לפני* הבנייה. "כישלון מוצרי AI כמעט תמיד הוא כישלון לבנות מערכת הערכה חזקה"
(Hamel Husain). אזהרה: אל תהנדס-יתר — "כל אות בשבוע הראשון עדיף על האות הנכון בחודש השישי".

---

## 7. קול-אחד: orchestrator + agent-as-tool (לא handoff)

הפריימוורקים מבחינים: **handoff/transfer** = המומחה משתלט ומדבר עם המשתמש → **אנטי-דפוס**
(שובר קול-אחד); **agent-as-tool** = המומחה עושה תת-משימה ומחזיר שליטה למנצח → **זה הדפוס
שלנו**. סוכן מורכב אצלנו = **workflow מתזמר** שקורא לכמה executeWorkflow-subagents, כל
אחד מחזיר `{reply}`, וה-workflow מרכיב `{reply}` **יחיד** ל-orchestrator. חוזה `{reply}`
= last-message בלבד (לא להדליף trace פנימי).

---

## 8. הבנייה הבוטום-אפ — 4 פאזות ו-3 שערים (התקן)

זה הלב של התיקון. **כל יכולת = לבנה שנגמרת בהוכחה תפקודית לבד**, ולא ב"קוד נכתב + CI ירוק".

**4 פאזות:**
1. **פרק** את התפקיד לרכיבים (§3 + מטריצה).
2. **הוכח כל רכיב לבד** — בנה אותו כיחידה עם קלט-דוגמה נעוץ (fixture) ופלט-מצופה, הרץ
   בבידוד (Pin data / sub-workflow / n8n Public API — בלי MCP), וראה שהפלט נכון. רק אז סגור.
3. **הוכח את ההרכבה לבד** — ה-workflow המתזמר מחזיר `{reply}` יחיד נכון, **בלי** orchestrator.
4. **חבר ל-orchestrator** — הלבנה האחרונה; בדיקת ה-orchestrator בודקת **ניתוב/העברה** בלבד.

**3 שערים מסודרים** (מחליפים את שער ה-E2E היחיד):
- **שער 1 — תפקוד כל רכיב לבד** (component / single-step).
- **שער 2 — הרכבה לבד** (assembly / trajectory, בלי orchestrator).
- **שער 3 — ניתוב ל-orchestrator** (`check-agent-single-voice.sh` + Macro-F1 ≥ 0.85).

**הבסיס התעשייתי:** פירמידת-בדיקות לסוכנים — בסיס יחידה/אינטגרציה דטרמיניסטית (LLM ממוק),
אמצע evals פר-רכיב, קודקוד דק E2E (LangWatch / Block); סולם single-step → trajectory →
final-response (LangChain); **big-bang integration = אנטי-דפוס** שמחביא כשלים ומונע בידוד
התקלה (GeeksforGeeks / Testsigma); התחל קטן — 20–50 מקרים מספיקים (Anthropic); golden
fixtures: אפילו דוגמה אחת עם פלט-מצופה היא שער בינארי תקף (Hamel / OpenAI / Braintrust).

---

## 9. מקורות

**Anthropic** — Building Effective Agents (https://www.anthropic.com/engineering/building-effective-agents, 20.12.2024) · Multi-agent research system (https://www.anthropic.com/engineering/multi-agent-research-system) · Demystifying evals (https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) · Develop tests (https://platform.claude.com/docs/en/test-and-evaluate/develop-tests).
**OpenAI** — A Practical Guide to Building Agents (https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) · Evaluation best practices (https://developers.openai.com/api/docs/guides/evaluation-best-practices).
**Google** — Startup guide: production-ready AI agents (https://cloud.google.com/blog/topics/startups/startup-guide-ai-agents-production-ready-ai-how-to) · ADK agents (https://google.github.io/adk-docs/agents/).
**Cognition / LangChain / Stanford** — Don't Build Multi-Agents (https://cognition.ai/blog/dont-build-multi-agents) · How and when to build multi-agent systems (https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems) · Evaluation approaches (https://docs.langchain.com/langsmith/evaluation-approaches).
**Testing pyramid / bottom-up** — LangWatch agent testing pyramid (https://langwatch.ai/scenario/best-practices/the-agent-testing-pyramid/) · Block testing pyramid for AI agents (https://engineering.block.xyz/blog/testing-pyramid-for-ai-agents) · Fowler IntegrationTest (https://martinfowler.com/bliki/IntegrationTest.html) · Big-bang anti-pattern (https://www.geeksforgeeks.org/software-testing/big-bang-integration-testing/ · https://testsigma.com/blog/big-bang-integration-testing/).
**Evals / fixtures** — Hamel Husain, Your AI Product Needs Evals (https://hamel.dev/blog/posts/evals/) · Braintrust golden dataset (https://www.braintrust.dev/encyclopedia/golden-dataset) · getomni.ai OCR benchmark (https://getomni.ai/blog/ocr-benchmark) · xUnit fixtures (http://xunitpatterns.com/test%20fixture%20-%20xUnit.html) · Fowler SelfInitializingFake (https://martinfowler.com/bliki/SelfInitializingFake.html).
**n8n** — Manual/partial executions (https://docs.n8n.io/workflows/executions/manual-partial-and-production-executions/) · Data mocking and pinning (https://docs.n8n.io/data/data-pinning/) · Execute Sub-workflow Trigger (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflowtrigger/) · API reference (https://docs.n8n.io/api/) · Evaluations (https://docs.n8n.io/advanced-ai/evaluations/overview/).

## 10. הסתייגות על אימות (שקיפות)

חלק מהמקורות הראשוניים (Anthropic / OpenAI / Fowler / arXiv) החזירו 403 ל-WebFetch
בסביבה, כך שחלק מהציטוטים נשענים על תקצירי-חיפוש שהצליבו זה את זה — אמינים כיווּנית,
אך לא אומתו מילה-במילה מול הדף החי. מספרים ספציפיים (15×, 80%, ספי-כלים) עקביים על פני
כמה מקורות עצמאיים; אמת מול המקור הראשוני אם נדרשת דיוק מוחלט.
