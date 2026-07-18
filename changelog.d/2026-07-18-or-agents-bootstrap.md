# or-agents-bootstrap — כלי הקמה חד-פעמי למערכת מקבילה חדשה

נוסף workflow חד-פעמי `.github/workflows/bootstrap-system-infra.yml` + שוחזר `scripts/copy-generic-secrets.sh`
(שנמחקו בקיפול), כדי להעמיד את התשתית של מערכת חדשה `or-agents` — מערכת-סוכנים נקייה לצד `or-aios`
שתשתמש באותם חיבורים/סודות/Google/MCP שכבר עובדים. הצורך: Or רוצה להתחיל מחדש בריפו נקי, בלי הכובד
שנצבר ב-or-aios, אבל בלי לאבד את מה שעובד.

**למה workflow ולא הערוץ הקל `gcp-action.yml`:** יצירת ה-WIF provider דורשת תנאי-CEL עם `&&` ומרכאות —
תווים שהגנת-ה-charset של `gcp-action.yml` חוסמת בכוונה (הזרקת-פקודות). לכן נדרש workflow ייעודי שרץ
כ-broker על main.

- **`bootstrap-system-infra.yml`** — גרסה **מצומצמת ל-normal-mode** של `provision-system.yml` שנמחק (שוחזר
  מהיסטוריית git): יוצר פרויקט GCP + billing, מפעיל APIs, יוצר runtime-sa/deploy-sa + IAM, יוצר WIF
  pool/provider **נעול ל-`edri2or/<system>`**, מעתיק את הסודות הגנריים, מנפיק OpenRouter key + bearers
  של ה-MCP, יוצר את ה-runtime shells, וקובע את משתני הריפו. **בלי** יצירת ריפו, **בלי** scaffolding של תוכן,
  **בלי** branch-protection — הריפו נבנה נקי ידנית אחר כך.
- אבטחה: WIF-only (אין מפתחות-SA), מפתח ה-broker App נמחק (`shred`) אחרי ההנפקה, ערכי-סודות אף פעם לא מודפסים.
- **חד-פעמי בכוונה:** לפי החלטת Or (2026-07-18) הכלי יימחק אחרי שירוץ פעם אחת ל-or-agents — כיבוד הקיפול
  (factory לא חוזר להיות מכונת-ייצור קבועה; אם תידרש מערכת עתידית, נשחזר שוב מההיסטוריה).

עלות בהרצה: יצירת פרויקט GCP ריק ≈ אפס (אחסון Secret Manager ~₪12/חודש מתחיל רק כשיש סודות). עלות ה-Railway
מתחילה בשלב הפריסה הנפרד. לא נוגע ב-gateway/backbone/factory-test-7/8/מסלול גוגל.
