## מחקר-אינטרנט אסינכרוני ארוך לבוט הטלגרם (async-deep-research)

### שלב 1 — שלד + מנגנון אסינכרוני (ברמת התבנית; מערכות חדשות בלבד)

- **וורקפלו חדש `templates/system/workflows/n8n/deep-research.json`** — עובד-רקע למחקר ארוך:
  `executeWorkflowTrigger` → (Read Style Profile, אופציונלי) → `Deep Research Agent`
  (`@n8n/n8n-nodes-langchain.agent` v2.2 על `anthropic/claude-sonnet-4.5`, `maxIterations:20`,
  שני כלי Tavily `web_search_quick`/`web_search_extended`, prompt "מחקר עמוק" רב-סבבים + בלוק
  `[[SOURCES]]`) → `Egress Validation (deep)` (תאומת לוגיקת ה-egress של הראוטר: חסימת exec/eval,
  strip של `<script>`, redaction לפי allowlist, שימור מקורות deduped ≤10) → `Send Report`
  (Telegram self-send ל-`@@CHAT_ID@@`, `appendAttribution:false`). הדוח **מחולק ל-chunks ≤3500
  תווים** (≤3 גוף + בלוק מקורות תמיד כהודעה אחרונה נפרדת, כך שמקורות לא נופלים בדוח ענק).
- **`agent-router.json`** — נתיב deep אסינכרוני בין `Sanitize Input` ל-`Classify Intent`:
  `Detect Deep Research` (מזהה מילות-הפעלה מפורשות: "תחקור לעומק"/"מחקר עמוק"/"deep research"
  וכו', מקלף את הביטוי ומשאיר נושא נקי) → `Deep Gate` (switch) → ענף deep: `Kick Deep Research`
  (`executeWorkflow` → `@@SUB_DEEP_RESEARCH_WF_ID@@`, **`options.waitForSubWorkflow:false`** =
  fire-and-forget) → `Deep Ack` (תשובת "🔎 מתחיל מחקר מעמיק…" מיידית) → Egress. ענף normal →
  המסווג הקיים ללא שינוי (5 האינטנטים לא נגעו → אין שינוי ב-eval battery).
- **`configure-agent-router.yml`** — התקנה+publish של `deep-research.json` לפני הראוטר (n8n 2.x
  מסרב לפרסם הורה שמפנה ל-sub לא-מפורסם), לכידת `SUB_DEEP_RESEARCH_WF_ID` והזרקתו לראוטר, הזרקת
  creds (OpenRouter/Tavily/Postgres/Telegram/CHAT_ID); graceful degradation: בלי Postgres — strip
  ל-Read Style Profile; בלי Tavily/Telegram/chat-id — הנתיב כולו (Deep Gate/Kick/Deep Ack) מוסר
  מהראוטר ו-`Detect Deep Research` מנותב ישירות ל-`Classify Intent` (מילת-ההפעלה נופלת לזרימה
  הרגילה — אף פעם לא נשאר kick שמצביע ל-id ריק). שורה ל-deep-research בטבלת הסיכום.
- **`agents.manifest.json`** — סעיף `background_workers` חדש המתעד את deep-research (מופעל בביטוי,
  לא intent; self-send לטלגרם — חריג מכוון לחוזה ה-single-voice).
- golden רוענן (122 קבצים); המנגנון (`waitForSubWorkflow:false`, `maxIterations`) אומת מול n8n-MCP;
  לוגיקת Detect+Egress+chunking + שתי טרנספורמציות ה-strip אומתו ב-Node על קלט אמיתי.
- **`monitoring/registry-exempt.txt`** — `deep-research.json` נוסף לרשימת הפטור של שער השומר
  (sub-workflow ב-executeWorkflowTrigger בלבד, ללא cadence משלו; ה-executions מכוסים קולקטיבית ע"י
  `system-n8n-executions`) — כמו `tg-vision`/`request-write-action`.
- **מנגנון:** הקו הסינכרוני חוזר תוך שניות (ack), המחקר רץ כ-execution עצמאי ברקע (דקות) ושולח את
  הדוח לטלגרם בעצמו — עוקף את ה-timeout של webhook הטלגרם. שוחרר ע"י `n8n-2x-upgrade` (2.25.7).

### תיקון Day-0 שנתפס באימות החי — פרסום תתי-הוורקפלו של tg-inbound (2.x)

- **באג שהתגלה על factory-test-053 (build טרי על 2.25.7):** שער-הכניסה `tg-inbound` נשאר `active:false`
  אחרי configure → הבוט לא הגיב בטלגרם. שורש: ב-n8n 2.x פרסום הורה שמפנה דרך `executeWorkflow` (חיבור
  ראשי) ל-sub **לא-מפורסם** נדחה — ו-tg-inbound קורא ל-`tg-vision`/`tg-voice-stt`/`pending-actions-executor`
  שהותקנו `activate=no`. (הסוכנים פורסמו תקין כי הם קוראים ל-sub דרך `toolWorkflow`, שלא דורש פרסום.)
  התגלה רק עכשיו כי ה-round-trip בטלגרם נבדק לאחרונה על **1.121** (לפני שדרוג 2.x), שם active=true לא
  דרש פרסום תלויות.
- **תיקון ב-`configure-agent-router.yml`:** שלושת תתי-הוורקפלו שה-tg-inbound קורא להם דרך executeWorkflow
  עוברים ל-`activate=yes` (פרסום) — לפני tg-inbound. ‏executeWorkflowTrigger הוא טריגר no-op, אז sub
  מפורסם לעולם לא יורה את עצמו (זהה לדפוס 5 הסוכנים + 7 תתי-ה-prod). golden רוענן.
