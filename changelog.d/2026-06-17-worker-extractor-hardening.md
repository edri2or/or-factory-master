## הקשחת ה-extractor של ה-worker (worker-extractor-hardening) — שלב 0

פתיחת פיתוח מדורג (`/dev-stage`) להקשחת ה-extractor של ה-worker בריפו-הסוכן
(`templates/agent-repo/.github/workflows/agent-main.yml`). ה-extractor הנוכחי תופס את בלוק
ה-```json **הראשון** בתשובה, אז תשובות עתירות-code-fence חוזרות `status:"unstructured"` — וזה
מסכן גם את חילוץ תוכנית-הפיצול של נחשון (ה-fan-out). זה קרה חי בגל הראשון (שלב 5). המטרה:
לתפוס את הבלוק האחרון (הסנטינל), מוכח ב-before/after דטרמיניסטי + fan-out חי, ולהחיל על התבנית
ועל שלושת הריפויים החיים.

שלב 0 הוא scaffolding-תיעוד בלבד, ולכן רק שער ה-devplan מופעל (הקובץ שמשחרר אותו).

- **`devplans/worker-extractor-hardening.md` (חדש, `status: active`)** — תיק-הפיתוח: מטרה, 6 שלבים
  (0–5), Acceptance + הוכחה-תפקודית פר-שלב, יומן ל-Or. מצהיר: אין יכולת חדשה (הקשחת verb קיים) →
  capability-first Step 0 לא חל; `/dev-stage` רגיל (לא factory).
- **הגל הראשון** (`devplans/agent-repo-first-wave.md`, סגור) רשם את ההקשחה כ"הרחבה נדחית" (שורה 220)
  ותיעד את התקלה החיה (שורות 190‑192) — זה הפיתוח שמממש אותה.

אין נגיעה ב-`templates/system/**` (שער הזהב לא נדרס) ולא בקבצי-התנהגות-בוט (שער ה-E2E no-op).

## הקשחת ה-extractor של ה-worker — שלבים 1‑3: תכן (fan-out חי) + תיקון + הוכחה דטרמיניסטית

התיקון תוכנן ע"י **ה-fan-out החי עצמו** (נחשון/נתן/ספי דרך ה-broker `agent-action.yml`), שגם
שימש כראיית-רלוונטיות חיה — שלוש התוצאות (split-plan של נחשון, מחקר נתן, רשומת ספי) חזרו כולן
`status:"unstructured"` תחת ה-extractor הישן (התוכן נשמר ב-`answer`).

- **`templates/agent-repo/.github/workflows/agent-main.yml`** — שלב "Extract the answer" הוקשח:
  במקום לתפוס את בלוק ה-```json **הראשון** ע"י התאמת-תת-מחרוזת (`/```json/`), הוא תופס עכשיו את
  הבלוק **האחרון** (הסנטינל שה-prompt מחייב) עם דפוסי-fence **מעוגנים-לשורה-שלמה**
  (`^[[:space:]]*```json[[:space:]]*$`), ואז מאמת ב-`jq` עם אותו fallback ל-`unstructured`.
  זה מתקן שתי כשלים: (א) שורת-תוכן שמכילה את הטקסט ```json כבר לא "פותחת" בלוק שגוי ומרוקנת אותו
  (הבאג שהפיל את תוכנית-הפיצול של נחשון), ו-(ב) בלוק-דוגמה לפני התוצאה כבר לא נתפס במקומה.
  תכן נתן, אומת ותוקן ע"י האיחוד (המשתנה `cap`, לא `in` — מילה שמורה ב-awk).
- **`scripts/tests/agent-repo-extractor.bats` (חדש)** — הוכחה דטרמיניסטית fail-before/pass-after:
  fixture של דוגמה-לפני-סנטינל ו-fixture של ```json-בתוך-התוכן (שחזור הבאג החי של נחשון) — הישן
  מחזיר `unstructured`/שגוי, החדש מחזיר את הבלוק הנכון; כולל happy-path ושומר-דריפט שמוודא
  שהתבנית אכן נושאת את ה-extractor המעוגן ולא את התמים. רץ ב-Playground tests.

לא נוגעים ב-`templates/system/**` (golden לא נדרס) ולא בקבצי-התנהגות-בוט. יישום על שלושת הריפויים
החיים (`nachshon`/`natan-research`/`sapi-docs`) דרך `refresh-agent-repo.yml` — בשלב נפרד, באישור Or.
