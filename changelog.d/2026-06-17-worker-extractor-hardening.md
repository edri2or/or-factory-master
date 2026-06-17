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
