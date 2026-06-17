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
  רץ כ-broker SA (WIF, main-locked). ליחידת-עבודה: (1) מקבל את המשימה כקלט ומ-dispatch את ה-worker
  עם המשימה+correlation_id (token `actions` לריפו-העובד בלבד), (2) **polling** של ריצת ה-worker
  עד טרמינל (broker-PULL — העובד לא יוצא החוצה), (3) מוריד את ה-artifact, (4) כותב את התוצאה
  בחזרה לריפו-ה-requester כקובץ `results/<corr>.json` (token `contents` לריפו ההוא בלבד), (5) פולט
  `factory.agent_action.{started,dispatched,completed,failed}` דרך `emit-event.sh`. כל קפיצה
  חוצה-ריפו = token broker App טרי, מינימלי, לריפו-בודד (עם retry להשהיית-קליטה של ריפו טרי);
  charset מתוקף; refuses control/factory. סיווג-סיכון + אישור-טלגרם ל-red יגיעו בשלב 4.
  > **ממצא (ערוץ ה-requester = קבצים, לא GitHub issues):** ה-broker App מחזיק
  > `administration/contents/actions/secrets/workflows/pull_requests/metadata/organization_administration`
  > אבל **לא `issues`** — לכן הנפקת token עם `issues:write` נכשלת (422). הערוץ של ה-requester הוא
  > **קבצים** (`contents`, git-native): התוצאה חוזרת כ-`results/<corr>.json`. מעבר ל-issues היה
  > דורש שינוי-הרשאות ל-App המרכזי + re-consent (מהלך גדול, Or-gated) — נמנע. תואם גם את D5′ (נתיב
  > תוצאה-כתגובת-issue ממילא הוסר מהתקדים).
- **`monitoring/registry-exempt.txt`** — `agent-action.yml` נוסף (dispatch-only, אין cadence).

אין נגיעה ב-`templates/system/**` (שער הזהב לא נדרס) ולא בקבצי-התנהגות-בוט (שער E2E no-op).
