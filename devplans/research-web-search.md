<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית לפי דרישה.
-->
---
dev_name: יכולת חיפוש ומחקר-אינטרנט לבוט הטלגרם (ברמת התבנית)
slug: research-web-search
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — יכולת חיפוש ומחקר-אינטרנט לבוט הטלגרם

## מטרה

סוכן המחקר של הבוט (workflow ב-n8n) מצהיר היום מפורשות שאין לו חיפוש-אינטרנט — הוא עונה רק
מהידע הפנימי של המודל. מוסיפים לו יכולת חיפוש ומחקר דרך **Tavily** (חיפוש מהיר + מורחב לפי
בקשה), **ברמת התבנית** של הפקטורי, כך שכל מערכת **חדשה** תקבל אותה מובנית. שינוי בתבנית →
משפיע רק על מערכות חדשות (מערכות קיימות לא מקבלות רטרואקטיבית — עיקרון הפקטורי).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | כלי חיפוש Tavily בסוכן + ההתקנה | completed | `templates/system/workflows/n8n/research-agent.json`, `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/**` |
| 2 | תיקון Egress — בלוק "מקורות" לא נחסם | completed | `templates/system/workflows/n8n/agent-router.json`, `tests/golden/system/**` |
| 3 | אימות חי (Layer B — build על factory-test-25) | completed | — (dispatch בלבד) |
| 6 | סבב 2: חיפוש לסוכן-השיחה הכללי (unknown-agent) + הידוק prompt + הרחבת strip | in-progress | `unknown-agent.json`, `configure-agent-router.yml`, golden |
| 7 | סבב 2: מודל חזק (sonnet-4.5) + הידוק prompt לסוכן-המחקר | in-progress | `research-agent.json`, golden |
| 8 | סבב 2: אימות חי (build טרי מ-main) | pending | — (dispatch בלבד) |
| 4 | תיעוד | pending | `docs/telegram-chat-bot.md`, `docs/roadmap.md` |
| 5 | מחקר-עמוק אסינכרוני — **נדחה (תלוי n8n 2.0)** | pending | `templates/system/workflows/n8n/deep-research.json` (עתידי) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — כלי חיפוש Tavily בסוכן + ההתקנה

**Acceptance:**
- [ ] `research-agent.json`: "Research Reply" הומר ל-`@n8n/n8n-nodes-langchain.agent` v2.2 (השם נשמר); `web_search_quick` (basic) + `web_search_extended` (advanced) נוספו כ-`toolHttpRequest` עם credential `@@CRED_TAVILY_ID@@`, מחוברים ב-`ai_tool`.
- [ ] system-prompt תוקן: משפט ה"no web-search" הוסר; נוספו הוראות שימוש בשני הכלים + בלוק "מקורות" עם קישורים מלאים (dedup) + איסור המצאת URLs.
- [ ] `configure-agent-router.yml`: credential "Tavily (factory-master)" נוצר (Bearer), `CRED_TAVILY_ID` נלכד, הוזרק ל-research-agent, strip graceful-degradation לשני הכלים כש-`TAVILY_KEY` ריק.
- [ ] golden מרוענן באותו PR; פתק changelog; devplan מעודכן.
- [x] static gates ירוקים (Playground tests + Changelog gates) — אומת מקומית: golden + reference-sync PASS, JSON/YAML תקינים.
- [ ] Layer-A: smoke על מערכת-הייחוס ירוק (no-regression בלבד — ראה הערה ב-יומן).

**הערת התקדמות אחרונה:** הקוד נכתב ואומת מקומית — research-agent.json (agent v2.2 + 2 כלי Tavily + prompt מתוקן), configure-agent-router.yml (credential + הזרקה + strip), golden רוענן, reference-sync PASS. מחכה ל-CI ירוק על ה-PR ולאישור Or לשלב 2. Layer-A יבוצע באישור Or (re-deploy costed) או יוסבר מדוע מדלגים.

**שינוי תוכנית:** —

---

### שלב 2 — תיקון Egress (בלוק "מקורות" לא נחסם)

**Acceptance:**
- [ ] "Egress Validation" מזהה בלוק-מקורות מסומן ופוטר אותו מ-redaction (קישורים מלאים נשמרים + dedup); גוף התשובה ממשיך להיחסם ע"י ה-allowlist הקיים.
- [ ] חסימת `exec/eval`, strip של `<script>`, ותקרת 4000 תווים — נשמרו. ה-allowlist לא הורחב גורף.
- [x] golden מרוענן; פתק changelog; devplan מעודכן.
- [x] static gates ירוקים (golden + reference-sync PASS); אומת ב-Node (3 מקרים). Layer-A smoke יבוצע באישור Or או יוסבר מדוע מדלגים.

**הערת התקדמות אחרונה:** ה-Egress עודכן — בלוק `[[SOURCES]]` שורד עם קישורים מלאים (dedup, cap 10, כותרת "מקורות:"), גוף התשובה עדיין נחסם לפי allowlist, ותשובות ללא marker ללא שינוי. אומת ב-Node על 3 מקרים. golden + reference-sync PASS. מחכה ל-CI ירוק ולאישור Or לשלב 3 (האימות החי — costed).

