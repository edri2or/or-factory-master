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
| 1 | כלי חיפוש Tavily בסוכן + ההתקנה | pending | `templates/system/workflows/n8n/research-agent.json`, `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/**` |
| 2 | תיקון Egress — בלוק "מקורות" לא נחסם | pending | `templates/system/workflows/n8n/agent-router.json`, `tests/golden/system/**` |
| 3 | אימות חי (Layer B — build על factory-test-25) | pending | — (dispatch בלבד) |
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
- [ ] static gates ירוקים (Playground tests + Changelog gates).
- [ ] Layer-A: smoke על מערכת-הייחוס ירוק (no-regression בלבד — ראה הערה ב-יומן).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — תיקון Egress (בלוק "מקורות" לא נחסם)

**Acceptance:**
- [ ] "Egress Validation" מזהה בלוק-מקורות מסומן ופוטר אותו מ-redaction (קישורים מלאים נשמרים + dedup); גוף התשובה ממשיך להיחסם ע"י ה-allowlist הקיים.
- [ ] חסימת `exec/eval`, strip של `<script>`, ותקרת 4000 תווים — נשמרו. ה-allowlist לא הורחב גורף.
- [ ] golden מרוענן; פתק changelog; devplan מעודכן.
- [ ] static gates ירוקים; Layer-A smoke ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — אימות חי (Layer B, costed — Or-gated)

**Acceptance:**
- [ ] באישור Or: `provision-system.yml` (reuse על factory-test-25) → `register-system-app.yml` → `deploy-railway-cloudflare.yml` → `configure-agent-router.yml`, כל ריצה ל-success (poll).
- [ ] `verify_*` תואמים; הודעת טלגרם אמיתית → תשובת מחקר עם בלוק "מקורות"; חיפוש מהיר + מורחב עובדים (`inspect_n8n_execution`).
- [ ] הוצע teardown (`decommission-test-system.yml`, user-triggered בלבד).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [ ] `docs/telegram-chat-bot.md` (שורת יכולות) + `docs/roadmap.md` (שורת web-search) עודכנו.
- [ ] פתק changelog; static gates ירוקים; devplan `status: completed`.

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
