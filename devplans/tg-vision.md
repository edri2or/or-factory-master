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
| 1 | `tg-vision.json` — סאב-workflow קריאת-תמונה | completed | `templates/system/workflows/n8n/tg-vision.json`, `tests/golden/system/` |
| 2 | `tg-inbound.json` — זיהוי תמונה + ניתוב | completed | `templates/system/workflows/n8n/tg-inbound.json`, `tests/golden/system/` |
| 3 | `configure-agent-router.yml` — התקנת tg-vision | completed | `templates/system/.github/workflows/configure-agent-router.yml`, `tests/golden/system/` |
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
- [x] Egress-Validation (מראָה L5) → `{ reply }`.
- [x] `jq .` תקין; placeholders רק `@@CRED_TELEGRAM_ID@@`/`@@CRED_OPENROUTER_ID@@`; golden מרוענן; שערים מקומיים ירוקים.

**הערת התקדמות אחרונה:** הושלם — `tg-vision.json` נבנה (10 nodes): trigger passthrough → Normalize&Guard
(גארד-20MB + drop ל-file_id חסר) → IF Blocked? → Get File (Telegram, download) → To Base64 Data-URI
(המרה חסינה עם getBinaryDataBuffer fallback + MIME דינמי, בונה את גוף-הבקשה עם prompt הגנתי) →
HTTP Qwen3-VL (predefinedCredentialType openRouterApi) → error→ HTTP Gemini fallback → Extract Reply
→ Egress Validation. JSON תקין, golden רוענן (MANIFEST +1 שורה), validate-templates + golden-gate ירוקים מקומית.
ממתין לאימות "Playground tests" ב-CI.

**שינוי תוכנית:** העברתי את בניית גוף-הבקשה (model+messages+data-URI) ל-node ההמרה (`To Base64 Data-URI`)
כך ש-nodes ה-HTTP רק מבצעים `JSON.stringify` — מונע ביטוי-JSON שביר עם prompt עברי ארוך. שימוש ב-`openRouterApi`
predefinedCredentialType ב-httpRequest (במקום סוד גולמי) כדי לנצל את ה-credential הקיים. שני ענפי-error
(Qwen ו-Gemini) זורמים ל-Extract Reply, שמחזיר הודעת-עברית ידידותית אם שניהם נפלו — אין מסלול ללא תשובה.

---

### שלב 2 — `tg-inbound.json` (זיהוי תמונה + ניתוב)

**Acceptance:**
- [ ] `Extract & Normalize` מזהה `msg.photo[הגדול]` ו-`msg.document` image/*; לא זורק; מסמן `route='image'`.
- [x] ענף `image` ב-`Route Update` → executeWorkflow `@@WF_TG_VISION_ID@@` → `Send Reply` הקיים.
- [x] מסלולי טקסט/אישור והקריאה ל-router לא נגעו; golden מרוענן; שערים מקומיים ירוקים.

**הערת התקדמות אחרונה:** הושלם — `Extract & Normalize` מזהה עכשיו `msg.photo[הגדול]` ו-`msg.document`
image/* (תופס `file_id`/`file_size`/`mime_type`); תמונה ללא כיתוב כבר לא נזרקת (`if (!text && !fileId)`).
ה-Switch `Route Update` קיבל כלל `image` שלישי (פלט 1; `chat` עבר לפלט 2) → `Prep Vision Input` (Set,
בונה {file_id,chat_id,file_size,mime}) → `Call tg-vision` (executeWorkflow `@@WF_TG_VISION_ID@@`) →
`Send Reply` הקיים. ה-`Call Agent Router` וה-`Send Reply` לא נגעו בלוגיקה (אומת ב-jq). JS עבר `node --check`,
golden רוענן (MANIFEST), שערים ירוקים מקומית. ממתין ל-CI.

**שינוי תוכנית:** הוספתי `Prep Vision Input` (Set) לפני ה-executeWorkflow — בדיוק כדפוס `Prep Executor Input`
של מסלול-האישור — כי `Dedup Guard` (Postgres) מחליף את ה-json בשורת-ה-RETURNING, אז חייבים לבנות את קלט
tg-vision מ-`$('Extract & Normalize')` במפורש (לא מסתמכים על passthrough של הפריט הזורם). הקובץ עוצב מחדש
ל-indent=2 (כמו `tg-vision.json`) כתוצאה מעריכה תכנותית בטוחה — שינוי קוסמטי בלבד, הלוגיקה זהה.

---

### שלב 3 — `configure-agent-router.yml` (התקנה)

**Acceptance:**
- [ ] שלב-התקנת tg-vision (כבוי) לפני prep של §5b; לכידת `TG_VISION_WF_ID`.
- [x] החלפת `@@WF_TG_VISION_ID@@` ב-tg-inbound; cred OpenRouter (`$CRED_ID`)+Telegram (`$CRED_TELEGRAM_ID`) מוחלפים ב-tg-vision; soft-fail.
- [x] golden מרוענן; שערים מקומיים ירוקים (actionlint נקי, yamllint נקי, סימולציות jq עברו).

**הערת התקדמות אחרונה:** הושלם — הוספתי ל-§5b (בתוך `if SKIP_TELEGRAM=no`, לפני הכנת tg-inbound) שלב
שמתקין את tg-vision (כבוי, `_upsert_wf ... no`) עם החלפת `@@CRED_TELEGRAM_ID@@`/`@@CRED_OPENROUTER_ID@@`,
לוכד `TG_VISION_WF_ID`. ל-sed של tg-inbound נוסף `-e s#@@WF_TG_VISION_ID@@#${TG_VISION_WF_ID}#g`. הוספתי
**פס-בטיחות**: אם tg-vision לא הותקן (קובץ חסר / upsert נכשל) — jq מסיר את ענף-התמונה (2 nodes + כלל ה-image)
ומחזיר את `Route Update` ל-2 פלטים, *לפני* ה-strips הקיימים (approval/dedup) ששומרים על אותו מבנה. אומת:
החלפה רגילה → JSON תקין, 0 placeholders שנותרו; strip → ענף הוסר נכון, Switch חזר ל-approval+chat. golden רוענן.

**שינוי תוכנית:** הוספתי פס-בטיחות (image-branch strip) שלא היה מפורש בתוכנית — מראה את דפוס ה-graceful-degradation
הקיים (approval-path strip), כדי ש-tg-inbound לעולם לא יצביע ל-sub-workflow חסר. רץ ראשון כדי לא להתנגש עם
ה-strips הקיימים.

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
- שלב 1 הושלם — בנינו את ה"עיניים" של הבוט (`tg-vision`): מוריד תמונה מטלגרם, שולח ל-OpenRouter עם הוראת-אבטחה, מחזיר פירוש בעברית, עם גיבוי אוטומטי ובלם לתמונות-ענק. השערים האוטומטיים ירוקים.
- שלב 2 הושלם — חיברנו את העיניים: עכשיו כשמגיעה תמונה הבוט מזהה אותה (במקום לזרוק) ושולח אותה ל-tg-vision, ואז מחזיר את הפירוש. מסלול הטקסט והאישורים לא נגעו בכלל. השערים ירוקים.
- שלב 3 הושלם — "חיברנו לחשמל": המתקין של כל מערכת חדשה יתקין עכשיו את tg-vision וילחים אותו ל-tg-inbound אוטומטית, עם ה-credential הקיים. הוספתי גם הגנה: אם משהו משתבש בהתקנה, הבוט פשוט ממשיך לעבוד בלי הפיצ'ר (במקום לקרוס). השערים ירוקים.