**שינוי תוכנית:** —

---

### שלב 3 — אימות חי (Layer B, costed — Or-gated)

**Acceptance:**
- [ ] באישור Or: `provision-system.yml` (reuse על factory-test-25) → `register-system-app.yml` → `deploy-railway-cloudflare.yml` → `configure-agent-router.yml`, כל ריצה ל-success (poll).
- [ ] `verify_*` תואמים; הודעת טלגרם אמיתית → תשובת מחקר עם בלוק "מקורות"; חיפוש מהיר + מורחב עובדים (`inspect_n8n_execution`).
- [ ] הוצע teardown (`decommission-test-system.yml`, user-triggered בלבד).

**הערת התקדמות אחרונה:** אימות חי לפני מיזוג אינו אפשרי — כל מערכת נבנית מ-`main` (broker WIF CEL נעוץ ל-`refs/heads/main`), והשינוי על ענף ה-PR. build ראשון (`factory-test-tavily`) הצליח טכנית אך רץ עם קוד ישן (אין בלוג יצירת חיבור Tavily). **החלטת Or:** מזג תחילה (שלבים 1-2, CI ירוק), ואז build טרי מ-main לאימות Tavily חי. שני test-systems יתומים לניקוי: `tavily-test-01` (repo בלבד) + `factory-test-tavily` (Railway חי) — teardown באישור Or.

**שינוי תוכנית:** האימות החי הופנה ל-Layer B (build טרי על factory-test-25) במקום מכונית-הייחוס — מכונית-הייחוס תקולה כרגע (403 "Host not in allowlist") וגם לא ניתן לדחוף לה קוד מהסשן הזה (scope מוגבל ל-or-factory-master). **לקח 1:** מערכת test בריביוז על factory-test-25 חייבת שם שמתחיל ב-`factory-test-` — ה-test_pool WIF חוסם שמות אחרים (`tavily-test-01` נדחה ב-deploy עם `unauthorized_client / attribute condition`). **לקח 2:** provision/configure רצים תמיד מ-main, אז שינוי-תבנית לא-מוזג לא ניתן לאימות חי לפני מיזוג → סדר נכון: מזג → build טרי → אמת.

**Acceptance:**
- [ ] `docs/telegram-chat-bot.md` (שורת יכולות) + `docs/roadmap.md` (שורת web-search) עודכנו.
- [ ] פתק changelog; static gates ירוקים; devplan `status: completed`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### סבב 2 — תיקון חוויה (שלבים 6–8)

**רקע:** אימות חי על `factory-test-tavily2` (build טרי מ-main) הראה שהצנרת עובדת אבל החוויה גרועה.
אבחון מבוסס-לוג: (1) **"פיצול אישיות"** — החיפוש נוסף רק ל-research-agent; ה-classifier מנתב חלק
מההודעות ל-unknown-agent שאין לו חיפוש (execution 27=unknown-agent ענה "אין לי גלישה", 30=research
ענה "כן"); (2) **תשובות שגויות** — research-agent על haiku-4.5 סיכם שגוי (מכבי ת"א במקום הפועל ב"ש);
(3) **חשיפת שמות-כלים** ("websearchquick/extended").

#### שלב 6 — חיפוש ל-unknown-agent + הידוק prompt + הרחבת strip
**Acceptance:**
- [x] `unknown-agent.json`: `web_search_quick`+`web_search_extended` (`@@CRED_TAVILY_ID@@`) + connections `ai_tool` ל-"Chat Agent".
- [x] prompt: סעיף WEB SEARCH + בלוק `[[SOURCES]]` + "לעולם לא 'אין לי גלישה'" + לא לחשוף שמות-כלים.
- [x] `configure-agent-router.yml`: ה-strip מכסה גם `unknown-agent.json`.
- [x] golden מרוענן; JSON/YAML תקינים; golden+reference-sync PASS.
- [ ] CI ירוק על ה-PR.

**הערת התקדמות אחרונה:** הקוד נכתב ואומת מקומית. ממתין ל-CI ולאישור Or לאימות חי (שלב 8).

**שינוי תוכנית:** —

#### שלב 7 — מודל חזק + הידוק prompt לסוכן-המחקר
**Acceptance:**
- [x] `research-agent.json`: מודל → `anthropic/claude-sonnet-4.5`.
- [x] prompt: היצמד לתוצאות החיפוש, אל תחשוף שמות-כלים, לעולם לא "אין לי גלישה".
- [x] golden מרוענן; PASS.
- [ ] CI ירוק על ה-PR.

**הערת התקדמות אחרונה:** הקוד נכתב ואומת מקומית (סונט-4.5, prompt מהודק).

**שינוי תוכנית:** —

