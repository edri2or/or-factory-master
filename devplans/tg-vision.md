---
dev_name: הבנת תמונה לבוט הטלגרם (tg-vision)
slug: tg-vision
opened: 2026-06-01
status: active   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — הבנת תמונה לבוט הטלגרם (tg-vision)

## מטרה

שכל מערכת חדשה שהפקטורי מייצר תיוולד עם יכולת "הבנת תמונה" בבוט הטלגרם: כשמשתמש שולח תמונה,
הבוט קורא את הטקסט שבה (OCR, כולל עברית), מבין מה רואים בה, ומחזיר פירוש בעברית. היום תמונה
בלי כיתוב פשוט נזרקת ב-`tg-inbound.json` (`if (!text) return []`). היכולת היא דיפולט בכל מערכת
חדשה (provision-only), דרך ה-OpenRouter שכבר מחובר — בלי ספק/סוד חדש. שינוי בתהליך-ההקמה →
מוכח על מערכת-טסט חיה זולה לפני קידום. `agent-router.json` ושער ה-Macro-F1 לא נוגעים.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | תשתית התוכנית (devplan + פתק changelog) | completed | `devplans/tg-vision.md`, `changelog.d/2026-06-01-tg-vision.md` |
| 1 | `tg-vision.json` — סאב-workflow קריאת-תמונה | pending | `templates/system/workflows/n8n/tg-vision.json`, `tests/golden/system/` |
| 2 | `tg-inbound.json` — זיהוי תמונה + ניתוב | pending | `templates/system/workflows/n8n/tg-inbound.json`, `tests/golden/system/` |
| 3 | `configure-agent-router.yml` — התקנת tg-vision | pending | `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/` |
| 4 | תיעוד — AGENTS.md.template + docs | pending | `templates/system/AGENTS.md.template`, `docs/telegram-chat-bot.md`, `docs/openrouter-integration.md`, `tests/golden/system/` |
| 5 | אימות חי (costed) + קידום + פירוק | pending | מערכת-טסט חד-פעמית (reuse mode) |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 0 — תשתית התוכנית

**Acceptance:**
- [x] `devplans/tg-vision.md` נוצר מהתבנית עם `status: active`, מטרה וטבלת-שלבים.
- [x] `changelog.d/2026-06-01-tg-vision.md` נוצר.

**הערת התקדמות אחרונה:** הושלם — קובץ-התוכנית והפתק קיימים.

**שינוי תוכנית:** —

---

### שלב 1 — `tg-vision.json` (סאב-workflow חדש)

**Acceptance:**
- [ ] Trigger `executeWorkflowTrigger` passthrough מקבל `{file_id, chat_id, file_size, mime}`.
- [ ] גארד-20MB מחזיר הודעת-עברית ידידותית ועוצר.
- [ ] Telegram "Get File" (download) → Code binary→base64 + MIME דינמי (חסין).
- [ ] HTTP POST ל-OpenRouter (Qwen3-VL, prompt הגנתי, טקסט-לפני-תמונה) + fallback Gemini ב-error.
- [ ] Egress-Validation (מראָה L5) → `{ reply }`.
- [ ] `jq .` תקין; placeholders רק מותרים; golden מרוענן; "Playground tests" ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — `tg-inbound.json` (זיהוי תמונה + ניתוב)

**Acceptance:**
- [ ] `Extract & Normalize` מזהה `msg.photo[הגדול]` ו-`msg.document` image/*; לא זורק; מסמן `route='image'`.
- [ ] ענף `image` ב-`Route Update` → executeWorkflow `@@WF_TG_VISION_ID@@` → `Send Reply` הקיים.
- [ ] מסלולי טקסט/אישור והקריאה ל-router לא נגעו; golden מרוענן; CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — `configure-agent-router.yml` (התקנה)

**Acceptance:**
- [ ] שלב-התקנת tg-vision (כבוי) לפני prep של §5b; לכידת `TG_VISION_WF_ID`.
- [ ] החלפת `@@WF_TG_VISION_ID@@` ב-tg-inbound; cred OpenRouter+Telegram מוחלפים ב-tg-vision; soft-fail.
- [ ] golden מרוענן; "Changelog gates" + "Playground tests" ירוקים.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [ ] `AGENTS.md.template` מתאר את ענף-התמונה בזרימת-הבוט.
- [ ] `docs/telegram-chat-bot.md` + `docs/openrouter-integration.md` מעודכנים.
- [ ] golden מרוענן; CI ירוק.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — אימות חי + קידום + פירוק (costed — אישור-Or מפורש)

**Acceptance:**
- [ ] מערכת-טסט (reuse, 0 מכסה) הוקמה והשינוי הוחל חי.
- [ ] תמונת-טקסט-עברי + תמונת-סצנה → פירוש-עברי תקין; גארד-20MB עובד; fallback Gemini מאומת.
- [ ] קודם ל-`main`; מערכת-הטסט פורקה (`decommission-test-system.yml`).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 0 הושלם — הקמנו את קובץ-התוכנית ואת פתק-השינויים. עוד לא נגענו בקוד.
