# Secret Manager cache ב-gateway — חיתוך ~‎160 ₪/חודש בעלות קריאות-סוד

חקירת-עלות (פרוטוקול אמת) מצאה ש-Secret Manager על `or-factory-master-control` עולה **‎179.71 ₪/חודש**,
ומתוכם רק ~‎15 ₪ אחסון (83 גרסאות, שכפול אוטומטי = מיקום יחיד לפי [התיעוד הרשמי](https://cloud.google.com/secret-manager/pricing)) —
כל השאר (~‎165 ₪) הוא **פעולות-קריאה** (~18 מיליון/חודש). מיפוי-קוד איתר את הנתיב הדומיננטי:
`POST /factory/:system/emit` → `emitEvent()` ב-`observability-client.ts` קורא **5 סודות של פרויקט-הבקרה
בכל אירוע** (axiom / שני telegram / שני linear) דרך `readSecretSoft`, ללא cache — עד 300 קריאות/דקה/מערכת.

התיקון: כל קריאות-הערך זורמות דרך פונקציה יחידה — `getSecretValue` ב-`services/mcp-server/src/gcp-client.ts`
(הקוראת היחידה של ה-`:access` המחויב; אין נתיב אחר). עטפתי אותה ב-**cache-בזיכרון עם TTL של 60 שניות**,
בנקודת-המחנק היחידה, כך שקריאות חוזרות של אותו סוד מתמזגות לקריאה אחת ל-TTL.

- מפתח cache: `${projectId}/${name}`; **נשמרים רק ערכים מוצלחים** — שגיאות ו-payload ריק זורמים ללא cache,
  כך ש-`NotFoundError` וה-soft-fail של `readSecretSoft` נשמרים בדיוק כמו קודם.
- בטוח מבחינת רעננות: סודות הנתיב-החם ארוכי-חיים; `n8n-api-key` מתחלף רק בזמן-deploy; ו-`gmail-oauth-refresh-token`
  בכל re-consent גורר revision חדש ב-Cloud Run (`DEPLOY_NONCE`) → תהליך חדש → cache ריק. אין הגשת-ערך-ישן אחרי rotation.
- ה-sidecar של גוגל (Python) לא נגע — הוא קורא סודות כ-env vars באתחול בלבד, לא מ-Secret Manager בזמן ריצה.
- הקורא `mintSharedAccessToken` (`workspace-drive-edit.ts`) כבר מטמן לבד — נשאר ללא שינוי.
- בדיקות: 5 בדיקות-יחידה חדשות (`test/gcp-client-secret-cache.test.mjs`) — hit בתוך TTL, miss אחרי TTL,
  הפרדה לפי מפתח, ואי-שמירת שגיאות/payload-ריק.

צפי: חשבון ה-Secret Manager של הפרויקט יורד מ-~‎180 ₪ ל-~‎15–30 ₪ (חיסכון ~‎160 ₪/חודש ≈ ‎1,900 ₪/שנה).
ירידת-החשבון בימים שאחרי הפריסה היא גם ההוכחה שהקריאות היו המקור. ללא שינוי פונקציונלי; לא נוגע ב-backbone/מסלול-גוגל.