#### שלב 7א — כלי `refresh-system-agents.yml` (לולאת אימות חי זולה — "דפוס טסט-030")
**רקע:** אי אפשר לבנות-מחדש מערכת קיימת (preflight של provision מסרב), והגישה שלי ל-git נעולה
ל-or-factory-master. לכן בניתי כלי קבוע: workflow פקטורי שדוחף את ה-JSONים העדכניים לריפו של
מערכת קיימת + מריץ configure — בלי re-provision. כך כל סבב תיקון עתידי ≈ 2 דקות, 0 קליקים.
**Acceptance:**
- [x] `.github/workflows/refresh-system-agents.yml` נכתב (mint broker token scoped → clone → copy n8n JSONs → push ל-main → trigger configure). yamllint + supply-chain gates PASS.
- [x] נוסף ל-allowlist של `dispatch_workflow` (`services/mcp-server/src/tools.ts`); `tsc` עובר.
- [x] שורת CLAUDE.md + פתק changelog.
- [ ] CI ירוק על ה-PR.
- [ ] **gated:** redeploy של ה-MCP (`deploy-mcp-server.yml`) כדי שה-allowlist ייכנס לתוקף — אישור Or לפני.

**הערת התקדמות אחרונה:** הקוד מוכן ואומת מקומית. נשאר: מיזוג → redeploy MCP (gated) → ואז הכלי זמין.

**שינוי תוכנית:** התגלה שאי-אפשר re-provision מערכת קיימת + git נעול ל-or-factory-master → נדרש כלי ייעודי (refresh-system-agents) במקום rebuild. Or אישר "בנה את הלולאה כיכולת קבועה".

#### שלב 8 — אימות חי סבב 2 (costed, Or-gated)
**Acceptance:**
- [ ] דרך `refresh-system-agents.yml` על `factory-test-tavily2` (push JSONים סבב-2 + configure) — בלי rebuild.
- [ ] אימות בטלגרם: גם שיחה רגילה וגם מחקר מחפשים, בלי "אין לי גלישה", בלי שמות-כלים חשופים, תשובות מדויקות יותר; הצלבה ב-`inspect_n8n_execution`.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — מחקר-עמוק אסינכרוני (נדחה)

**Acceptance:**
- [ ] **חסום** עד שדרוג n8n ל-2.0 או אימות חי ש-Wait בתוך sub-workflow יציב ב-1.121. follow-up בלבד — לא מתחילים לפני סגירת התלות.

**הערת התקדמות אחרונה:** נדחה ביודעין — המנגנון האסינכרוני שבור עד n8n 2.0; המערכת על 1.121.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- הערה חשובה: האימות האמיתי שהחיפוש עובד נעשה על **מערכת test חדשה** (שלב 3), כי מערכת-הייחוס הוקמה לפני שנוצר מפתח Tavily ולכן לא תקבל אותו. שלב 1–2 נבדקים על מערכת-הייחוס רק לוודא ש"לא שברנו כלום".
- שלב 1 הושלם — הוספנו לבוט שני כלי חיפוש-אינטרנט (מהיר ומעמיק) דרך Tavily, לימדנו אותו מתי להשתמש בכל אחד ולצרף מקורות, וההתקנה האוטומטית מטפלת גם במקרה שאין מפתח (הבוט פשוט ימשיך לענות מהידע שלו).
- שלב 2 הושלם — תיקנּו את "שומר הסף" כך שקישורי-המקורות שהבוט מצרף בסוף התשובה יגיעו אליך במלואם בטלגרם, בלי כפילויות; שאר התשובה ממשיכה להיות מוגנת בדיוק כמו קודם.
- שלב 3 (אימות חי): התברר שאי אפשר לבדוק חי לפני מיזוג — כל מערכת נבנית מהקוד ה"רשמי" (main), והתוסף עדיין בטיוטה. סוכם: ממזגים קודם, ואז בונים מערכת-בדיקה אחת טרייה ובודקים את החיפוש חי בטלגרם.
- שלב 3 הושלם — בנינו מערכת-בדיקה טרייה מ-main, והחיפוש אכן הותקן ופעל (חיבור Tavily נוצר, הבוט חיפש והחזיר מקורות). אבל באמת-מבחן עם Or התגלו 3 בעיות איכות → פתחנו סבב 2.
- סבב 2 (שלבים 6–7) — הקוד מוכן: נתנו חיפוש גם לסוכן-השיחה הרגיל (סוף ל"פיצול האישיות"), העלינו את סוכן-המחקר למודל חזק יותר, והידקנו את ההוראות (לא לחשוף שמות-כלים, לעולם לא "אני לא יכול לחפש"). נשאר: מיזוג + אימות חי (שלב 8).
- בניתי כלי קבוע (refresh-system-agents) שמחיל תיקון על מערכת חיה קיימת תוך ~2 דקות בלי לבנות מחדש — בדיוק לולאת טסט-030 שביקשת. מעכשיו כל סבב תיקון זול ומהיר. צריך redeploy קטן של ה-MCP פעם אחת כדי להפעיל אותו (אבקש אישור).
