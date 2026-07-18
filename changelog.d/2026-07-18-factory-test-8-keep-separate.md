## החלטה: or-aios שומר פרויקט GCP משלו (factory-test-8) — "Phase 3" נדחה

"Phase 3" של קיפול-המפעל תוכנן במקור כאיחוד `factory-test-8` (פרויקט ה-GCP של or-aios) לתוך
`or-factory-master-control` ואז מחיקתו, כדי להגיע ל"פרויקט GCP יחיד". חקירה חיה (פרוטוקול-אמת) הובילה
להחלטה **לדחות את המהלך ולהשאיר את factory-test-8 כפרויקט הקבוע והמבודד של or-aios**.

**הנימוק (מאומת חי):**
- **תועלת זעירה:** factory-test-8 עולה ~11.87 ₪/חודש — Secret Manager בלבד (אין מחשוב; ה-n8n רץ על
  Railway). מחיקתו חוסכת ~12 ₪/חודש. (מקור: `get_billing_costs`, חלון 30 יום.)
- **סיכון גבוה:** המיגרציה דורשת העברת ~39 סודות ייחודיים כולל `n8n-encryption-key` **verbatim** (שינוי
  לא-מדויק = כל זהויות n8n השמורות נמחקות), הקמת WIF חדש, שינוי 3 משתני-repo שמזינים ~79 workflows,
  והרצת 2 פריסות על מערכת **חיה**, ואז מחיקה בלתי-הפיכה. כלי-ההעברה (`preserve`/`restore`/`mirror`/
  `grant-secret-accessor`) נמחקו באצווה 5א — אין מסלול חי.
- **הרעת-בידוד:** היום factory-test-8 מבודד את סודות-הריצה של or-aios מהלב של המערכת (control/gateway).
  איחוד היה מוריד את הבידוד הזה.
- **מסקנה ארכיטקטונית:** הקיפול ל"מערכת אישית אחת" אינו מחייב איחוד פרויקטי-GCP. or-aios רשאי ולנכון
  שיחזיק פרויקט GCP משלו.

**מה שונה בתיעוד:** `CLAUDE.md` (טבלת Fixed values + סעיפי Kept/Never) ו-`devplans/factory-dismantle.md`
עודכנו — הוסר מסגור "migrates to control in Phase 3 / until Phase 3", ו-factory-test-8 מתועד כפרויקט הקבוע
של or-aios. **הגנת "never delete without Or's explicit approval" נשמרת** (עדיין מחזיק `n8n-encryption-key`).

ללא שינוי קוד או תשתית — רק תיעוד. שום מערכת חיה לא נגעה.
