<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הזיכרון/המצפן של הסוכן — לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית לפי דרישה.
-->
---
dev_name: מחקר-אינטרנט אסינכרוני ארוך (deep research) לבוט הטלגרם — ברמת התבנית
slug: async-deep-research
opened: 2026-06-10
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — מחקר-אינטרנט אסינכרוני ארוך לבוט הטלגרם

## מטרה

היום הבוט יודע לחפש באינטרנט חיפוש **מהיר** (Tavily, סינכרוני). חסר מחקר **ארוך של דקות**:
הבוט עונה מיד "מתחיל לחקור", המחקר רץ **ברקע**, והתשובה המלאה נשלחת לטלגרם בנפרד כשמוכנה — בלי
לתקוע את השיחה. שינוי **ברמת התבנית** → רק מערכות **חדשות** (n8n 2.25.7) מקבלות. שוחרר ע"י
`n8n-2x-upgrade`. החלטות Or: הפעלה ב**מילת-מפתח מפורשת** ("תחקור לעומק"); מנוע **פנימי ב-n8n**
עם הכלים הקיימים (Tavily + Claude sonnet-4.5) — **בלי מפתח/סוד/עלות חדשים**.

המנגנון: ב-n8n 2.x ל-`executeWorkflow` יש "Wait for Sub-Workflow Completion" — כבוי = fire-and-forget
(ההורה ממשיך מיד; ה-sub רץ ברקע). ה-sub שולח את הדוח ישירות לטלגרם בעצמו (כמו `tg-proactive`), כך
שעוקף את ה-timeout של הקו הסינכרוני. אין צורך ב-Wait/resumeUrl (המחקר מתבצע בתוך n8n).

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שלד + מנגנון אסינכרוני (כל הקוד + golden + שערים סטטיים) | completed | `templates/system/workflows/n8n/deep-research.json` (חדש), `agent-router.json`, `agents.manifest.json`, `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/**` |
| 2 | אימות חי על מערכת-טסט (costed, Or-gated) | pending | — (dispatch בלבד) |
| 3 | קידום (מיזוג ל-main) + תיעוד + סגירה | pending | `docs/telegram-chat-bot.md`, `docs/roadmap.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*. הוכחה תפקודית
> מלאה (round-trip חי בטלגרם) היא שלב 2; שלב 1 מוכח סטטית (golden + validate_workflow).

---

### שלב 1 — שלד + מנגנון אסינכרוני

**Acceptance:**
- [ ] `deep-research.json` חדש: `executeWorkflowTrigger` → (Read Style Profile) → `Deep Research Agent`
  (agent v2.2, sonnet-4.5, 2 כלי Tavily `@@CRED_TAVILY_ID@@`, maxIterations גבוה, prompt "מחקר עמוק"
  + `[[SOURCES]]`) → `Egress Validation (deep)` (עותק לוגיקת ה-egress מהראוטר + chunking ≤3500) →
  `Send Report` (Telegram `@@CHAT_ID@@`/`@@CRED_TELEGRAM_ID@@`, item-לכל-chunk).
- [ ] `agent-router.json`: `Detect Deep Research` בין Sanitize ל-Classify; ענף deep → `Kick Deep Research`
  (`executeWorkflow` → `@@SUB_DEEP_RESEARCH_WF_ID@@`, **Wait=OFF**) → `Deep Ack` → Egress; ענף no →
  Classify כרגיל (5 האינטנטים ללא שינוי).
- [ ] `configure-agent-router.yml`: התקנה+publish של `deep-research.json` לפני הראוטר, לכידת
  `@@SUB_DEEP_RESEARCH_WF_ID@@` והזרקתו לראוטר, הזרקת creds, הרחבת strip ה-Tavily לכסות deep-research +
  הסרת ה-deep-kick מהראוטר כשאין Tavily, שורה בטבלת הסיכום.
- [ ] `agents.manifest.json`: רשומת מטא ל-deep-research (background worker).
- [ ] golden מרוענן (`--update`) באותו PR; פתק changelog; devplan מעודכן.
- [ ] שערים סטטיים ירוקים: Playground tests (golden) + Changelog gates (golden-sync) + shellcheck/yamllint + JSON תקין.

**הוכחה תפקודית (באותו שלב):** `validate_workflow` של ה-n8n-MCP על `deep-research.json` = `valid:true`
0 שגיאות; פרמטר ה-Wait=OFF (`options.waitForSubWorkflow:false`) ו-`maxIterations` אומתו מול `get_node`;
לוגיקת `Detect Deep Research` (זיהוי+קילוף ביטוי), `Egress (deep)` (redaction+dedup+chunking, מקורות
תמיד נשלחים) ושתי טרנספורמציות ה-strip (no-Tavily router / no-Postgres) הורצו ב-Node על קלט אמיתי —
כולן PASS. golden (122) + golden-sync + yamllint + single-voice gate PASS מקומית. (round-trip חי = שלב 2.)

**הערת התקדמות אחרונה:** הקוד נכתב ואומת מקומית במלואו. `deep-research.json` חדש (agent v2.2 sonnet-4.5
+ 2 כלי Tavily + egress+chunking), הראוטר מזהה מילת-מפתח ויורה fire-and-forget עם ack מיידי, `configure`
מתקין+מפרסם לפני הראוטר עם graceful-degradation מלא, golden רוענן. ממתין ל-CI ירוק ולאישור Or לשלב 2
(אימות חי — costed).

**שינוי תוכנית:** —

---

### שלב 2 — אימות חי על מערכת-טסט (costed, Or-gated)

**Acceptance:**
- [ ] באישור Or: החלת שינוי-הענף על מערכת-טסט חיה עם Tavily (יעד מועדף: `factory-test-tavily2`)
  דרך `prove-on-test-system.yml` (ענף) או — אחרי מיזוג — `refresh-system-agents.yml` → `configure`.
- [ ] מבחן טלגרם אמיתי: "תחקור לעומק <נושא>" → (1) ack מיידי (<5ש'); (2) דוח מלא + בלוק "מקורות"
  מגיע בנפרד אחרי דקות; (3) שאלה רגילה (בלי מילת-מפתח) עדיין עוברת בזרימה הקיימת.
- [ ] הצלבה ב-`inspect_n8n_execution`: שני executions — ההורה המהיר + הרקע הארוך העצמאי שרץ אחרי
  שההורה הסתיים (הוכחת fire-and-forget).

**הוכחה תפקודית (באותו שלב):** round-trip חי בטלגרם כמתואר למעלה + צילום ה-executions ב-MCP.

**הערת התקדמות אחרונה:** שלב 1 CI ירוק לגמרי (6/6 בדיקות PASS על 792a348). ממצא: כל מערכות-הטסט
(`factory-test-tavily2`, `052`, וכל ה-`factory-test-0XX`) **מאורכבות** — אין מערכת חיה לאמת עליה.
לכן שלב 2 דורש **build טרי מלא** (provision reuse → register-app → deploy), ואז החלת שינוי-הענף דרך
`prove-on-test-system.yml` (sandbox, ref=ענף) + `configure-agent-router.yml`. ממתין לאישור Or על העלות.

**ביצוע שלב 2 (factory-test-053):** provision ✅ → register-app (קליקים של Or) ✅ → deploy (n8n חי,
healthz 200) ✅ → prove-on-test-system (PR+מיזוג דרך CI של מערכת-הטסט, sandbox identity) ✅ → configure ✅.
**אומת מותקן+פעיל חי:** `deep-research` (id 8HuUyaFSsZxz0J7z) **active**, `Agent Router` (QXTOIJ5enl41e6Xb)
**active** עם נתיב ה-deep מחובר (ה-id הוזרק, לא הוסר). **חסם לאימות ה-round-trip:** `tg-inbound`
(שער-הכניסה הכללי של הבוט) נשאר `active:false` גם אחרי הרצת configure חוזרת — ה-upsert עובר אבל ההפעלה
לא נתפסת (נצפו גם timeouts ב-smoke על המכונה). **לא קשור ל-deep-research** (tg-inbound.json קוד-תבנית
שלא נגעתי בו, עבד על 052/tavily2 לפני השינוי) — תקלת-הפעלה סביבתית/2.x של השער האחרון שמותקן. ה-gateway
של n8n-mcp בסשן מחובר למערכת אחרת (or-tok) ולכן לא ניתן להפעיל משם ידנית. החלטת המשך מובאת ל-Or.

**שינוי תוכנית:** היעד `factory-test-tavily2` כבר לא חי (מאורכב) → אי-אפשר reuse. שלב 2 הופך מ"רענון
מערכת חיה" ל"build טרי מלא של מערכת-טסט חדשה" (reuse על factory-test-25, 0-quota אך Railway/DNS/repo
אמיתיים). האימות של שינוי-הענף לפני מיזוג נעשה דרך `prove-on-test-system.yml` (רץ off-main עם זהות
ה-sandbox), שמחיל את ה-templates של הענף על מערכת-הטסט ומריץ configure.

---

### שלב 3 — קידום + תיעוד + סגירה

**Acceptance:**
- [ ] מיזוג ל-`main` (CI ירוק) — זו ההפצה.
- [ ] `docs/telegram-chat-bot.md` + `docs/roadmap.md` (שורת async deep-research → done) עודכנו.
- [ ] Teardown ledger מתועד; `status: completed`; פתק changelog.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (תיעוד) + מיזוג ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## מצב מערכת-הטסט (Teardown ledger)

> שורה חיה אחת: `torn-down — <date/session>` **או** `left-alive by user decision — <date/session>`.
> נכון לעכשיו: טרם הוקמה/הוחלה מערכת-טסט (שלב 2 עוד לא רץ).

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — בנינו את כל הקוד: וורקפלו חדש שעושה מחקר ארוך ברקע ושולח את הדוח לטלגרם לבד, והבוט יודע
  לזהות "תחקור לעומק" ולענות מיד "מתחיל לחקור" בלי לחכות. הכל נבדק מקומית ועובד; השערים האוטומטיים ירוקים.
  השלב הבא (אימות חי על מערכת-בדיקה) עולה כסף ולכן ימתין לאישורך.

