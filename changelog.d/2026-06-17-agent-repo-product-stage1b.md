## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 1b: הלולאה המלאה (walking skeleton)

הלבנה השנייה של ה-walking-skeleton: ה-broker שולח יחידת-עבודה לריפו-סוכן, העובד מריץ Claude
Code (קריאה בלבד) על המשימה, והתוצאה חוזרת לריפו-המבקש — דרך ה-broker, בלי שום סוד קבוע אצל
העובד, ולעולם לא סוכן↔סוכן ישיר. בנוי על `gcp-action.yml` + `publish-static-site.yml`. ההרצה
החיה + הכרעת ה-go/no-go אחרי מיזוג ל-main.

- **`spikes/agent-skeleton/agent-main.yml` (חדש, throwaway — ה-worker)** — מופעל ע"י ה-broker
  ב-`workflow_dispatch`; auth דרך דלת-ה-WIF של 1a (בלי סוד קבוע), קורא `anthropic-api-key`
  בזמן ריצה (מוסתר), מריץ `anthropics/claude-code-action@v1` **read-only** (`Read,Grep,Glob`,
  בלי Bash/Write/Web) על המשימה — שמטופלת כ**דאטה לא-מהימנה** (`task/task.txt`, הקשחת
  prompt-injection של Microsoft). מחלץ את התשובה מ-`execution_file` ל-`result/<corr>.json`
  ומעלה artifact `agent-result`. **בלי git push, בלי יציאה החוצה** — ה-broker מושך את ה-artifact.
  בשלב 2 יקודם ל-`templates/agent-repo/.github/workflows/`.
- **`.github/workflows/agent-action.yml` (חדש — ה-broker)** — מופעל על or-factory-master בלבד,
  רץ כ-broker SA (WIF, main-locked). ליחידת-עבודה: (1) קורא את המשימה מה-issue של ה-requester
  (token `issues` לריפו ההוא בלבד), (2) מ-dispatch את ה-worker עם המשימה+correlation_id (token
  `actions` לריפו ההוא בלבד), (3) **polling** של ריצת ה-worker עד טרמינל (broker-PULL — העובד
  לא יוצא החוצה), (4) מוריד את ה-artifact, (5) מפרסם את התוצאה בחזרה ל-issue של ה-requester
  (upsert לפי marker), (6) פולט `factory.agent_action.{started,dispatched,completed,failed}`
  דרך `emit-event.sh`. כל קפיצה חוצה-ריפו = token broker App טרי, מינימלי, לריפו-בודד; charset
  מתוקף; refuses control/factory. סיווג-סיכון + אישור-טלגרם ל-red יגיעו בשלב 4.
- **`monitoring/registry-exempt.txt`** — `agent-action.yml` נוסף (dispatch-only, אין cadence).

אין נגיעה ב-`templates/system/**` (שער הזהב לא נדרס) ולא בקבצי-התנהגות-בוט (שער E2E no-op).
